/**
 * Server-side document & web page extraction for Knowledge Base ingestion.
 * Supports TXT, Markdown, CSV, JSON, HTML, DOCX, PDF, and SSRF-safe public URLs
 * using Node built-in primitives (zero native binary or DOMMatrix SSR dependencies).
 */

import dns from 'node:dns/promises';
import zlib from 'node:zlib';
import { isPrivateAddress } from '@/lib/automation/rules';

export const MAX_INGEST_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_INGEST_URL_BYTES = 2 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 120_000;

export interface ExtractedDocumentResult {
  title: string;
  summary: string;
  content: string;
  format: 'txt' | 'md' | 'csv' | 'json' | 'html' | 'docx' | 'pdf';
}

function decodeHtmlAndXmlEntities(input: string): string {
  return (input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    });
}

function normalizeExtractedText(raw: string): string {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

function deriveTitleFromFileName(fileName: string): string {
  const base = (fileName || '')
    .split(/[/\\]/)
    .pop()
    ?.replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base || 'Imported document';
}

function deriveSummary(content: string): string {
  const cleaned = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 155);
}

/** Converts HTML markup into clean structured Markdown text. */
export function htmlToReadableMarkdown(html: string): {
  title: string | null;
  summary: string | null;
  content: string;
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const rawTitle = titleMatch?.[1] || h1Match?.[1] || '';
  const title = decodeHtmlAndXmlEntities(rawTitle.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() || null;

  const metaDesc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)?.[1] ||
    null;
  const summary = metaDesc ? decodeHtmlAndXmlEntities(metaDesc).replace(/\s+/g, ' ').trim().slice(0, 160) : null;

  let body = html;
  const mainMatch = html.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (mainMatch?.[1] && mainMatch[1].length > 180) {
    body = mainMatch[1];
  } else {
    const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch?.[1]) body = bodyMatch[1];
  }

  const cleaned = body
    .replace(/<(?:script|style|noscript|svg|canvas|iframe|nav|footer)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|canvas|iframe|nav|footer)>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|tr|blockquote|pre|ul|ol|h4|h5|h6)>/gi, '\n\n')
    .replace(/<td\b[^>]*>|<th\b[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');

  const text = normalizeExtractedText(decodeHtmlAndXmlEntities(cleaned));
  return { title, summary: summary || (text ? deriveSummary(text) : null), content: text };
}

/**
 * Extracts text from a `.docx` ZIP archive buffer by parsing local/central ZIP entries
 * and reading `word/document.xml` paragraphs cleanly.
 */
export function extractTextFromDocxBuffer(buf: Buffer): string {
  const xmlText = readZipEntryText(buf, 'word/document.xml');
  if (!xmlText) {
    throw new Error('Could not locate word/document.xml inside DOCX archive.');
  }

  const normalizedXml = xmlText
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<[^>]+>/g, '');

  const text = normalizeExtractedText(decodeHtmlAndXmlEntities(normalizedXml));
  if (!text) {
    throw new Error('DOCX document contains no extractable text.');
  }
  return text;
}

function readZipEntryText(buf: Buffer, targetPath: string): string | null {
  // Scan End-of-Central-Directory (EOCD) first for reliable compressed/stored entry sizes
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65_557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === eocdSig) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const cdSize = buf.readUInt32LE(eocdOffset + 12);
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    let cursor = cdOffset;
    const cdEnd = Math.min(buf.length, cdOffset + cdSize);
    while (cursor + 46 <= cdEnd) {
      if (buf.readUInt32LE(cursor) !== 0x02014b50) break;
      const compressionMethod = buf.readUInt16LE(cursor + 10);
      const compressedSize = buf.readUInt32LE(cursor + 20);
      const nameLen = buf.readUInt16LE(cursor + 28);
      const extraLen = buf.readUInt16LE(cursor + 30);
      const commentLen = buf.readUInt16LE(cursor + 32);
      const localHeaderOffset = buf.readUInt32LE(cursor + 42);
      const name = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');

      if (name === targetPath && localHeaderOffset + 30 <= buf.length) {
        if (buf.readUInt32LE(localHeaderOffset) === 0x04034b50) {
          const lNameLen = buf.readUInt16LE(localHeaderOffset + 26);
          const lExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
          const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
          const compressed = buf.subarray(dataStart, dataStart + compressedSize);
          if (compressionMethod === 0) return compressed.toString('utf8');
          if (compressionMethod === 8) return zlib.inflateRawSync(compressed).toString('utf8');
        }
      }
      cursor += 46 + nameLen + extraLen + commentLen;
    }
  }

  return null;
}

function unescapePdfLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    if (next === 'n') {
      out += '\n';
      i += 1;
    } else if (next === 'r') {
      out += '\r';
      i += 1;
    } else if (next === 't') {
      out += '\t';
      i += 1;
    } else if (next === 'b' || next === 'f') {
      out += ' ';
      i += 1;
    } else if (next === '\\' || next === '(' || next === ')') {
      out += next;
      i += 1;
    } else if (/[0-7]/.test(next)) {
      const oct = raw.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0] || '';
      out += String.fromCharCode(parseInt(oct, 8));
      i += oct.length;
    } else {
      out += next;
      i += 1;
    }
  }
  return out;
}

function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  if (!clean) return '';
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  const bytes = Buffer.from(padded, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    // UTF-16BE BOM
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return bytes.toString('latin1');
}

function extractTextOperatorsFromStream(streamText: string): string {
  const parts: string[] = [];
  const btBlocks = streamText.match(/BT[\s\S]*?ET/g) || [streamText];

  for (const block of btBlocks) {
    const opRegex = /\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")|\[(?:[^[\]]*)\]\s*TJ|<([0-9a-fA-F\s]+)>\s*Tj|\bT\*\b/g;
    let match: RegExpExecArray | null;
    while ((match = opRegex.exec(block)) !== null) {
      const token = match[0];
      if (token === 'T*') {
        parts.push('\n');
        continue;
      }
      if (match[1] !== undefined) {
        parts.push(decodePdfHexString(match[1]));
        continue;
      }
      if (token.startsWith('(')) {
        const endIdx = token.lastIndexOf(')');
        parts.push(unescapePdfLiteral(token.slice(1, endIdx)));
        if (token.endsWith("'") || token.endsWith('"')) parts.push('\n');
        continue;
      }
      if (token.startsWith('[')) {
        const innerRegex = /\((?:\\.|[^\\()])*\)|<([0-9a-fA-F\s]+)>|(-?\d+(?:\.\d+)?)/g;
        let inner: RegExpExecArray | null;
        while ((inner = innerRegex.exec(token)) !== null) {
          if (inner[0].startsWith('(')) {
            parts.push(unescapePdfLiteral(inner[0].slice(1, -1)));
          } else if (inner[1] !== undefined) {
            parts.push(decodePdfHexString(inner[1]));
          } else if (inner[2] && Number(inner[2]) < -180) {
            parts.push(' ');
          }
        }
        parts.push('\n');
      }
    }
    parts.push('\n');
  }

  return parts.join('');
}

/**
 * Extracts readable text from a PDF buffer by inflating compressed PDF streams
 * (`FlateDecode`) and decoding PDF text operators (`Tj`, `TJ`, `BT..ET`).
 */
