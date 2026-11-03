import { NextRequest, NextResponse } from 'next/server';
import { guardConversation } from '@/lib/team/route-guard';
import { generateCopilotSuggestedReply } from '@/lib/ai/copilot/service';
import { CopilotReplyLanguage } from '@/lib/ai/copilot/prompts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversation_id,
      workspace_id,
      language = 'auto',
    } = body;

    if (!conversation_id || !workspace_id) {
      return NextResponse.json({ error: 'Missing conversation_id or workspace_id' }, { status: 400 });
    }

    const guard = await guardConversation(conversation_id, 'reply');
    if (!guard.ok) return guard.response;
    if (guard.workspaceId !== workspace_id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const res = await generateCopilotSuggestedReply({
      workspaceId: workspace_id,
      userId: guard.access.user.id,
      conversationId: conversation_id,
      language: language as CopilotReplyLanguage,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: res.error || 'Could not generate suggestion',
          retryable: res.retryable,
          availability: res.availability,
        },
        { status: res.availability && !res.availability.available ? 403 : 502 }
      );
    }

    return NextResponse.json({
      draft: res.draft,
      sources: res.sources || [],
      knowledgeFound: res.knowledgeFound,
      noteForAgent: res.noteForAgent,
      missingKnowledgeRecorded: res.missingKnowledgeRecorded,
      resolvedLanguage: res.resolvedLanguage,
      eventId: res.eventId,
    });
  } catch (err: unknown) {
    console.error('[Copilot Suggest Route Error]:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Failed to generate AI suggestion' }, { status: 500 });
  }
}
