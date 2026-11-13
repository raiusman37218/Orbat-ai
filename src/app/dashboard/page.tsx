'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  agentHeartbeatAction,
  bulkUpdateDashboardConversationsAction,
  deleteDashboardMessageAction,
  editDashboardMessageAction,
  getDashboardConversationAction,
  getHelpSectionsCountAction,
  listDashboardConversationsAction,
  listDashboardMessagesAction,
  listDashboardVisitorsAction,
  pollRingingHandoffsAction,
  sendDashboardMessageAction,
  startDashboardConversationAction,
  updateAgentStatusAction,
  updateDashboardConversationAction,
} from '@/app/actions/inbox';
import { Agent, Conversation, Message, Visitor, Workspace, AgentStatus, ConversationStatus, ConversationPriority, CannedResponse } from '@/types/database';
import { Sidebar, type View } from '@/components/dashboard/Sidebar';
import { ConversationList } from '@/components/dashboard/ConversationList';
import { ChatThread } from '@/components/dashboard/ChatThread';
import { VisitorDetailsSidebar } from '@/components/dashboard/VisitorDetailsSidebar';
import { getOpenUnansweredCountAction } from '@/app/actions/unanswered';
import { EmptyState } from '@/components/ui/EmptyState';
import { DashboardCommandPalette } from '@/components/dashboard/DashboardCommandPalette';
import { MobileInstallBanner } from '@/components/pwa/MobileInstallBanner';
import { sound } from '@/lib/sound';
import { sendBrowserNotification, cn } from '@/lib/utils';
import { updateFaviconBadge } from '@/lib/favicon';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import { isVisitorOnline } from '@/lib/tracking/visitor-tracking';
import { isWaitingForPerson } from '@/lib/inbox/handovers';
import { isWithinOfficeHours } from '@/lib/handoff/state-machine';
import { RingingHandoffModal, type RingingHandoffPayload } from '@/components/dashboard/RingingHandoffModal';
import { useToast } from '@/components/ui/Toast';
import type { SectionId } from '@/components/dashboard/SettingsHub';
import { BarChart2, BookOpen, Inbox, MessagesSquare, Radio, Settings, Smartphone, ShieldAlert, LogOut, Sparkles, Ticket, HelpCircle, Hand } from 'lucide-react';
import { exitSuperAdminWorkspaceViewAction } from '@/app/actions/platform';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/States';
import { useTeamInbox } from '@/lib/team-chat/use-team-inbox';
import type { TeamChatShare } from '@/components/team-chat/TeamChat';
import type { TeamInboxRow, TeamMessage } from '@/types/database';
import {
  getAuthToken,
  getStoredUser,
  getStoredWorkspace,
  backendGetMe,
  refreshBackendSession,
  clearAuthSession,
} from '@/lib/api/backend-auth';
import {
  createBackendRealtimeClient,
  type BackendRealtimeClient,
} from '@/lib/api/backend-realtime';
import {
  isBackendAuthenticated,
  getBackendToken,
  getBackendCurrentWorkspace,
  getBackendMembers,
  getBackendContacts,
  getBackendConversations,
  getBackendConversationById,
  createBackendConversation,
  getBackendMessages,
  sendBackendMessage,
  editBackendMessage,
  deleteBackendMessage,
  updateBackendConversation,
  bulkUpdateBackendConversations,
  assignBackendConversation,
  updateBackendAgentStatus,
  mapBackendMessage,
  mapBackendConversation,
  markBackendMessagesRead,
} from '@/lib/api/backend-client';

// Views other than the inbox load when first opened. Bundled together they
// made the dashboard download about 2 MB of script before the inbox could
// show (reports alone bring a charting library).
const viewLoading = () => <LoadingState className="flex-1" />;
const LiveVisitorsRadar = dynamic(() => import('@/components/dashboard/LiveVisitorsRadar').then((m) => m.LiveVisitorsRadar), { loading: viewLoading });
const SettingsHub = dynamic(() => import('@/components/dashboard/SettingsHub').then((m) => m.SettingsHub), { loading: viewLoading });
const ReportsDashboard = dynamic(() => import('@/components/reports/ReportsDashboard').then((m) => m.ReportsDashboard), { loading: viewLoading });
const HelpDeskDashboard = dynamic(() => import('@/components/dashboard/HelpDeskDashboard').then((m) => m.HelpDeskDashboard), { loading: viewLoading });
const TicketsView = dynamic(() => import('@/components/tickets/TicketsView').then((m) => m.TicketsView), { loading: viewLoading });
const HandoversView = dynamic(() => import('@/components/dashboard/HandoversView').then((m) => m.HandoversView), { loading: viewLoading });
const UnansweredQuestionsView = dynamic(() => import('@/components/dashboard/UnansweredQuestionsView').then((m) => m.UnansweredQuestionsView), { loading: viewLoading });
const KeyboardShortcutsModal = dynamic(() => import('@/components/ui/KeyboardShortcutsModal').then((m) => m.KeyboardShortcutsModal));
const TeamChat = dynamic(() => import('@/components/team-chat/TeamChat').then((m) => m.TeamChat), { loading: viewLoading });
const MobileInstallModal = dynamic(() => import('@/components/pwa/MobileInstallModal').then((m) => m.MobileInstallModal));
import { TrialBanner } from '@/components/dashboard/TrialBanner';
import { UpgradeModal } from '@/components/dashboard/UpgradeModal';
import { getWorkspaceBillingAndUsageAction } from '@/app/actions/plans';
import { completeSimulatedCheckoutAction } from '@/app/actions/platform-management';

/**
 * Whether the AI assistant is the one replying on a thread. Mirrors the checks
 * in /api/ai/auto-respond, so the composer is only locked when the assistant
 * will actually answer.
 */