export function extractTextFromPdfBuffer(buf: Buffer): string {
  const header = buf.subarray(0, 8).toString('latin1');
  if (!header.includes('%PDF')) {
    throw new Error('File does not look like a valid PDF document.');
  }

  const rawLatin = buf.toString('latin1');
  if (/\/Encrypt\b/.test(rawLatin)) {
    throw new Error('Encrypted/password-protected PDFs cannot be extracted automatically.');
  }

  const extractedSegments: string[] = [];
  let cursor = 0;

  while (cursor < buf.length) {
    const streamIdx = buf.indexOf('stream', cursor, 'latin1');
    if (streamIdx === -1) break;

    let dataStart = streamIdx + 6;
    if (buf[dataStart] === 0x0d && buf[dataStart + 1] === 0x0a) dataStart += 2;
    else if (buf[dataStart] === 0x0a || buf[dataStart] === 0x0d) dataStart += 1;

    const endStreamIdx = buf.indexOf('endstream', dataStart, 'latin1');
    if (endStreamIdx === -1) break;

    const dictWindow = buf.subarray(Math.max(0, streamIdx - 320), streamIdx).toString('latin1');
    let streamBytes = buf.subarray(dataStart, endStreamIdx);
    // Trim single trailing CR/LF right before endstream
    while (streamBytes.length > 0 && (streamBytes[streamBytes.length - 1] === 0x0a || streamBytes[streamBytes.length - 1] === 0x0d)) {
      streamBytes = streamBytes.subarray(0, streamBytes.length - 1);
    }

    let decodedText: string | null = null;
    if (/\/FlateDecode\b/.test(dictWindow)) {
      try {
        decodedText = zlib.inflateSync(streamBytes).toString('latin1');
      } catch {
        try {
          decodedText = zlib.inflateRawSync(streamBytes).toString('latin1');
        } catch {
          decodedText = null;
        }
      }
    } else {
      decodedText = streamBytes.toString('latin1');
    }

    if (decodedText && (decodedText.includes('BT') || decodedText.includes('Tj') || decodedText.includes('TJ'))) {
      const piece = extractTextOperatorsFromStream(decodedText).trim();
      if (piece) extractedSegments.push(piece);
    }

    cursor = endStreamIdx + 9;
  }

  const combined = normalizeExtractedText(extractedSegments.join('\n\n'));
  if (combined.length >= 12) {
    return combined;
  }

  // Fallback for minimalist uncompressed PDFs with direct BT..ET outside standard stream delimiters
  const direct = normalizeExtractedText(extractTextOperatorsFromStream(rawLatin));
  if (direct.length >= 12) {
    return direct;
  }

  throw new Error(
    'No selectable text found in this PDF. Scanned image-only PDFs are not supported yet — export as TXT/Markdown or paste text instead.',
  );
}

/** Parses uploaded Knowledge Base file bytes (`.txt`, `.md`, `.csv`, `.json`, `.html`, `.docx`, `.pdf`). */
export function extractKnowledgeDocumentFromBuffer(input: {
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
  titleOverride?: string | null;
}): ExtractedDocumentResult {
  if (!input.buffer || input.buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (input.buffer.length > MAX_INGEST_FILE_BYTES) {
    throw new Error('File exceeds the 5 MB upload limit.');
  }

  const ext = (input.fileName.split('.').pop() || '').toLowerCase();
  const mime = (input.mimeType || '').toLowerCase();

  let format: ExtractedDocumentResult['format'] = 'txt';
  let content = '';
  let detectedTitle: string | null = null;
  let detectedSummary: string | null = null;

  if (ext === 'pdf' || mime === 'application/pdf') {
    format = 'pdf';
    content = extractTextFromPdfBuffer(input.buffer);
  } else if (
    ext === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    format = 'docx';
    content = extractTextFromDocxBuffer(input.buffer);
  } else if (ext === 'html' || ext === 'htm' || mime.includes('text/html')) {
    format = 'html';
    const parsed = htmlToReadableMarkdown(input.buffer.toString('utf8'));
    detectedTitle = parsed.title;
    detectedSummary = parsed.summary;
    content = parsed.content;
  } else if (ext === 'md' || ext === 'markdown' || mime.includes('markdown')) {
    format = 'md';
    content = normalizeExtractedText(input.buffer.toString('utf8'));
    const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    if (h1) detectedTitle = h1.slice(0, 140);
  } else if (ext === 'csv' || mime.includes('text/csv')) {
    format = 'csv';
    content = normalizeExtractedText(input.buffer.toString('utf8'));
  } else if (ext === 'json' || mime.includes('application/json')) {
    format = 'json';
    const raw = input.buffer.toString('utf8');
    try {
      const formatted = JSON.stringify(JSON.parse(raw), null, 2);
      content = normalizeExtractedText(`\`\`\`json\n${formatted}\n\`\`\``);
    } catch {
      content = normalizeExtractedText(raw);
    }
  } else if (ext === 'txt' || mime.startsWith('text/')) {
    format = 'txt';
    content = normalizeExtractedText(input.buffer.toString('utf8'));
  } else {
    throw new Error(`Unsupported file format "${ext || mime || 'unknown'}". Upload PDF, DOCX, TXT, Markdown, HTML, CSV, or JSON.`);
  }

  if (!content) {
    throw new Error('The uploaded file contained no readable text.');
  }

  const title = (input.titleOverride || '').trim() || detectedTitle || deriveTitleFromFileName(input.fileName);
  const summary = detectedSummary || deriveSummary(content);

  return { title, summary, content, format };
}

/** Validates that a Knowledge Base URL points to a public HTTP(S) host, blocking private/internal targets. */
export async function validateSafePublicUrl(
  rawUrl: string,
  options: { checkDns?: boolean } = {},
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Website URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Enter a valid http:// or https:// URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Only http:// and https:// URLs are allowed.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URLs with embedded credentials are not allowed.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isPrivateAddress(host)
  ) {
    return { ok: false, error: 'Private, local, or internal network URLs are blocked.' };
  }

  if (options.checkDns !== false) {
    try {
      const resolved = await dns.lookup(host, { all: true });
      if (resolved.some((record) => isPrivateAddress(record.address))) {
        return { ok: false, error: 'Target hostname resolves to a private network address.' };
      }
    } catch {
      // Allow fetch to fail naturally on genuine DNS failure unless it is an explicit private IP literal (checked above)
    }
  }

  return { ok: true, url: parsed };
}

