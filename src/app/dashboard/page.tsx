import { redirect } from 'next/navigation';

function pickFirst(val?: string | string[]): string {
  if (Array.isArray(val)) return val[0]?.trim() || '';
  return val?.trim() || '';
}

export default async function LegacyDashboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    conversation?: string | string[];
    conv?: string | string[];
    c?: string | string[];
    view?: string | string[];
    settings?: string | string[];
    channel?: string | string[];
    channel_result?: string | string[];
    channel_message?: string | string[];
    checkout?: string | string[];
  }>;
}) {
  const sp = await searchParams;

  const conv = pickFirst(sp.conversation) || pickFirst(sp.conv) || pickFirst(sp.c);
  if (conv) {
    redirect(`/app/inbox?conversation=${encodeURIComponent(conv)}`);
  }

  const settings = pickFirst(sp.settings).toLowerCase();
  if (settings === 'channels') {
    const qp = new URLSearchParams();
    const channel = pickFirst(sp.channel);
    const channelResult = pickFirst(sp.channel_result);
    const channelMessage = pickFirst(sp.channel_message);
    if (channel) qp.set('channel', channel);
    if (channelResult) qp.set('channel_result', channelResult);
    if (channelMessage) qp.set('channel_message', channelMessage);
    const qs = qp.toString();
    redirect(qs ? `/app/channels?${qs}` : '/app/channels');
  }
  if (settings === 'billing') {
    redirect('/app/billing');
  }
  if (settings) {
    redirect('/app/settings');
  }

  if (pickFirst(sp.checkout)) {
    redirect('/app/billing');
  }

  const view = pickFirst(sp.view).toLowerCase();
  switch (view) {
    case 'visitors':
    case 'customers':
      redirect('/app/customers');
    case 'tickets':
      redirect('/app/tickets');
    case 'knowledge':
      redirect('/app/knowledge');
    case 'analytics':
    case 'reports':
      redirect('/app/analytics');
    case 'inbox':
      redirect('/app/inbox');
    default:
      redirect('/app');
  }
}
