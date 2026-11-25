import { NextRequest, NextResponse } from 'next/server';
import { listNotificationsAction } from '@/app/actions/notifications';
import { AccessError } from '@/lib/team/access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')?.trim() || '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required.' }, { status: 400 });
  }

  const rawLimit = Number(req.nextUrl.searchParams.get('limit') || '25');
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.floor(rawLimit))) : 25;

  try {
    const data = await listNotificationsAction(workspaceId, limit);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof AccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[GET /api/notifications/feed]:', err);
    return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 });
  }
}