/** Safely fetches a public web page (HTML/Markdown/Text) with redirect SSRF guards and size limits. */
export async function fetchAndExtractUrl(
  rawUrl: string,
  options: {
    fetchImpl?: typeof fetch;
    checkDns?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<{ title: string; summary: string; content: string; finalUrl: string }> {
  const doFetch = options.fetchImpl ?? fetch;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= 3; hop++) {
    const check = await validateSafePublicUrl(currentUrl, { checkDns: options.checkDns });
    if (!check.ok) {
      throw new Error(check.error);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
    let response: Response;
    try {
      response = await doFetch(check.url.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'OrbatAI-KnowledgeImporter/1.0',
          Accept: 'text/html, text/markdown, text/plain;q=0.9, */*;q=0.1',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect response lacked a Location header.');
      currentUrl = new URL(location, check.url).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Could not fetch URL (HTTP ${response.status}).`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_INGEST_URL_BYTES) {
      throw new Error('Target page exceeds the 2 MB download limit.');
    }

    const rawText = await response.text();
    if (Buffer.byteLength(rawText, 'utf8') > MAX_INGEST_URL_BYTES) {
      throw new Error('Target page exceeds the 2 MB download limit.');
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || /<\s*(?:html|body|h1|p|main|article)\b/i.test(rawText.slice(0, 600))) {
      const parsed = htmlToReadableMarkdown(rawText);
      if (!parsed.content) {
        throw new Error('No readable text content found at this URL.');
      }
      const fallbackTitle = check.url.hostname.replace(/^www\./, '');
      const title = parsed.title || `${fallbackTitle}${check.url.pathname !== '/' ? ` ${check.url.pathname}` : ''}`;
      return {
        title: title.slice(0, 140),
        summary: parsed.summary || deriveSummary(parsed.content),
        content: parsed.content,
        finalUrl: check.url.toString(),
      };
    }

    if (contentType.includes('text/plain') || contentType.includes('text/markdown') || !contentType) {
      const content = normalizeExtractedText(rawText);
      if (!content) throw new Error('Imported URL returned empty text.');
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const title = heading || check.url.hostname.replace(/^www\./, '');
      return {
        title: title.slice(0, 140),
        summary: deriveSummary(content),
        content,
        finalUrl: check.url.toString(),
      };
    }

    throw new Error(`Unsupported URL content type "${contentType}". Use web pages, Markdown, or plain text URLs.`);
  }

  throw new Error('Too many HTTP redirects while fetching URL.');
}
