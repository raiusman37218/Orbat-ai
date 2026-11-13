import { NextRequest, NextResponse } from 'next/server';
import { learnFromHumanAgentReply } from '@/lib/ai/learning/human-reinforce';
import { guardConversation } from '@/lib/team/route-guard';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, conversationId, agentMessageId, agentContent } = body || {};

    if (!conversationId || !agentMessageId || !agentContent) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, agentMessageId, agentContent' },
        { status: 400 }
      );
    }

    const guard = await guardConversation(conversationId, 'reply');
    if (!guard.ok) return guard.response;

    if (workspaceId && workspaceId !== guard.workspaceId) {
      return NextResponse.json({ error: 'Conversation does not belong to workspace' }, { status: 403 });
    }

    const result = await learnFromHumanAgentReply({
      workspaceId: guard.workspaceId,
      conversationId,
      agentMessageId,
      agentContent,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('[API /api/ai/reinforce Error]:', err?.message);
    return NextResponse.json({ error: err?.message || 'Reinforcement failed' }, { status: 500 });
  }
}
