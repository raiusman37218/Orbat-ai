import { beforeEach, describe, expect, it, vi } from 'vitest';
import zlib from 'node:zlib';

const dbState = vi.hoisted(() => ({
  insertedSources: [] as unknown[][],
  queries: [] as string[],
}));

const mockSaveArticle = vi.hoisted(() =>
  vi.fn(async (_wsId: string, input: { title: string; content: string; status: string }) => ({
    success: true as const,
    article: {
      id: 'art-imported-1',
      sectionId: null,
      sectionName: null,
      title: input.title,
      slug: 'imported-doc',
      summary: null,
      status: input.status,
      languages: ['en'],
      viewsCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      helpfulPct: null,
      authorName: null,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  })),
);

const mockSyncWorkspace = vi.hoisted(() =>
  vi.fn(async () => ({ indexedArticles: 4, totalChunks: 19 })),
);

vi.mock('@/lib/team/access', () => ({
  getWorkspaceAccess: vi.fn(async () => ({ role: 'admin', user: { id: 'usr-1' }, agent: null })),
}));

vi.mock('@/lib/plans/enforce', () => ({
  assertWorkspaceLimit: vi.fn(async () => undefined),
}));

vi.mock('@/lib/pg/service', () => {
  const emptyChain = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'ilike']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve({ data: null, error: null });
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    return b;
  };
  return {
    serviceClient: () => ({ from: () => emptyChain() }),
    hasServiceRole: () => true,
  };
});

vi.mock('@/lib/db', () => ({
  query: vi.fn(async () => undefined),
  queryRows: vi.fn(async (sql: string, params?: unknown[]) => {
    dbState.queries.push(sql);
    if (/FROM public\.article_chunks/i.test(sql)) {
      return [{ cnt: '3' }];
    }
    if (/INSERT INTO public\.knowledge_sources/i.test(sql)) {
      dbState.insertedSources.push(params || []);
      return [{ id: 'src-1' }];
    }
    if (/INSERT INTO public\.articles/i.test(sql)) {
      return [{ id: 'art-imported-1' }];
    }
    if (/FROM public\.articles a/i.test(sql)) {
      return [
        {
          id: 'art-imported-1',
          section_id: null,
          section_name: null,
          title: 'Security Policy',
          slug: 'security-policy',
          summary: 'All tokens rotate every 90 days.',
          content: '# Security Policy\n\nAll tokens rotate every 90 days.',
          status: 'published',
          languages: ['en'],
          views_count: 0,
          helpful_count: 0,
          not_helpful_count: 0,
          author_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    }
    if (/SELECT COALESCE\(MAX\(version_number\)/i.test(sql)) {
      return [{ max_ver: '0' }];
    }
    if (/FROM public\.workspaces/i.test(sql)) {
      return [{ name: 'Acme', slug: 'acme', custom_domain: null, custom_domain_status: null }];
    }
    return [];
  }),
}));

vi.mock('@/lib/ai/semantic-retrieval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/semantic-retrieval')>();
  return {
    ...actual,
    syncArticleChunks: vi.fn(async () => ({ articleId: 'art-imported-1', status: 'embedded', chunks: 3 })),
    syncWorkspaceArticleEmbeddings: mockSyncWorkspace,
  };
});

vi.mock('@/lib/ai/help-answer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/help-answer')>();
  return {
    ...actual,
    invalidateHelpIndex: vi.fn(),
  };
});

vi.mock('@/lib/ai/answer-cache', () => ({
  invalidateBotAnswerCacheForArticle: vi.fn(async () => undefined),
}));

vi.mock('@/lib/realtime/notify', () => ({
  refreshHelpCenter: vi.fn(),
}));

import {
  extractKnowledgeDocumentFromBuffer,
  extractTextFromDocxBuffer,
  extractTextFromPdfBuffer,
  fetchAndExtractUrl,
  htmlToReadableMarkdown,
  validateSafePublicUrl,
} from '@/lib/ai/document-ingest';
import {
  importKnowledgeSourceAction,
  reindexWorkspaceKnowledgeAction,
} from '@/app/actions/knowledge-hub';

