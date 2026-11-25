import { NextRequest, NextResponse } from 'next/server';
import { uploadFileBuffer, isStorageConfigured } from '@/lib/storage';
import { guardMember } from '@/lib/team/route-guard';
import { clientIpOf } from '@/lib/geo';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyVisitorToken } from '@/lib/widget/visitor-token';

// Allowed MIME types: images, standard documents, and safe voice-note audio formats
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/avif',
  'application/pdf',
  'text/plain',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/mpeg',
  'audio/ogg',
]);

/** Fallback MIME detection by filename extension (mobile uploads / audio blobs). */
const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
};

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB images/docs
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10 MB voice notes

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-zentry-visitor, x-zentry-visitor-token',
};

function normalizeUploadMime(rawMime: string, filename: string): string {
  const base = (rawMime || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/m4a' || base === 'audio/x-m4a') return 'audio/mp4';
  if (base === 'video/webm' && /\.webm$/i.test(filename) && filename.toLowerCase().includes('voice')) {
    return 'audio/webm';
  }
  if (base && ALLOWED_TYPES.has(base)) return base;
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  return TYPE_BY_EXTENSION[ext] || base;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const visitorId = req.headers.get('x-zentry-visitor');
  const visitorToken = req.headers.get('x-zentry-visitor-token');

  if (visitorId || visitorToken) {
    if (visitorId && visitorToken) {
      const session = await verifyVisitorToken(visitorId, visitorToken);
      if (session) return true;
    }
    return false;
  }

  const member = await guardMember('view');
  return member.ok;
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpOf(req.headers) || 'unknown';
    if (!(await checkRateLimit(`upload:${ip}`, 60, 60))) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS_HEADERS });
    }

    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const mimeType = normalizeUploadMime(file.type, file.name || '');
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error: `File type ${mimeType || 'unknown'} not permitted. Supported: images, audio voice notes (webm/mp4/mpeg/ogg), PDF, and TXT.`,
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const isAudio = mimeType.startsWith('audio/');
    const maxBytes = isAudio ? MAX_AUDIO_SIZE : MAX_FILE_SIZE;
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: isAudio
            ? 'Voice note size exceeds maximum 10MB limit'
            : 'File size exceeds maximum 15MB limit',
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const rawDuration = formData.get('durationSec');
    const parsedDuration =
      typeof rawDuration === 'string' && rawDuration.trim() ? Number(rawDuration) : NaN;
    const durationSec =
      isAudio && Number.isFinite(parsedDuration) && parsedDuration >= 0
        ? Math.min(1800, Math.round(parsedDuration))
        : null;

    if (!isStorageConfigured()) {
      return NextResponse.json(
        {
          error:
            'Storage credentials are not configured. Please set Cloudflare R2 credentials in your environment variables.',
        },
        { status: 503, headers: CORS_HEADERS },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadFileBuffer(buffer, {
      folder: isAudio ? 'voice_notes' : 'chat_attachments',
      filename: file.name || (isAudio ? 'voice-note.webm' : 'attachment'),
      mimeType,
    });

    return NextResponse.json(
      {
        url: result.url,
        publicId: result.publicId,
        filename: file.name || result.filename,
        size: result.size || file.size,
        mimeType,
        isImage: result.isImage,
        isAudio,
        durationSec,
        width: result.width,
        height: result.height,
        provider: result.provider,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: unknown) {
    console.error('[Upload API Error]:', error);
    const msg = error instanceof Error ? error.message : 'File upload failed';
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