function isAiAnswering(conv: Conversation, ws: Workspace | null): boolean {
  if (conv.ai_mode === 'disabled' || conv.ai_needs_attention_at) return false;
  const s = ws?.ai_settings;
  return !s || (s.enabled !== false && s.auto_response_enabled !== false);
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isViewingAsSuperAdmin, setIsViewingAsSuperAdmin] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showMobileInstallModal, setShowMobileInstallModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ status: string; trialDaysRemaining: number | null; isTrialExpired: boolean } | null>(null);
  const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1440;
    }
    return false;
  });
  const [articlesCount, setArticlesCount] = useState(0);
  const [sectionsCount, setSectionsCount] = useState(0);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SectionId | undefined>(undefined);
  const [settingsNonce, setSettingsNonce] = useState(0);
  // What the command palette asked the tickets screen to show.
  const [ticketsRequest, setTicketsRequest] = useState<{ viewId?: string; ticketId?: string; nonce: number } | null>(null);

  const [checkoutBannerMsg, setCheckoutBannerMsg] = useState<string | null>(null);
  const [dismissedOfficeHoursBanner, setDismissedOfficeHoursBanner] = useState(false);
  const [audioNotificationAlertDismissed, setAudioNotificationAlertDismissed] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const autoAwayTriggeredRef = useRef(false);
  const [ringingPayload, setRingingPayload] = useState<RingingHandoffPayload | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const notifPending = 'Notification' in window && Notification.permission === 'default';
      setNeedsAudioUnlock(notifPending);
    } catch {
      // ignore
    }
  }, []);

  const handleEnableAudioNotifications = async () => {
    sound.prime();
    await sound.unlockAudio();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore
      }
    }
    setNeedsAudioUnlock(false);
    toast.success('Audio & notifications enabled');
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      getOpenUnansweredCountAction(currentWorkspace.id)
        .then(setUnansweredCount)
        .catch(() => {});
      getWorkspaceBillingAndUsageAction(currentWorkspace.id)
        .then((res) => {
          if (res) {
            setSubscriptionInfo({
              status: res.subscription.status,
              trialDaysRemaining: res.trialDaysRemaining,
              isTrialExpired: res.isTrialExpired,
            });
          }
        })
        .catch(() => {});
    }
  }, [currentWorkspace?.id]);

  const handleUpdateAgentStatusRef = useRef<(status: AgentStatus) => Promise<void>>(async () => {});

  // Availability heartbeat. The database counts an agent as available only
  // while this arrives every 30 s (90 s grace) and reports recent input, so it
  // says whether the mouse or keyboard was used since the last beat; the
  // server's own 15-minute auto-away reads that flag.
  const activitySinceBeatRef = useRef(true);
  useEffect(() => {
    if (!currentWorkspace?.id || !currentAgent?.id || isBackendAuthenticated()) return;
    const markActive = () => {
      activitySinceBeatRef.current = true;
    };
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    let firstBeat = true;
    const sendHeartbeat = async () => {
      const active = activitySinceBeatRef.current;
      activitySinceBeatRef.current = false;
      try {
        const beat = await agentHeartbeatAction(
          currentWorkspace.id,
          active,
          firstBeat && currentAgent.status === 'online'
        );
        if (beat?.auto_away) {
          setCurrentAgent((prev) => (prev ? { ...prev, status: 'away' } : prev));
          return;
        }
        firstBeat = false;
      } catch (err: any) {
        console.warn('[Heartbeat]:', err?.message || err);
      }
    };
    void sendHeartbeat();
    const interval = setInterval(() => {
      void sendHeartbeat();
    }, 30000);
    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, [currentWorkspace?.id, currentAgent?.id]);

  // 15-minute inactivity auto-Away (Phase 2)
  useEffect(() => {
    if (!currentWorkspace?.id || !currentAgent?.id) return;
    const INACTIVITY_MS = 15 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (autoAwayTriggeredRef.current && currentAgent.status === 'away') {
        autoAwayTriggeredRef.current = false;
        handleUpdateAgentStatusRef.current('online');
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (currentAgent.status === 'online') {
          autoAwayTriggeredRef.current = true;
          handleUpdateAgentStatusRef.current('away');
        }
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [currentWorkspace?.id, currentAgent?.id, currentAgent?.status]);

  // Browsers keep audio silent until the page gets a click or key press, so
  // a ring arriving later would make no sound. Unlock it on the first
  // interaction anywhere on the dashboard (the banner button is optional).
  useEffect(() => {
    const unlock = () => {
      sound.prime();
      void sound.unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Poll workspace ringing handoffs via Server Action when NestJS realtime isn't primary.
  useEffect(() => {
    if (!currentWorkspace?.id || !currentAgent?.id || isBackendAuthenticated()) return;
    // Light agents can view but not take chats, so they are never rung.
    if (currentAgent.role === 'light_agent') return;
    let disposed = false;

    const shownRings = new Set<string>();

    const pollRinging = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const rows = await pollRingingHandoffsAction(currentWorkspace.id);
        if (disposed) return;

        const timeout = Number(currentWorkspace.handoff_settings?.ring_timeout_seconds) || 45;
        const activeIds = new Set(rows.map((r) => r.conversationId));
        setRingingPayload((prev) => (prev && !activeIds.has(prev.conversationId) ? null : prev));

        for (const row of rows) {
          const started = row.ringStartedAt ? Date.parse(row.ringStartedAt) : NaN;
          if (Number.isFinite(started) && Date.now() - started > timeout * 1000) continue;
          const ringKey = `${row.conversationId}:${row.ringStartedAt ?? ''}`;
          if (shownRings.has(ringKey)) continue;
          shownRings.add(ringKey);
          setRingingPayload({
            conversationId: row.conversationId,
            visitorName: row.visitorName,
            visitorEmail: row.visitorEmail,
            question: row.question,
            summary: row.summary,
            reason: row.reason,
            timeoutSeconds: timeout,
            broadcast: row.ringBroadcast,
          });
          break;
        }
      } catch (err: any) {
        console.warn('[Handoff Ring] poll failed:', err?.message || err);
      }
    };

    void pollRinging();
    const ringPoll = setInterval(() => void pollRinging(), 8_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pollRinging();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      clearInterval(ringPoll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [
    currentWorkspace?.id,
    currentWorkspace?.handoff_settings?.ring_timeout_seconds,
    currentAgent?.id,
    currentAgent?.role,
  ]);

  const isOfficeHoursActive = useMemo(() => {
    if (!currentWorkspace) return false;
    const config = currentWorkspace.handoff_settings?.office_hours || currentWorkspace.business_hours;
    return isWithinOfficeHours(config);
  }, [currentWorkspace]);

  const showOfficeHoursAwayBanner =
    isOfficeHoursActive && currentAgent?.status === 'away' && !dismissedOfficeHoursBanner;

  // Five destinations: the inbox, the visitor radar, reports, help desk,
  // and the Settings hub.
  const [activeView, setActiveView] = useState<View>('inbox');

  // Conversations & Messages (Pages of 30)
  const PAGE_SIZE = 30;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Size the app to the *visible* viewport. On phones this shrinks when the
  // on-screen keyboard opens, so the composer stays above it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty('--app-vvh', `${Math.round(vv.height)}px`);
    sync();
    vv.addEventListener('resize', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      root.style.removeProperty('--app-vvh');
    };
  }, []);

  // Mobile: an open conversation is its own history entry, so the browser
  // back button / edge-swipe returns to the list instead of leaving the app.
  useEffect(() => {
    if (!selectedConversationId) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    if (window.history.state?.zentryThread) return;
    window.history.pushState({ ...(window.history.state || {}), zentryThread: true }, '');
  }, [selectedConversationId]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (!e.state?.zentryThread) setSelectedConversationId(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleMobileBack = useCallback(() => {
    if (window.history.state?.zentryThread) {
      window.history.back(); // popstate clears the selection
    } else {
      setSelectedConversationId(null);
    }
  }, []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const messagesCacheRef = useRef<Record<string, Message[]>>({});

  // Visitors
  const [visitors, setVisitors] = useState<Visitor[]>([]);

  // Refs for tracking active state in realtime callbacks
  const selectedConversationIdRef = useRef<string | null>(null);
  selectedConversationIdRef.current = selectedConversationId;

  const currentWorkspaceIdRef = useRef<string | null>(null);
  currentWorkspaceIdRef.current = currentWorkspace?.id || null;

  const currentAgentRef = useRef<Agent | null>(null);
  currentAgentRef.current = currentAgent;

  const currentWorkspaceRef = useRef<Workspace | null>(null);
  currentWorkspaceRef.current = currentWorkspace;

  // Arms audio so the agent's first click anywhere unlocks it; otherwise the
  // browser silently drops alerts until they happen to interact.
  useEffect(() => {
    sound.prime();
  }, []);

  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  // Team chat. The thread list lives here so the sidebar badge and alerts work
  // on every view. A direct message or an @mention rings (unless that thread
  // is on screen); other channel chatter only counts.
  const [teamShare, setTeamShare] = useState<TeamChatShare | null>(null);
  const [teamThreadRequest, setTeamThreadRequest] = useState<{ threadId: string; nonce: number } | null>(null);
  const openTeamThreadRef = useRef<string | null>(null);
  const activeViewRef = useRef<View>('inbox');
  const allAgentsRef = useRef<Agent[]>([]);
  useEffect(() => {
    activeViewRef.current = activeView;
    allAgentsRef.current = allAgents;
  }, [activeView, allAgents]);
  const onTeamMessage = useCallback((msg: TeamMessage, threads: TeamInboxRow[]) => {
    const me = currentAgentRef.current?.id;
    if (!me || msg.sender_id === me) return;
    const thread = threads.find((t) => t.thread_id === msg.thread_id);
    // A thread not in the list yet is a direct message someone just started.
    const direct = !thread || thread.kind === 'direct';
    const mentioned = (msg.mentions || []).includes(me);
    if (!direct && !mentioned) return;
    const looking =
      activeViewRef.current === 'team' && openTeamThreadRef.current === msg.thread_id && document.visibilityState === 'visible';
    if (looking) return;
    const sender = allAgentsRef.current.find((a) => a.id === msg.sender_id);
    const name = sender?.name || sender?.email || 'A teammate';
    sound.playMention();
    sendBrowserNotification(direct ? name : `${name} mentioned you`, msg.content, {
      tag: `team-${msg.thread_id}`,
      onClick: () => {
        setActiveView('team');
        setTeamThreadRequest({ threadId: msg.thread_id, nonce: Date.now() });
      },
    });
  }, []);
  const teamInbox = useTeamInbox(currentWorkspace?.id, onTeamMessage);
  const onTeamThreadChange = useCallback((threadId: string | null) => {
    openTeamThreadRef.current = threadId;
  }, []);

  // Keep unread badge accurate across tabs.

  // Dynamically update favicon badge and title count when unread conversations change
  useEffect(() => {
    const unreadTotal = conversations.reduce(
      (acc, c) => acc + (c.unread_count || 0),
      0
    );
    updateFaviconBadge(unreadTotal);
  }, [conversations]);

  // Global Keyboard Shortcuts Listener (? for cheatsheet, Esc to deselect, R to refresh)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key === '?' && !isInputActive && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      // 'r' or 'R' to refresh when not typing
      if ((e.key === 'r' || e.key === 'R') && !isInputActive && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        refreshConversations();
        return;
      }

      // Escape used to deselect even while typing a reply, throwing away the
      // draft along with the thread.
      if (
        e.key === 'Escape' &&
        !showShortcutsModal &&
        selectedConversationId &&
        !isInputActive
      ) {
        setSelectedConversationId(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showShortcutsModal, selectedConversationId]);


  // 1. Initial Load & Auth Verification (NestJS Backend Native Stack)
  const backendRealtimeRef = useRef<BackendRealtimeClient | null>(null);
  const initializeDashboard = useCallback(async () => {
    try {
      const nestToken = getAuthToken() || (await refreshBackendSession());

      if (!nestToken) {
        router.replace('/login?redirect=%2Fdashboard');
        return;
      }

      let parsedUser: any = getStoredUser();
      let parsedWs: any = getStoredWorkspace();

      if (!parsedUser) {
        try {
          parsedUser = await backendGetMe();
          if (parsedUser?.workspaceId) {
            parsedWs = {
              id: parsedUser.workspaceId,
              name: parsedUser.workspaceName || `${parsedUser.name}'s Workspace`,
              brandColor: parsedUser.brandColor || '#4f46e5',
            };
          }
        } catch (err) {
          console.warn('[Dashboard] Could not fetch profile from backend:', err);
        }
      }

      if (parsedUser) {
        const nestAgent: Agent = {
          id: parsedUser.id,
          name: parsedUser.name || 'Agent',
          email: parsedUser.email || '',
          avatar_url: parsedUser.avatar_url || parsedUser.avatarUrl || null,
          role: (parsedUser.role as any) || 'owner',
          status: 'online',
          workspace_id: parsedUser.workspaceId || parsedWs?.id || null,
          is_super_admin: Boolean(parsedUser.isSuperAdmin),
          created_at: new Date().toISOString(),
        };
        setCurrentAgent(nestAgent);

        let ws: Workspace = ({
          id: parsedWs?.id || parsedUser.workspaceId,
          name: parsedWs?.name || 'Workspace',
          brand_color: parsedWs?.brandColor || '#4f46e5',
          greeting_title: 'Welcome to Orbat AI',
          greeting_message: 'How can we help you today?',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown) as Workspace;

        try {
          const backendWs = await getBackendCurrentWorkspace();
          if (backendWs?.id) ws = backendWs;
        } catch (e) {
          console.warn('[Dashboard] getBackendCurrentWorkspace failed:', e);
        }
        setCurrentWorkspace(ws);
        currentWorkspaceIdRef.current = ws.id;

        try {
          const members = await getBackendMembers();
          setAllAgents(members);
        } catch (e) {
          console.warn('[Dashboard] getBackendMembers failed:', e);
        }

        try {
          const backendVisitors = await getBackendContacts({ limit: 300 });
          setVisitors(backendVisitors);
        } catch (e) {
          console.warn('[Dashboard] getBackendContacts failed:', e);
        }

        try {
          const convs = await getBackendConversations({ status: 'all' });
          setConversations(convs);
          if (convs.length > 0) {
            setSelectedConversationId(convs[0].id);
            try {
              const initialMsgs = await getBackendMessages(convs[0].id);
              setMessages(initialMsgs);
              messagesCacheRef.current[convs[0].id] = initialMsgs;
            } catch {}
          }
        } catch (e) {
          console.warn('[Dashboard] getBackendConversations failed:', e);
        }

        setLoading(false);
        return;
      }

      clearAuthSession();
      router.replace('/login?redirect=%2Fdashboard');
      return;
    } catch (err) {
      console.error('Error initializing dashboard:', err);
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  // Unread-reply emails to customers are sent by the scheduler
  // (/api/cron/unread-notifications, migration 20261104090000). Every open
  // dashboard used to trigger the platform-wide job once a minute.

  const handleOpenSimulator = useCallback(() => {
    if (!currentWorkspace) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '');
    const simUrl = `${origin}/demo.html?workspaceId=${encodeURIComponent(currentWorkspace.id)}&name=${encodeURIComponent(currentWorkspace.name)}`;
    window.open(simUrl, '_blank');
  }, [currentWorkspace]);

  const handleOpenSettingsSection = useCallback((section: SectionId) => {
    setSettingsInitialSection(section);
    setSettingsNonce((n) => n + 1);
    setActiveView('settings');
  }, []);

  // Instagram's login sends the admin back here with ?settings=channels; Lemon Squeezy checkout returns with ?settings=billing&checkout=success.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('settings');
    if (target === 'channels') handleOpenSettingsSection('channels');
    if (target === 'billing') handleOpenSettingsSection('billing');

    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');
    const planSlug = params.get('plan');
    const period = (params.get('period') as 'monthly' | 'yearly') || 'monthly';

    if (checkoutStatus === 'success' && currentWorkspace?.id) {
      if (sessionId && sessionId.startsWith('test_ls_') && planSlug) {
        completeSimulatedCheckoutAction({ workspaceId: currentWorkspace.id, planSlug, billingPeriod: period, sessionId })
          .then((res) => {
            if (res.success) {
              setCheckoutBannerMsg(`Payment verified! Your workspace is now upgraded to the ${planSlug.toUpperCase()} plan.`);
              setCurrentWorkspace((prev) => (prev ? { ...prev, plan: planSlug as any } : prev));
              getWorkspaceBillingAndUsageAction(currentWorkspace.id)
                .then((b) => {
                  if (b) {
                    setSubscriptionInfo({
                      status: b.subscription.status,
                      trialDaysRemaining: b.trialDaysRemaining,
                      isTrialExpired: b.isTrialExpired,
                    });
                  }
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      } else {
        setCheckoutBannerMsg('Lemon Squeezy payment completed! Your subscription and workspace features are now active.');
      }
      // Clean URL query params
      const cleanUrl = window.location.pathname + (target ? `?settings=${target}` : '');
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [handleOpenSettingsSection, currentWorkspace?.id]);

  // Listen for UpgradeModal navigation events
  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ view?: string; tab?: string }>).detail;
      if (detail?.view === 'settings' && detail?.tab === 'billing') {
        handleOpenSettingsSection('billing');
      }
    };
    window.addEventListener('zentry:navigate-view', handleNavigateEvent);
    return () => window.removeEventListener('zentry:navigate-view', handleNavigateEvent);
  }, [handleOpenSettingsSection]);

  // Team alert emails link to /dashboard?conversation=<id>. RLS decides
  // whether it loads; an id from another workspace simply shows nothing.
  const openLinkedConversation = useCallback(
    async (id: string) => {
      setActiveView('inbox');
      setSelectedConversationId(id);
      if (isBackendAuthenticated()) {
        try {
          const backendConv = await getBackendConversationById(id);
          if (backendConv) {
            setConversations((prev) => (prev.some((c) => c.id === id) ? prev : [backendConv, ...prev]));
          }
        } catch (e) {
          console.warn('[Dashboard] openLinkedConversation failed:', e);
        }
        return;
      }
      const wsId = currentWorkspaceIdRef.current;
      if (!wsId) return;
      try {
        const data = await getDashboardConversationAction(wsId, id);
        if (data) {
          setConversations((prev) => (prev.some((c) => c.id === id) ? prev : [data, ...prev]));
        }
      } catch (e) {
        console.warn('[Dashboard] openLinkedConversation failed:', e);
      }
    },
    []
  );
  const linkedConversationOpened = useRef(false);
  useEffect(() => {
    // Once, after the first load: the initial conversation list would
    // otherwise replace the one the link put at the top.
    if (loading || linkedConversationOpened.current) return;
    const id = new URLSearchParams(window.location.search).get('conversation');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    linkedConversationOpened.current = true;
    const timer = window.setTimeout(() => void openLinkedConversation(id), 0);
    return () => window.clearTimeout(timer);
  }, [loading, openLinkedConversation]);

  const handleOpenTickets = useCallback((target: { viewId?: string; ticketId?: string }) => {
    setTicketsRequest({ ...target, nonce: Date.now() });
    setActiveView('tickets');
  }, []);

  // 2. Fetch Messages for Active Conversation with Instant In-Memory Cache
  const loadMessages = useCallback(async (conversationId: string) => {
    // 1. Instant Cache Hit: Show messages immediately (0ms perceived lag)
    if (messagesCacheRef.current[conversationId]) {
      setMessages(messagesCacheRef.current[conversationId]);
      setIsMessagesLoading(false);
    } else {
      setIsMessagesLoading(true);
    }

    if (isBackendAuthenticated()) {
      try {
        const backendMsgs = await getBackendMessages(conversationId);
        messagesCacheRef.current[conversationId] = backendMsgs;
        if (selectedConversationIdRef.current === conversationId) {
          setMessages(backendMsgs);
        }
        try {
          await markBackendMessagesRead(conversationId);
        } catch {}
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  unread_count: 0,
                  last_message:
                    c.last_message ||
                    (backendMsgs.length > 0 ? backendMsgs[backendMsgs.length - 1] : null),
                }
              : c
          )
        );
      } catch (err) {
        console.error('[Dashboard] Backend loadMessages error:', err);
      } finally {
        setIsMessagesLoading(false);
      }
      return;
    }

    // 2. Fetch fresh messages via Server Action
    const wsId = currentWorkspaceIdRef.current;
    if (!wsId) {
      setIsMessagesLoading(false);
      return;
    }

    let fetchedMessages: Message[] = [];
    try {
      fetchedMessages = await listDashboardMessagesAction(wsId, conversationId);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setIsMessagesLoading(false);
      return;
    }

    messagesCacheRef.current[conversationId] = fetchedMessages;

    // Only update active state if the agent is still viewing this conversation
    if (selectedConversationIdRef.current === conversationId) {
      setMessages(fetchedMessages);
      setIsMessagesLoading(false);
    }

    // Immediately clear unread_count for the opened conversation in UI state
    // while keeping last_message intact so conversation list ordering does not jump
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              unread_count: 0,
              last_message:
                c.last_message ||
                (fetchedMessages.length > 0
                  ? fetchedMessages[fetchedMessages.length - 1]
                  : null),
            }
          : c
      )
    );
  }, []);

  // 3. Fetch/Refresh Conversations (Pages of 30, ordered by updated_at)
  const refreshConversations = useCallback(
    async (wsId?: string, pageNum: number = 0, isAppend: boolean = false) => {
      const targetWsId = wsId || currentWorkspaceIdRef.current;
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setIsRefreshing(true);
      }

      if (isBackendAuthenticated()) {
        try {
          const convs = await getBackendConversations({ status: 'all', page: pageNum + 1, limit: PAGE_SIZE });
          if (isAppend) {
            setConversations((prev) => [...prev, ...convs]);
          } else {
            setConversations(convs);
          }
          setHasMore(convs.length >= PAGE_SIZE);
          setLastSynced(new Date());
          setConversationsError(null);
        } catch (err: any) {
          console.error('[Dashboard] Backend refreshConversations failed:', err);
          setConversationsError(err.message || 'Conversations could not be loaded.');
        } finally {
          setIsRefreshing(false);
          setLoadingMore(false);
        }
        return;
      }
      try {
        if (!targetWsId) return;
        const { conversations: rawConvs, hasMore: nextHasMore } =
          await listDashboardConversationsAction(targetWsId, pageNum, PAGE_SIZE);
        setConversationsError(null);
        setHasMore(nextHasMore);

        if (rawConvs.length === 0 && !isAppend) {
          setConversations([]);
          setLastSynced(new Date());
          return;
        }

        const knownLastMessage = new Map(
          conversationsRef.current.map((c) => [c.id, c.last_message] as const)
        );
        const enrichedConversations: Conversation[] = rawConvs.map((c) => {
          const isCurrentlySelected = selectedConversationIdRef.current === c.id;
          return {
            ...c,
            last_message: c.last_message || knownLastMessage.get(c.id) || null,
            unread_count: isCurrentlySelected ? 0 : (c.unread_count || 0),
          };
        });

        if (isAppend) {
          setPage(pageNum);
          setConversations((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newItems = enrichedConversations.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newItems];
          });
        } else {
          setPage(0);
          // Preserve currently active conversation so chat never drops or backs out
          setConversations((prev) => {
            const currentSelectedId = selectedConversationIdRef.current;
            if (currentSelectedId) {
              const existingCurrent = prev.find((c) => c.id === currentSelectedId);
              if (existingCurrent && !enrichedConversations.some((c) => c.id === currentSelectedId)) {
                enrichedConversations.unshift(existingCurrent);
              }
            }
            return enrichedConversations;
          });

          // Desktop opens the newest thread; phones start on the list.
          const isPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
          if (!selectedConversationIdRef.current && enrichedConversations.length > 0 && !isPhone) {
            setSelectedConversationId(enrichedConversations[0].id);
          } else if (selectedConversationIdRef.current) {
            loadMessages(selectedConversationIdRef.current);
          }
        }
        setLastSynced(new Date());
      } catch (err: any) {
        console.error('Failed to refresh conversations:', err);
        setConversationsError(err?.message || 'Conversations could not be loaded.');
      } finally {
        setIsRefreshing(false);
        setLoadingMore(false);
      }
    },
    [loadMessages]
  );

  // Infinite Scroll: Load Next Page of 30
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    refreshConversations(undefined, page + 1, true);
  }, [loadingMore, hasMore, page, refreshConversations]);

  // Bulk Action 1: Resolve Selected Conversations
  const handleBulkResolve = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const nowIso = new Date().toISOString();
      if (isBackendAuthenticated()) {
        await bulkUpdateBackendConversations({ ids, action: 'resolve' });
      } else if (currentWorkspaceIdRef.current) {
        await bulkUpdateDashboardConversationsAction(currentWorkspaceIdRef.current, {
          ids,
          action: 'resolve',
        });
      }

      setConversations((prev) =>
        prev.map((c) => (ids.includes(c.id) ? { ...c, status: 'closed', closed_at: nowIso } : c))
      );
    },
    []
  );

  // Bulk Action 2: Assign Selected Conversations to Agent
  const handleBulkAssign = useCallback(
    async (ids: string[], agentId: string | null) => {
      if (ids.length === 0) return;
      const nowIso = new Date().toISOString();
      const assignedAgent = allAgents.find((a) => a.id === agentId) || null;
      if (isBackendAuthenticated()) {
        await bulkUpdateBackendConversations({ ids, action: 'assign', agentId });
      } else if (currentWorkspaceIdRef.current) {
        await bulkUpdateDashboardConversationsAction(currentWorkspaceIdRef.current, {
          ids,
          action: 'assign',
          agentId,
        });
      }

      setConversations((prev) =>
        prev.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                assigned_agent_id: agentId,
                agent_id: agentId,
                agent: assignedAgent || undefined,
                updated_at: nowIso,
              }
            : c
        )
      );
    },
    [allAgents]
  );

  // Bulk Action 3: Mark Selected Conversations as Spam
  const handleBulkMarkSpam = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const nowIso = new Date().toISOString();
      if (isBackendAuthenticated()) {
        await bulkUpdateBackendConversations({ ids, action: 'spam' });
      } else if (currentWorkspaceIdRef.current) {
        await bulkUpdateDashboardConversationsAction(currentWorkspaceIdRef.current, {
          ids,
          action: 'spam',
        });
      }

      setConversations((prev) =>
        prev.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                status: 'closed',
                closed_at: nowIso,
                tags: c.tags?.includes('spam') || c.tags?.includes('Spam') ? c.tags : [...(c.tags || []), 'spam'],
                updated_at: nowIso,
              }
            : c
        )
      );
    },
    []
  );

  // 4. Refresh Visitors
  const refreshVisitors = async (wsId?: string) => {
    if (isBackendAuthenticated()) {
      try {
        const backendVisitors = await getBackendContacts({ limit: 300 });
        setVisitors(backendVisitors);
      } catch (e) {
        console.warn('[Dashboard] refreshVisitors failed:', e);
      }
      return;
    }
    const targetWsId = wsId || currentWorkspaceIdRef.current;
    if (!targetWsId) return;
    try {
      const vData = await listDashboardVisitorsAction(targetWsId);
      setVisitors(vData);
    } catch (error) {
      console.error('Failed to fetch visitors:', error);
    }
  };

  useEffect(() => {
    if (selectedConversationId) {
      if (isBackendAuthenticated()) {
        backendRealtimeRef.current?.joinConversation(selectedConversationId);
      }
      loadMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
  }, [selectedConversationId, loadMessages]);

  // 5. Supabase Realtime Subscriptions
  // Conversations and visitors are filtered to this workspace on the server.
  // Unfiltered, every visitor heartbeat on every customer site reached every
  // open dashboard (and Realtime ran an RLS check for each one), which is what
  // made the inbox sluggish as the platform grew.
  const realtimeWorkspaceId = currentWorkspace?.id;
  useEffect(() => {
    if (!realtimeWorkspaceId) return;

    if (isBackendAuthenticated()) {
      let cancelled = false;
      let isSocketConnected = false;
      let socketUnavailable = false;
      let pollInterval: ReturnType<typeof setInterval> | null = null;

      const schedulePollInterval = (intervalMs: number) => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(async () => {
          if (cancelled || document.visibilityState !== 'visible' || isSocketConnected) return;
          try {
            await refreshConversations();
            if (selectedConversationIdRef.current) {
              const freshMsgs = await getBackendMessages(selectedConversationIdRef.current);
              setMessages((prev) => {
                if (
                  freshMsgs.length !== prev.length ||
                  (freshMsgs.length > 0 && freshMsgs[freshMsgs.length - 1]?.id !== prev[prev.length - 1]?.id)
                ) {
                  return freshMsgs;
                }
                return prev;
              });
            }
          } catch {}
        }, intervalMs);
      };

      const rt = createBackendRealtimeClient({
        onConnect: () => {
          isSocketConnected = true;
          socketUnavailable = false;
          schedulePollInterval(15000);
          if (selectedConversationIdRef.current) {
            rt?.joinConversation(selectedConversationIdRef.current);
          }
        },
        onDisconnect: () => {
          isSocketConnected = false;
        },
        onConnectError: () => {
          isSocketConnected = false;
          if (!socketUnavailable) {
            socketUnavailable = true;
            schedulePollInterval(5000);
          }
        },
        onMessageNew: (rawMsg: any) => {
          if (cancelled || !rawMsg?.id) return;
          const newMsg = mapBackendMessage(rawMsg);
          const convId = newMsg.conversation_id;

          if (messagesCacheRef.current[convId]) {
            if (!messagesCacheRef.current[convId].some((m) => m.id === newMsg.id)) {
              messagesCacheRef.current[convId] = [...messagesCacheRef.current[convId], newMsg];
            }
          }

          if (convId === selectedConversationIdRef.current) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.sender_type === 'visitor' && document.hasFocus()) {
              markBackendMessagesRead(convId).catch(() => {});
            }
          }

          if (newMsg.sender_type === 'visitor' && !newMsg.is_internal) {
            const isViewingFocused =
              convId === selectedConversationIdRef.current && document.hasFocus();
            if (!isViewingFocused) {
              sound.playIncomingMessage();
              sendBrowserNotification(
                'New Customer Message',
                newMsg.content || 'Sent an attachment',
                { tag: `msg-${convId}` },
              );
            }
          }

          let foundConv = false;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convId) return c;
              foundConv = true;
              const isViewing = convId === selectedConversationIdRef.current && document.hasFocus();
              return {
                ...c,
                last_message: newMsg.is_internal ? c.last_message : newMsg,
                updated_at: newMsg.created_at || new Date().toISOString(),
                unread_count:
                  newMsg.sender_type === 'visitor' && !isViewing
                    ? (c.unread_count || 0) + 1
                    : c.unread_count || 0,
              };
            })
          );

          if (!foundConv) {
            void refreshConversations();
          }
        },
        onMessageUpdated: (rawMsg: any) => {
          if (cancelled || !rawMsg?.id) return;
          const updatedMsg = mapBackendMessage(rawMsg);
          const convId = updatedMsg.conversation_id;
          if (messagesCacheRef.current[convId]) {
            messagesCacheRef.current[convId] = messagesCacheRef.current[convId].map((m) =>
              m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m
            );
          }
          if (convId === selectedConversationIdRef.current) {
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
            );
          }
        },
        onMessageDeleted: (payload) => {
          if (cancelled || !payload?.id) return;
          const convId = payload.conversationId;
          if (convId && messagesCacheRef.current[convId]) {
            messagesCacheRef.current[convId] = messagesCacheRef.current[convId].filter(
              (m) => m.id !== payload.id
            );
          }
          if (!convId || convId === selectedConversationIdRef.current) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.id));
          }
        },
        onMessageRead: (payload: any) => {
          if (cancelled || !payload?.conversationId) return;
          if (payload.conversationId === selectedConversationIdRef.current) {
            const readAt = payload.readAt || new Date().toISOString();
            setMessages((prev) =>
              prev.map((m) => (m.read_at ? m : { ...m, read_at: readAt }))
            );
          }
        },
        onConversationCreated: (payload: any) => {
          if (cancelled) return;
          sound.playNewConversation();
          sendBrowserNotification(
            'New Conversation',
            payload?.visitor?.name ? `New chat from ${payload.visitor.name}` : 'A visitor started a new conversation',
            { tag: payload?.id ? `conv-${payload.id}` : undefined },
          );
          void refreshConversations();
        },
        onConversationUpdated: (payload: any) => {
          if (cancelled) return;
          const targetId = payload?.conversationId || payload?.id;
          if (!targetId) {
            void refreshConversations();
            return;
          }
          if (payload.handoff_status === 'waiting_for_agent') {
            sound.playIncomingMessage();
            sendBrowserNotification(
              'Human Handoff Requested',
              'A customer conversation is waiting for an agent.',
              { tag: `handoff-${targetId}` },
            );
          }
          let matched = false;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== targetId) return c;
              matched = true;
              const nextLast = payload.lastMessage
                ? mapBackendMessage(payload.lastMessage)
                : c.last_message;
              return {
                ...c,
                ...(payload.status !== undefined ? { status: payload.status } : {}),
                ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
                ...(payload.ai_mode !== undefined ? { ai_mode: payload.ai_mode } : {}),
                ...(payload.ai_enabled !== undefined ? { ai_enabled: payload.ai_enabled } : {}),
                ...(payload.ai_paused_reason !== undefined ? { ai_paused_reason: payload.ai_paused_reason } : {}),
                ...(payload.handoff_status !== undefined ? { handoff_status: payload.handoff_status } : {}),
                ...(payload.assigned_agent_id !== undefined
                  ? {
                      assigned_agent_id: payload.assigned_agent_id,
                      agent_id: payload.assigned_agent_id,
                    }
                  : {}),
                ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
                ...(payload.closed_at !== undefined ? { closed_at: payload.closed_at } : {}),
                ...(payload.updated_at !== undefined ? { updated_at: payload.updated_at } : {}),
                last_message: nextLast,
              };
            })
          );
          if (!matched) {
            void refreshConversations();
          }
        },
        onPresenceUpdate: ({ userId, status }) => {
          if (cancelled || !userId) return;
          setAllAgents((prev) =>
            prev.map((a) => (a.id === userId ? { ...a, status } : a)),
          );
        },
      });

      backendRealtimeRef.current = rt;

      // Fallback safety sync when Socket.IO is disconnected or backend runs in stateless HTTP mode
      schedulePollInterval(rt ? 15000 : 5000);

      return () => {
        cancelled = true;
        if (pollInterval) clearInterval(pollInterval);
        rt?.disconnect();
        if (backendRealtimeRef.current === rt) {
          backendRealtimeRef.current = null;
        }
      };
    }

    let cancelled = false;
    const poll = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      void refreshConversations(realtimeWorkspaceId);
      void refreshVisitors(realtimeWorkspaceId);
    };

    const pollTimer = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeWorkspaceId]);

  // Re-sync the list and open thread when returning to a tab or reconnecting.
  useEffect(() => {
    let lastSync = Date.now();
    const sync = (minGapMs: number) => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSync < minGapMs) return;
      if (!currentWorkspaceIdRef.current) return;
      lastSync = Date.now();
      refreshConversations();
    };
    const onVisible = () => sync(5_000);
    const onOnline = () => sync(0);
    const heartbeat = setInterval(() => sync(15_000), 15_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [refreshConversations]);

  // 6. Action Handlers
  /**
   * The thread passes the conversation it is actually showing. Reading
   * `selectedConversationId` here instead was a second source of truth, and
   * when it was momentarily null the send returned silently — the composer had
   * already cleared the text, so the reply vanished with no error and no
   * message. Every failure path now throws so the caller can restore the draft.
   */
  const handleSendMessage = async (
    content: string,
    isInternal: boolean = false,
    conversationId?: string,
    replyToId?: string | null,
    attachmentUrl?: string | null,
    metadata?: Record<string, any> | null
  ) => {
    const targetId = conversationId || selectedConversationIdRef.current;
    if (!targetId) {
      throw new Error('No conversation selected — reply not sent.');
    }
    if (!currentAgent) {
      throw new Error('Your session expired — reload and try again.');
    }
    const target = conversations.find((c) => c.id === targetId);
    if (!isInternal) {
      if (target && isAiAnswering(target, currentWorkspaceRef.current)) {
        throw new Error('AI autopilot is replying to this conversation — take over to reply.');
      }
    }

    const shouldAutoAssign = !isInternal && target && (!target.agent_id && !target.assigned_agent_id);

    if (shouldAutoAssign) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? { ...c, agent_id: currentAgent.id, assigned_agent_id: currentAgent.id, agent: currentAgent }
            : c
        )
      );
    }

    if (isBackendAuthenticated()) {
      try {
        const sentMsg = await sendBackendMessage(targetId, {
          content,
          isInternal,
          attachmentUrl,
          replyToId,
        });
        if (sentMsg && sentMsg.conversation_id === selectedConversationIdRef.current) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === sentMsg.id)) return prev;
            return [...prev, sentMsg];
          });
        }
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  ...c,
                  last_message: sentMsg,
                  updated_at: new Date().toISOString(),
                  ...(shouldAutoAssign ? { agent_id: currentAgent.id, assigned_agent_id: currentAgent.id, agent: currentAgent } : {}),
                }
              : c
          )
        );
        return;
      } catch (err) {
        console.error('[Dashboard] Backend send message error:', err);
        throw err;
      }
    }

    const wsId = currentWorkspaceRef.current?.id || currentWorkspaceIdRef.current;
    if (!wsId) {
      throw new Error('Workspace not loaded');
    }

    const { message: insertedMsg, newStatus, now } = await sendDashboardMessageAction(wsId, {
      conversationId: targetId,
      content,
      isInternal,
      replyToId,
      attachmentUrl,
      metadata,
      shouldAutoAssign,
    });

    // Immediately display the note/reply in the thread
    if (insertedMsg && insertedMsg.conversation_id === selectedConversationIdRef.current) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === insertedMsg.id)) return prev;
        return [...prev, insertedMsg];
      });
    }

    if (!isInternal) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                status: newStatus || (c.status === 'closed' ? 'closed' : 'pending'),
                ai_mode: 'disabled',
                ai_paused_reason: 'human_reply',
                ai_needs_attention_at: null,
                last_message: insertedMsg || c.last_message,
                channel_metadata: {
                  ...((c.channel_metadata as Record<string, any>) || {}),
                  last_human_reply_at: now,
                },
                ...(shouldAutoAssign ? { agent_id: currentAgent.id, assigned_agent_id: currentAgent.id, agent: currentAgent } : {}),
              }
            : c
        )
      );

      // Real-time Reinforcement Learning: Learn from human agent's verified reply in this workspace
      if (currentWorkspaceRef.current?.id && insertedMsg?.id && content?.trim()) {
        fetch('/api/ai/reinforce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: currentWorkspaceRef.current.id,
            conversationId: targetId,
            agentMessageId: insertedMsg.id,
            agentContent: content,
          }),
        }).catch((err) => {
          console.warn('[Reinforce] Background learning failed:', err);
        });
      }
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                last_message: insertedMsg || c.last_message,
                ...(shouldAutoAssign ? { agent_id: currentAgent.id, assigned_agent_id: currentAgent.id, agent: currentAgent } : {}),
              }
            : c
        )
      );
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!currentAgent) {
      throw new Error('Your session expired — reload and try again.');
    }

    const nowIso = new Date().toISOString();

    // 1. Optimistic local state update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: newContent,
              metadata: {
                ...(m.metadata || {}),
                is_edited: true,
                edited_at: nowIso,
              },
            }
          : m
      )
    );

    if (selectedConversationId && messagesCacheRef.current[selectedConversationId]) {
      messagesCacheRef.current[selectedConversationId] = messagesCacheRef.current[
        selectedConversationId
      ].map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: newContent,
              metadata: {
                ...(m.metadata || {}),
                is_edited: true,
                edited_at: nowIso,
              },
            }
          : m
      );
    }

    // 2. Persist edit in NestJS backend or via Server Action
    if (isBackendAuthenticated() && selectedConversationId) {
      try {
        await editBackendMessage(selectedConversationId, messageId, newContent);
      } catch (error) {
        console.error('Error editing message:', error);
        loadMessages(selectedConversationId);
        throw error;
      }
      return;
    }

    const wsId = currentWorkspaceRef.current?.id || currentWorkspaceIdRef.current;
    if (!wsId || !selectedConversationId) return;
    try {
      await editDashboardMessageAction(wsId, selectedConversationId, messageId, newContent);
    } catch (error) {
      console.error('Error editing message:', error);
      loadMessages(selectedConversationId);
      throw error;
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentAgent) {
      throw new Error('Your session expired — reload and try again.');
    }

    // 1. Optimistic local state removal
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (selectedConversationId && messagesCacheRef.current[selectedConversationId]) {
      messagesCacheRef.current[selectedConversationId] = messagesCacheRef.current[
        selectedConversationId
      ].filter((m) => m.id !== messageId);
    }

    // 2. Delete row from NestJS backend or via Server Action
    if (isBackendAuthenticated() && selectedConversationId) {
      try {
        await deleteBackendMessage(selectedConversationId, messageId);
      } catch (error) {
        console.error('Error deleting message:', error);
        loadMessages(selectedConversationId);
        throw error;
      }
      refreshConversations();
      return;
    }

    const wsId = currentWorkspaceRef.current?.id || currentWorkspaceIdRef.current;
    if (!wsId || !selectedConversationId) return;
    try {
      await deleteDashboardMessageAction(wsId, selectedConversationId, messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      loadMessages(selectedConversationId);
      throw error;
    }

    refreshConversations();
  };

  const handleUpdatePriority = async (priority: ConversationPriority) => {
    if (!selectedConversationId) return;

    if (isBackendAuthenticated()) {
      try {
        await updateBackendConversation(selectedConversationId, { priority });
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversationId ? { ...c, priority, updated_at: new Date().toISOString() } : c))
        );
      } catch (e) {
        console.error('[Dashboard] update priority error:', e);
      }
      return;
    }

    const wsId = currentWorkspaceRef.current?.id || currentWorkspaceIdRef.current;
    if (!wsId) return;
    try {
      await updateDashboardConversationAction(wsId, selectedConversationId, { priority });
    } catch (error) {
      console.error('Error updating conversation priority:', error);
      return;
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversationId ? { ...c, priority } : c))
    );
  };

  const handleUpdateTags = async (tags: string[]) => {
    if (!selectedConversationId) return;

    if (isBackendAuthenticated()) {
      try {
        await updateBackendConversation(selectedConversationId, { tags });
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversationId ? { ...c, tags, updated_at: new Date().toISOString() } : c))
        );
      } catch (e) {
        console.error('[Dashboard] update tags error:', e);
      }
      return;
    }

    const wsId = currentWorkspaceRef.current?.id || currentWorkspaceIdRef.current;
    if (!wsId) return;
    try {
      await updateDashboardConversationAction(wsId, selectedConversationId, { tags });
    } catch (error) {
      console.error('Error updating conversation tags:', error);
      return;
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversationId ? { ...c, tags } : c))
    );
  };

  const handleUpdateStatus = async (status: ConversationStatus) => {
    if (!selectedConversationId) return;

    if (isBackendAuthenticated()) {
      try {
        await updateBackendConversation(selectedConversationId, { status });
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversationId ? { ...c, status, updated_at: new Date().toISOString() } : c))
        );
      } catch (e) {
        console.error('[Dashboard] update status error:', e);
      }
      return;
    }

    const wsId = currentWorkspaceRef.current?.id || currentWorkspaceIdRef.current;
    if (!wsId) return;

    const currentConv = conversations.find((c) => c.id === selectedConversationId);
    const wasPausedBeforeReopen =
      status === 'open' && currentConv?.status === 'closed' && currentConv?.ai_mode === 'disabled';

    const updates: Partial<Conversation> = {
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    try {
      await updateDashboardConversationAction(wsId, selectedConversationId, {
        status,
        closed_at: updates.closed_at,
        ...(wasPausedBeforeReopen
          ? {
              ai_mode: 'disabled' as const,
              ai_paused_reason: currentConv?.ai_paused_reason || 'agent_paused',
            }
          : {}),
      });
    } catch (error) {
      console.error('Error updating conversation status:', error);
      return;
    }

    if (wasPausedBeforeReopen) {
      Object.assign(updates, {
        ai_mode: 'disabled' as const,
        ai_paused_reason: currentConv?.ai_paused_reason || ('agent_paused' as const),
      });
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversationId ? { ...c, ...updates } : c))
    );
  };

  const handleAssignAgent = async (agentId: string | null) => {
    if (!selectedConversationId) return;

    if (isBackendAuthenticated()) {
      try {
        await assignBackendConversation(selectedConversationId, agentId);
        const assignedAgent = allAgents.find((a) => a.id === agentId) || null;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId
              ? { ...c, agent_id: agentId, assigned_agent_id: agentId, agent: assignedAgent, updated_at: new Date().toISOString() }
              : c
          )
        );
      } catch (e) {
        console.error('[Dashboard] assign agent error:', e);
      }
      return;
    }

    const wsId = currentWorkspaceRef.current?.id || currentWorkspaceIdRef.current;
    if (!wsId) return;
    try {
      await updateDashboardConversationAction(wsId, selectedConversationId, {
        agent_id: agentId,
        assigned_agent_id: agentId,
      });
    } catch (error) {
      console.error('Error assigning agent:', error);
      return;
    }

    const assignedAgent = allAgents.find((a) => a.id === agentId) || null;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? { ...c, agent_id: agentId, assigned_agent_id: agentId, agent: assignedAgent }
          : c
      )
    );
  };

  const handleUpdateAgentStatus = async (status: AgentStatus) => {
    if (!currentAgent) return;

    if (isBackendAuthenticated()) {
      setCurrentAgent((prev) => (prev ? { ...prev, status } : null));
      try {
        await updateBackendAgentStatus(status);
      } catch (e) {
        console.warn('[Dashboard] Failed to persist backend agent status:', e);
      }
      return;
    }

    if (!currentWorkspace?.id) return;
    try {
      const { waitingQueueCount } = await updateAgentStatusAction(currentWorkspace.id, status);
      setCurrentAgent((prev) => (prev ? { ...prev, status } : null));
      if (status === 'online' && waitingQueueCount > 0) {
        toast.show(`${waitingQueueCount} chat${waitingQueueCount > 1 ? 's are' : ' is'} waiting in the queue`, 'info');
      }
    } catch (error) {
      console.error('Error updating agent status:', error);
    }
  };
  // The inactivity timer above calls the latest version of this.
  handleUpdateAgentStatusRef.current = handleUpdateAgentStatus;

  const handleOpenConversationForVisitor = async (visitorId: string) => {
    let existing = conversations.find((c) => c.visitor_id === visitorId);
    if (!existing) {
      if (isBackendAuthenticated()) {
        try {
          const created = await createBackendConversation({ visitorId });
          if (created) {
            existing = created;
            setConversations((prev) => [existing!, ...prev]);
          }
        } catch (e) {
          console.error('[Dashboard] createBackendConversation failed:', e);
        }
      } else if (currentWorkspace?.id) {
        try {
          const created = await startDashboardConversationAction(currentWorkspace.id, visitorId);
          if (created) {
            existing = created;
            setConversations((prev) => [existing!, ...prev]);
          }
        } catch (e) {
          console.error('[Dashboard] startDashboardConversationAction failed:', e);
        }
      }
    }

    if (existing) {
      setSelectedConversationId(existing.id);
      setActiveView('inbox');
    }
  };

  const handleLogout = async () => {
    backendRealtimeRef.current?.disconnect();
    backendRealtimeRef.current = null;
    if (currentAgent && currentWorkspace?.id && !isBackendAuthenticated()) {
      await updateAgentStatusAction(currentWorkspace.id, 'offline').catch(() => {});
    }
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'local' }),
      });
    } catch {
      // ignore
    }
    clearAuthSession();
    router.replace('/login');
  };

  const activeConversation = conversations.find((c) => c.id === selectedConversationId);

  const isAdmin =
    currentAgent?.role === 'admin' || currentAgent?.role === 'owner';

  const counts = {
    open: conversations.filter((c) => c.status === 'open').length,
    liveVisitors: visitors.filter((v) => isVisitorOnline(v)).length,
    articles: articlesCount,
    unanswered: unansweredCount,
    handovers: conversations.filter(isWaitingForPerson).length,
    teamUnread: teamInbox.unread,
    teamUrgent: teamInbox.urgent,
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-canvas flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 flex items-center justify-center animate-breathe">
          <img
            src="/logo.png"
            alt="Loading"
            className="w-full h-full object-contain filter drop-shadow-sm"
          />
        </div>
        <p className="text-ui font-medium text-ink-3">Loading workspace…</p>
      </div>
    );
  }

  const handleExitSuperAdminView = async () => {
    await exitSuperAdminWorkspaceViewAction();
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-[var(--app-vvh,100dvh)] w-screen overflow-hidden bg-canvas relative">
      {/* Super Admin Switch Banner */}
      {isViewingAsSuperAdmin && (
        <div className="bg-accent text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-between shadow-md z-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-warn animate-ping" />
            <ShieldAlert className="w-4 h-4 text-warn" />
            <span>
              Viewing as super admin: <strong className="underline underline-offset-2">{currentWorkspace?.name}</strong>{' '}
              <span className="opacity-80 font-mono text-2xs">({currentWorkspace?.id})</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/admin"
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors"
            >
              Super Admin Area
            </Link>
            <button
              onClick={handleExitSuperAdminView}
              className="px-3 py-1 rounded-lg bg-danger/80 hover:bg-danger text-ink-inv text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>Exit Super Admin View</span>
            </button>
          </div>
        </div>
      )}

      {/* Checkout Success Banner */}
      {checkoutBannerMsg && (
        <div className="bg-success text-white px-6 py-2 text-xs font-semibold flex items-center justify-between shadow-sm z-40 shrink-0">
          <span>{checkoutBannerMsg}</span>
          <button
            type="button"
            onClick={() => setCheckoutBannerMsg(null)}
            className="text-white/80 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Free Tier / Trial Status Banner */}
      <TrialBanner
        workspace={currentWorkspace}
        trialDaysRemaining={subscriptionInfo?.trialDaysRemaining}
        isTrialExpired={subscriptionInfo?.isTrialExpired}
        onUpgradeClick={() => handleOpenSettingsSection('billing')}
      />

      {/* Office Hours Started Reminder Banner (Phase 2) */}
      {showOfficeHoursAwayBanner && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-ink px-4 py-2 text-xs flex items-center justify-between z-40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Office hours have started and customers may request human support.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleUpdateAgentStatus('online')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-xs transition-colors cursor-pointer"
            >
              Go Online
            </button>
            <button
              type="button"
              onClick={() => setDismissedOfficeHoursBanner(true)}
              className="text-ink-3 hover:text-ink text-xs p-1 cursor-pointer"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Enable Sound & Notifications Banner (Phase 3) */}
      {needsAudioUnlock && !audioNotificationAlertDismissed && (
        <div className="bg-sky-500/15 border-b border-sky-500/30 text-ink px-4 py-2 text-xs flex items-center justify-between z-40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🔔</span>
            <span>Enable sound and notifications to receive incoming chat alerts.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnableAudioNotifications}
              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded font-medium text-xs transition-colors cursor-pointer"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => setAudioNotificationAlertDismissed(true)}
              className="text-ink-3 hover:text-ink text-xs p-1 cursor-pointer"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
      {/* 1. Left Sidebar Navigation (Desktop) */}
      <div
        className={cn(
          'h-screen shrink-0',
          selectedConversationId ? 'hidden md:flex' : 'hidden md:flex'
        )}
      >
        <Sidebar
          currentAgent={currentAgent}
          workspace={currentWorkspace}
          activeView={activeView}
          onSelectView={setActiveView}
          counts={counts}
          onUpdateAgentStatus={handleUpdateAgentStatus}
          onLogout={handleLogout}
          onOpenShortcuts={() => setShowShortcutsModal(true)}
          onOpenMobileInstall={() => setShowMobileInstallModal(true)}
          hasVisitors={visitors.length > 0}
        />
      </div>

      {/* 2. Middle & Right Content Area based on activeView */}
      {activeView === 'inbox' && (
        <div className="flex-1 flex overflow-hidden w-full">
          {/* Conversation List: full width on mobile when no conversation active */}
          <div
            className={cn(
              'h-full shrink-0 flex flex-col min-w-0',
              selectedConversationId
                ? 'hidden md:flex md:w-[310px] xl:w-[330px]'
                : 'flex w-full md:w-[310px] xl:w-[330px] pb-14 md:pb-0'
            )}
          >
            <div className="px-3 pt-2.5 pb-0">
              <MobileInstallBanner onOpenModal={() => setShowMobileInstallModal(true)} />
            </div>
            {conversationsError && (
              <div role="alert" className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-danger-line bg-danger-soft text-xs text-danger">
                <span className="flex-1">Couldn&apos;t refresh conversations: {conversationsError}</span>
                <button type="button" className="btn btn-xs btn-secondary" onClick={() => refreshConversations()}>
                  Retry
                </button>
              </div>
            )}
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={setSelectedConversationId}
              currentAgent={currentAgent}
              agentsList={allAgents}
              loading={loading}
              isRefreshing={isRefreshing}
              onRefresh={() => refreshConversations()}
              lastSynced={lastSynced}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
              onBulkResolve={handleBulkResolve}
              onBulkAssign={handleBulkAssign}
              onBulkMarkSpam={handleBulkMarkSpam}
              onOpenSimulator={handleOpenSimulator}
            />
          </div>

          {/* Chat Thread + Visitor CRM Sidebar */}
          {activeConversation ? (
            <div
              className={cn(
                'flex-1 min-w-0 flex overflow-hidden',
                selectedConversationId ? 'flex w-full' : 'hidden md:flex'
              )}
            >
              <ChatThread
                conversation={activeConversation}
                messages={messages}
                loading={isMessagesLoading}
                currentAgent={currentAgent}
                agentsList={allAgents}
                cannedResponses={cannedResponses}
                workspace={currentWorkspace}
                onOpenTicket={(ticketId) => handleOpenTickets({ ticketId })}
                onAskTeam={() => {
                  setTeamShare({
                    conversationId: activeConversation.id,
                    label: activeConversation.visitor?.name || activeConversation.visitor?.email || 'Customer',
                  });
                  setActiveView('team');
                }}
                onSendMessage={handleSendMessage}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onUpdateStatus={handleUpdateStatus}
                onAssignAgent={handleAssignAgent}
                onUpdatePriority={handleUpdatePriority}
                onUpdateTags={handleUpdateTags}
                onBack={handleMobileBack}
                isDetailsSidebarOpen={isDetailsSidebarOpen}
                onToggleDetailsSidebar={() => setIsDetailsSidebarOpen((prev) => !prev)}
                onOpenMissingKnowledge={() => setActiveView('unanswered')}
                onMerged={async () => {
                  await refreshConversations();
                  if (selectedConversationId) {
                    await loadMessages(selectedConversationId);
                  }
                }}
                aiAnswering={isAiAnswering(activeConversation, currentWorkspace)}
                onToggleAiMode={async (mode) => {
                  if (!selectedConversationId) return;
                  const now = new Date().toISOString();
                  const metaUpdate = {
                    ...((activeConversation?.channel_metadata as Record<string, any>) || {}),
                    ...(mode === 'autopilot' ? { autopilot_enabled_at: now } : {}),
                    ...(mode === 'disabled' ? { ai_disabled_at: now } : {}),
                  };
                  const isAutopilot = mode === 'autopilot';
                  const dbUpdates: Record<string, any> = {
                    ai_mode: mode,
                    updated_at: now,
                    channel_metadata: metaUpdate,
                    ...(isAutopilot
                      ? {
                          ai_paused_reason: null,
                          ai_needs_attention_at: null,
                          ai_resumed_at: now,
                        }
                      : {
                          ai_paused_reason: 'agent_paused',
                        }),
                  };
                  if (isBackendAuthenticated()) {
                    await updateBackendConversation(selectedConversationId, {
                      aiMode: mode,
                      handoffStatus: isAutopilot ? 'bot_active' : undefined,
                    });
                  } else if (currentWorkspace?.id) {
                    await updateDashboardConversationAction(
                      currentWorkspace.id,
                      selectedConversationId,
                      dbUpdates
                    );
                  }

                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === selectedConversationId
                        ? { ...c, ...dbUpdates, ai_mode: mode, channel_metadata: metaUpdate }
                        : c
                    )
                  );
                }}
              />

              {isDetailsSidebarOpen && (
                <VisitorDetailsSidebar
                  visitor={activeConversation.visitor}
                  conversation={activeConversation}
                  workspace={currentWorkspace}
                  currentAgent={currentAgent}
                  onSelectConversation={setSelectedConversationId}
                  onUpdateTags={handleUpdateTags}
                  onClose={() => setIsDetailsSidebarOpen(false)}
                />
              )}
            </div>
          ) : (
            <div className="hidden md:flex flex-1 min-w-0 flex-col items-center justify-start p-4 sm:p-6 lg:p-8 bg-canvas text-center select-none overflow-y-auto w-full space-y-6">
              {/* Setup Checklist */}
              <SetupChecklist
                workspace={currentWorkspace}
                visitors={visitors}
                allAgents={allAgents}
                conversations={conversations}
                articlesCount={articlesCount}
                sectionsCount={sectionsCount}
                onNavigate={setActiveView}
                onOpenSettingsSection={handleOpenSettingsSection}
                onOpenSimulator={handleOpenSimulator}
                className="w-full max-w-xl text-left"
              />

              <div className="max-w-xl w-full p-5 sm:p-6 rounded-3xl border border-line bg-surface shadow-xs flex flex-col items-center animate-rise min-w-0">
                <div className="flex items-center justify-between w-full mb-3 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                      <Inbox className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink">Ready for conversations</h3>
                      <p className="text-xs text-ink-3">Live updates stream instantly as visitors arrive.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenSimulator}
                    className="btn btn-xs btn-primary gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Send test chat</span>
                  </button>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full mb-4">
                  <button
                    onClick={() => setActiveView('visitors')}
                    className="flex-1 min-w-[130px] btn btn-sm btn-secondary shadow-xs hover:border-line-2 gap-1.5"
                  >
                    <Radio className="w-3.5 h-3.5 text-success shrink-0" />
                    <span className="truncate">Live Radar ({counts.liveVisitors})</span>
                  </button>
                  <button
                    onClick={() => handleOpenSettingsSection('widget')}
                    className="flex-1 min-w-[130px] btn btn-sm btn-secondary shadow-xs hover:border-line-2 gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Widget Settings</span>
                  </button>
                </div>

                {/* Keyboard Quick Guide */}
                <div className="w-full pt-3 border-t border-line/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs text-ink-3 text-left">
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-2">
                    <span>Search inbox</span>
                    <span className="kbd text-2xs">/</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-2">
                    <span>Shortcuts</span>
                    <span className="kbd text-2xs">?</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-2">
                    <span>Saved Replies</span>
                    <span className="kbd text-2xs">/</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-2">
                    <span>Send Message</span>
                    <span className="kbd text-2xs">Ctrl ↵</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'visitors' && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <LiveVisitorsRadar
            visitors={visitors}
            workspace={currentWorkspace}
            onOpenConversationForVisitor={handleOpenConversationForVisitor}
            onOpenTicket={(ticketId) => handleOpenTickets({ ticketId })}
            onRefresh={() => refreshVisitors()}
          />
        </div>
      )}

      {activeView === 'reports' && currentWorkspace && currentAgent && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <ReportsDashboard
            workspace={currentWorkspace}
            currentAgent={currentAgent}
            onOpenSettings={(sec) => handleOpenSettingsSection(sec as SectionId)}
            onOpenInbox={() => setActiveView('inbox')}
          />
        </div>
      )}

      {activeView === 'team' && currentWorkspace && currentAgent && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <TeamChat
            workspaceId={currentWorkspace.id}
            currentAgent={currentAgent}
            agents={allAgents}
            inbox={teamInbox}
            share={teamShare}
            onClearShare={() => setTeamShare(null)}
            requestedThread={teamThreadRequest}
            onOpenConversation={(id) => void openLinkedConversation(id)}
            conversationLabel={(id) => {
              const c = conversationsRef.current.find((x) => x.id === id);
              return c ? c.visitor?.name || c.visitor?.email || 'Customer' : null;
            }}
            onOpenThreadChange={onTeamThreadChange}
          />
        </div>
      )}

      {activeView === 'tickets' && currentWorkspace && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <TicketsView workspaceId={currentWorkspace.id} request={ticketsRequest} />
        </div>
      )}

      {activeView === 'helpdesk' && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <HelpDeskDashboard
            workspace={currentWorkspace}
            currentAgent={currentAgent}
            onArticlesCountChange={(c) => {
              setArticlesCount(c);
              if (currentWorkspace?.id) {
                void getHelpSectionsCountAction(currentWorkspace.id)
                  .then((count) => {
                    if (count !== null && count !== undefined) setSectionsCount(count);
                  })
                  .catch(() => {});
              }
            }}
          />
        </div>
      )}

      {activeView === 'handovers' && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <HandoversView
            workspace={currentWorkspace}
            currentAgent={currentAgent}
            waitingCount={counts.handovers}
            onOpenConversation={(id) => void openLinkedConversation(id)}
          />
        </div>
      )}

      {activeView === 'unanswered' && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <UnansweredQuestionsView
            workspace={currentWorkspace}
            currentAgent={currentAgent}
            onSelectConversation={(convId) => {
              setSelectedConversationId(convId);
              setActiveView('inbox');
            }}
          />
        </div>
      )}

      {activeView === 'settings' && (
        <div className="flex-1 flex overflow-hidden w-full pb-14 md:pb-0">
          <SettingsHub
            workspace={currentWorkspace}
            currentAgent={currentAgent}
            agents={allAgents}
            cannedResponses={cannedResponses}
            hasVisitors={visitors.length > 0}
            latestVisitorUrl={visitors[0]?.current_url}
            initialSection={settingsInitialSection}
            sectionNonce={settingsNonce}
            onWorkspaceUpdated={(ws) => setCurrentWorkspace(ws)}
            onNavigate={(view) => setActiveView(view as typeof activeView)}
          />
        </div>
      )}

      {/* 3. Mobile bottom navigation — mirrors the desktop rail exactly, so
          the app has one navigation model rather than two. */}
      {!selectedConversationId && (
        <nav aria-label="Main" className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface border-t border-line flex items-stretch px-1 z-40 pb-[env(safe-area-inset-bottom)]">
          {(
            [
              ['inbox', 'Inbox', Inbox, true],
              ['handovers', 'Waiting', Hand, true],
              ['tickets', 'Tickets', Ticket, true],
              ['team', 'Team', MessagesSquare, true],
              ['visitors', 'Visitors', Radio, true],
              // Charts need a wide screen; on a phone the slot goes to team chat.
              ['reports', 'Reports', BarChart2, false],
              ['helpdesk', 'Help', BookOpen, true],
              ['settings', 'Settings', Settings, true],
            ] as [View, string, typeof Inbox, boolean][]
          )
            .filter(([, , , visible]) => visible)
            .map(([view, label, Icon]) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                aria-current={activeView === view ? 'page' : undefined}
                className={cn(
                  'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-lg text-2xs font-medium transition-colors',
                  activeView === view ? 'text-accent font-semibold' : 'text-ink-3'
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </button>
            ))}

          <button
            onClick={() => setShowMobileInstallModal(true)}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-lg text-2xs font-medium text-ink-3 hover:text-accent transition-colors"
            title="Mobile App Shortcut"
          >
            <Smartphone className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>App</span>
          </button>
        </nav>
      )}

      {currentWorkspace && (
        <DashboardCommandPalette
          workspaceId={currentWorkspace.id}
          isAdmin={isAdmin}
          onNavigate={(view) => {
            setSelectedConversationId(null);
            setActiveView(view);
          }}
          onOpenTicketView={(viewId) => handleOpenTickets({ viewId })}
          onOpenTicket={(ticketId) => handleOpenTickets({ ticketId })}
          onOpenSettings={handleOpenSettingsSection}
          onShowShortcuts={() => setShowShortcutsModal(true)}
        />
      )}

      {/* 4. Global Keyboard Shortcuts Cheatsheet Modal */}
      {showShortcutsModal && (
        <KeyboardShortcutsModal isOpen onClose={() => setShowShortcutsModal(false)} />
      )}

      {/* 5. Mobile App & Shortcut Installer Modal */}
      {showMobileInstallModal && (
        <MobileInstallModal isOpen onClose={() => setShowMobileInstallModal(false)} />
      )}

      {/* 6. Global Upgrade & Lemon Squeezy Checkout Modal */}
      <UpgradeModal
        workspaceId={currentWorkspace?.id}
        onNavigateToBilling={() => handleOpenSettingsSection('billing')}
      />

      {/* 7. AI -> Human Handoff Ringing Modal (Phase 3) */}
      <RingingHandoffModal
        payload={ringingPayload}
        onClose={() => setRingingPayload(null)}
        onAccepted={(conversationId) => {
          setSelectedConversationId(conversationId);
          setActiveView('inbox');
        }}
      />
      {/* close modal */}
      <span className="hidden"
      />
      </div>
    </div>
  );
}
