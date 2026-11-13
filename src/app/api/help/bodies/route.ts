import { NextRequest, NextResponse } from 'next/server';
import { createPgCompatClient } from '@/lib/pg/query-client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')?.trim() || '';
  if (!UUID_RE.test(workspaceId)) {
    return NextResponse.json({ error: 'Invalid workspaceId' }, { status: 400 });
  }

  const pg = createPgCompatClient({ role: 'anon' });
  const { data: ws } = await pg
    .from('public_workspaces')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (!ws) {
    return NextResponse.json({ articles: [] }, { status: 404 });
  }

  const { data, error } = await pg
    .from('articles')
    .select('id, content')
    .eq('workspace_id', workspaceId)
    .eq('status', 'published');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { articles: (data as Array<{ id: string; content: string | null }>) || [] },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    }
  );
}