/** Builds a minimal valid uncompressed/deflated ZIP archive containing a single entry. */
function buildSingleEntryZip(filePath: string, content: Buffer, deflate = true): Buffer {
  const nameBuf = Buffer.from(filePath, 'utf8');
  const payload = deflate ? zlib.deflateRawSync(content) : content;
  const method = deflate ? 8 : 0;

  const localHeader = Buffer.alloc(30 + nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(method, 8);
  localHeader.writeUInt32LE(payload.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  nameBuf.copy(localHeader, 30);

  const centralHeader = Buffer.alloc(46 + nameBuf.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(method, 10);
  centralHeader.writeUInt32LE(payload.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt32LE(0, 42); // local header offset
  nameBuf.copy(centralHeader, 46);

  const cdOffset = localHeader.length + payload.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralHeader.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);

  return Buffer.concat([localHeader, payload, centralHeader, eocd]);
}

/** Builds a minimal PDF containing a FlateDecode compressed text stream. */
function buildCompressedPdf(pdfStreamContent: string): Buffer {
  const compressed = zlib.deflateSync(Buffer.from(pdfStreamContent, 'latin1'));
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n', 'latin1'),
    compressed,
    Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
  ]);
}

describe('Part 5: Document & URL Ingestion + Re-index pipeline', () => {
  beforeEach(() => {
    dbState.insertedSources = [];
    dbState.queries = [];
    mockSaveArticle.mockClear();
    mockSyncWorkspace.mockClear();
  });

  it('extracts Markdown heading, plain text, and structured HTML cleanly', () => {
    const md = extractKnowledgeDocumentFromBuffer({
      fileName: 'refund-guide.md',
      buffer: Buffer.from('# Refund SLA Guide\n\nAll eligible invoices settle in 5 business days.\n', 'utf8'),
    });
    expect(md.format).toBe('md');
    expect(md.title).toBe('Refund SLA Guide');
    expect(md.content).toContain('5 business days');

    const html = htmlToReadableMarkdown(
      '<html><head><title>Pricing FAQ</title><meta name="description" content="Plans & billing cycles"></head><body><nav>Skip me</nav><main><h1>Plans</h1><p>Monthly and annual billing supported.</p><ul><li>Starter</li><li>Pro</li></ul></main><script>alert(1)</script></body></html>',
    );
    expect(html.title).toBe('Pricing FAQ');
    expect(html.summary).toBe('Plans & billing cycles');
    expect(html.content).not.toContain('alert(1)');
    expect(html.content).not.toContain('Skip me');
    expect(html.content).toContain('# Plans');
    expect(html.content).toContain('- Starter');
  });

  it('parses DOCX ZIP XML paragraphs and FlateDecode compressed PDF streams accurately', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><w:document><w:body><w:p><w:r><w:t>Payout Rules &amp; Timing</w:t></w:r></w:p><w:p><w:r><w:t>Standard payouts complete within 48 hours.</w:t></w:r></w:p></w:body></w:document>';
    const docxBuf = buildSingleEntryZip('word/document.xml', Buffer.from(xml, 'utf8'), true);
    const docxText = extractTextFromDocxBuffer(docxBuf);
    expect(docxText).toContain('Payout Rules & Timing');
    expect(docxText).toContain('48 hours.');

    const pdfBuf = buildCompressedPdf(
      'BT /F1 12 Tf 72 720 Td (Orbat Refund Policy) Tj T* [(14 business days) -260 (full money-back guarantee)] TJ ET',
    );
    const pdfText = extractTextFromPdfBuffer(pdfBuf);
    expect(pdfText).toContain('Orbat Refund Policy');
    expect(pdfText).toContain('14 business days full money-back guarantee');

    expect(() => extractTextFromPdfBuffer(Buffer.from('%PDF-1.4\n/Encrypt 2 0 R', 'latin1'))).toThrow(
      /Encrypted/i,
    );
  });

  it('blocks private/SSRF URLs directly and on HTTP redirects', async () => {
    for (const bad of [
      'http://localhost:3000/secret',
      'http://127.0.0.1/admin',
      'http://169.254.169.254/latest/meta-data',
      'http://10.20.30.40/internal',
      'http://[::1]/loopback',
      'file:///etc/passwd',
    ]) {
      const check = await validateSafePublicUrl(bad, { checkDns: false });
      expect(check.ok).toBe(false);
    }

    const redirectFetch = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:9000/internal' } }),
    ) as unknown as typeof fetch;

    await expect(
      fetchAndExtractUrl('https://docs.example.com/start', {
        fetchImpl: redirectFetch,
        checkDns: false,
      }),
    ).rejects.toThrow(/blocked|private|local/i);

    const okFetch = vi.fn(async () =>
      new Response('<html><title>Public Docs</title><body><p>Welcome to our API docs.</p></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    ) as unknown as typeof fetch;
    const fetched = await fetchAndExtractUrl('https://docs.example.com/api', {
      fetchImpl: okFetch,
      checkDns: false,
    });
    expect(fetched.title).toBe('Public Docs');
    expect(fetched.content).toContain('Welcome to our API docs.');
  });

  it('runs importKnowledgeSourceAction and reindexWorkspaceKnowledgeAction end-to-end', async () => {
    const b64 = Buffer.from('# Security Policy\n\nAll tokens rotate every 90 days.', 'utf8').toString('base64');
    const importRes = await importKnowledgeSourceAction('ws-1', {
      mode: 'file',
      fileName: 'security.md',
      mimeType: 'text/markdown',
      base64Data: b64,
      publishImmediately: true,
    });

    expect(importRes.success).toBe(true);
    expect(importRes.title).toBe('Security Policy');
    expect(importRes.chunkCount).toBe(3);
    expect(dbState.insertedSources.length).toBe(1);

    const reindexRes = await reindexWorkspaceKnowledgeAction('ws-1');
    expect(reindexRes.success).toBe(true);
    expect(reindexRes.indexedArticles).toBe(4);
    expect(reindexRes.totalChunks).toBe(19);
    expect(mockSyncWorkspace).toHaveBeenCalledWith('ws-1');
  });
});
