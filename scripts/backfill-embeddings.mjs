import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 5,
});

function estimateTokenCount(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  return Math.max(1, Math.round(Math.max(words * 1.3, chars / 4)));
}

function splitMarkdownBlocks(markdown) {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let current = [];
  let inCode = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      current.push(line);
      continue;
    }
    if (inCode) {
      current.push(line);
      continue;
    }
    if (/^#{1,6}\s+/.test(line.trim())) {
      if (current.length) {
        blocks.push(current.join('\n').trim());
        current = [];
      }
      current.push(line);
      continue;
    }
    if (line.trim() === '' && current.length) {
      blocks.push(current.join('\n').trim());
      current = [];
      continue;
    }
    if (line.trim() !== '') {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n').trim());
  return blocks.filter(Boolean);
}

function splitArticleIntoChunks(article) {
  const title = (article.title || '').trim();
  const sectionName = (article.sectionName || article.category || 'General').trim();
  const header = `Article: ${title}\nSection: ${sectionName}\n\n`;
  const headerTokens = estimateTokenCount(header);

  const TARGET_MAX_TOKENS = 650;
  const blocks = splitMarkdownBlocks(article.content);
  const rawChunks = [];
  let currentBodyBlocks = [];
  let currentTokens = headerTokens;

  for (const block of blocks) {
    const blockTokens = estimateTokenCount(block);

    if (blockTokens > TARGET_MAX_TOKENS) {
      if (currentBodyBlocks.length > 0) {
        rawChunks.push(header + currentBodyBlocks.join('\n\n'));
        currentBodyBlocks = [];
        currentTokens = headerTokens;
      }
      const sentences = block.split(/(?<=[.!?])\s+/);
      let subSentences = [];
      let subTokens = headerTokens;
      for (const sent of sentences) {
        const sTokens = estimateTokenCount(sent);
        if (subTokens + sTokens > TARGET_MAX_TOKENS && subSentences.length > 0) {
          rawChunks.push(header + subSentences.join(' '));
          subSentences = [];
          subTokens = headerTokens;
        }
        subSentences.push(sent);
        subTokens += sTokens;
      }
      if (subSentences.length > 0) {
        rawChunks.push(header + subSentences.join(' '));
      }
      continue;
    }

    if (currentTokens + blockTokens > TARGET_MAX_TOKENS && currentBodyBlocks.length > 0) {
      rawChunks.push(header + currentBodyBlocks.join('\n\n'));
      currentBodyBlocks = [];
      currentTokens = headerTokens;
    }

    currentBodyBlocks.push(block);
    currentTokens += blockTokens;
  }

  if (currentBodyBlocks.length > 0) {
    rawChunks.push(header + currentBodyBlocks.join('\n\n'));
  }

  if (rawChunks.length === 0) {
    rawChunks.push(`${header}${article.summary ? `${article.summary}\n\n` : ''}${title}`);
  }

  return rawChunks.map((content, idx) => ({
    workspace_id: article.workspace_id,
    article_id: article.id,
    article_title: title,
    section_name: sectionName,
    article_slug: article.slug || null,
    chunk_index: idx,
    content,
    token_count: estimateTokenCount(content),
  }));
}

async function getEmbeddings(texts, apiKey, baseUrl) {
  const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/embeddings';
  const isDeepInfra = (baseUrl || '').includes('deepinfra.com');
  const model = isDeepInfra ? 'google/embeddinggemma-300m' : 'text-embedding-3-small';
  const results = [];
  const BATCH_SIZE = 15;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const bodyPayload = { model, input: batch };
    if (model === 'text-embedding-3-small') bodyPayload.dimensions = 768;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding call failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    const sorted = (data.data || []).sort((a, b) => a.index - b.index);
    for (const item of sorted) results.push(item.embedding);
  }
  return results;
}

async function run() {
  console.log('Fetching platform AI settings...');
  const { rows: aiRows } = await pool.query(
    'SELECT * FROM public.platform_ai_settings WHERE id = true LIMIT 1',
  );
  const aiSettings = aiRows[0];

  if (!aiSettings || !aiSettings.api_key) {
    console.error('Cannot load platform AI settings');
    process.exit(1);
  }

  console.log('Using provider:', aiSettings.provider, 'baseUrl:', aiSettings.base_url);

  const { rows: workspaces } = await pool.query('SELECT id, name FROM public.workspaces');
  console.log(`Found ${workspaces.length} workspaces.`);

  let totalArticles = 0;
  let totalChunks = 0;

  for (const ws of workspaces) {
    const { rows: articles } = await pool.query(
      `SELECT a.*, hs.name AS section_name
       FROM public.articles a
       LEFT JOIN public.help_sections hs ON hs.id = a.section_id
       WHERE a.workspace_id = $1 AND a.status = 'published'`,
      [ws.id],
    );

    if (!articles || articles.length === 0) continue;

    console.log(`\nWorkspace "${ws.name}" (${ws.id}): ${articles.length} published articles.`);
    const chunks = [];
    for (const art of articles) {
      const secName = art.section_name || art.category || 'General';
      const artChunks = splitArticleIntoChunks({ ...art, sectionName: secName });
      chunks.push(...artChunks);
    }

    console.log(`  Generated ${chunks.length} chunks. Generating embeddings...`);
    const texts = chunks.map((c) => c.content);
    const embeddings = await getEmbeddings(texts, aiSettings.api_key, aiSettings.base_url);

    console.log(`  Got ${embeddings.length} embeddings. Storing in database...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM public.article_chunks WHERE workspace_id = $1', [ws.id]);

      for (let idx = 0; idx < chunks.length; idx++) {
        const c = chunks[idx];
        const vec = `[${embeddings[idx].join(',')}]`;
        await client.query(
          `INSERT INTO public.article_chunks
             (workspace_id, article_id, article_title, section_name, article_slug, chunk_index, content, token_count, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
          [
            c.workspace_id,
            c.article_id,
            c.article_title,
            c.section_name,
            c.article_slug,
            c.chunk_index,
            c.content,
            c.token_count,
            vec,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (insErr) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`  Error inserting chunks for ${ws.name}:`, insErr);
      continue;
    } finally {
      client.release();
    }
    console.log(`  Successfully indexed ${articles.length} articles, ${chunks.length} chunks for ${ws.name}.`);
    totalArticles += articles.length;
    totalChunks += chunks.length;
  }

  console.log(`\nBackfill complete! Total articles: ${totalArticles}, Total chunks: ${totalChunks}`);
}

run()
  .catch(console.error)
  .finally(() => pool.end());
