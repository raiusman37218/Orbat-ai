# Backend gaps for the new UI

Every screen, field, action or endpoint the new UI needs that the backend does not have yet. Each row matches a `TODO(backend)` comment in `src/lib/data/` or `src/lib/mock/`. When a gap is closed, switch the data function to the real backend and delete the row.

| Area | What is missing | Data function | Shown in the UI as |
|---|---|---|---|
| Shell | In-app notification feed: a per-agent list (handoffs, mentions, SLA warnings, AI events) with read state, plus "mark all read". Push and email notifications exist (`/api/notifications/*`), but nothing stores a list. | `listNotifications`, `markAllNotificationsRead` in `src/lib/data/notifications.ts` | Bell dropdown always shows "You're all caught up" |
| Auth | Password reset: an endpoint that emails a time-limited reset link, and a page that accepts the token and sets a new password. | `requestPasswordReset` in `src/lib/data/auth.ts` | `/v2/forgot` says reset isn't available yet and to ask the workspace owner |
| Auth | Single sign-on (SAML/OIDC per workspace). | `startSso` in `src/lib/data/auth.ts` | `/v2/sso` says SSO isn't available yet |
| Auth | Microsoft sign-in. | `getAuthProviders` (`microsoft: false`) | Microsoft button hidden |
| Auth | Email verification at sign-up. The design verifies the email with a 6-digit code before the workspace opens; the live sign-up (NestJS `/auth/signup`) creates the account and signs in at once. Separate code actions exist (`sendSignupVerificationCodeAction`, `verifySignupCodeAction`) but are not part of the NestJS flow. | `signUp` in `src/lib/data/auth.ts` | Sign-up goes straight to "Your workspace is ready"; no `/v2/verify` page |
| Auth | Two-factor code at sign-in. NestJS `/auth/login` does not ask for a TOTP code (the unused Next route `/api/auth/login` does). | `signIn` in `src/lib/data/auth.ts` | No "Two-step verification" step |
| Overview | Activity feed of support events (handoffs, solved tickets, failed workflows, published articles, low ratings). `workspace_audit_logs` only records settings changes, for admins. | `listRecentActivity` in `src/lib/data/overview.ts` | "Recent activity" shows "No activity feed yet" |
| Overview | Per-day split of resolved conversations into AI vs human. `/api/reports` gives new and solved per day, and AI totals only for the whole period. | `getOverviewReport` | Volume chart shows New vs Solved pairs instead of the AI / human / open stack |
| Overview | AI resolution rate per channel. `channelBreakdown` has counts only. | `getOverviewReport` | "By channel" shows share and count, no "AI x%" |
| Overview | Hourly buckets for a "Today" range. `/api/reports` buckets by day. | `OVERVIEW_RANGES` | Range picker offers 7 / 30 / 90 days, no "Today" |
| Overview | Several named AI agents (live / draft) with their own stats. There is one assistant with topic specialists (`ai_settings.sub_agents`) and no per-specialist resolution numbers. | `getOverviewReport` (bot totals) | One "AI assistant" row instead of an agent list |
| Inbox | Team inboxes on conversations (`group_id`). `ticket_groups` and `tickets.group_id` exist (`getTeamAction`), but `conversations` has no `group_id` column or team-inbox filter endpoint. | `listTeamGroups` in `src/lib/data/inbox.ts` | Team inboxes list workspace groups as read-only and link to Tickets instead of filtering conversations |
| Inbox | Saved filters / custom views for conversations (`ticket_views` and `saveTicketViewAction` exist only for tickets, not conversations). | `getInboxMeta` in `src/lib/data/inbox.ts` | Saved filters section shows an honest empty/unavailable state |
| Inbox | Per-conversation AI dollar cost, confidence score percentage, and lifetime per-customer CSAT / resolution aggregates. `copilot_events` tracks token counts at workspace level only. | `getConversationDetail`, `getCustomerContext` in `src/lib/data/inbox.ts` | Cost chip and fake confidence % are omitted; customer panel shows only real per-conversation values (`sentiment`, `csat_rating`, `first_agent_reply_at`) |
| Inbox | Storefront / Shopify order history in the customer drawer. No e-commerce order integration exists. | `getCustomerContext` in `src/lib/data/inbox.ts` | Orders card shows an unavailable state |
| Inbox | Conversation-level audit stream for the Timeline tab (`conversation_events` is queried inside `/api/reports`, with no per-conversation feed endpoint). | `buildConversationTimeline` in `src/lib/data/inbox.ts` | Timeline shows lifecycle timestamps, system messages, and linked `TicketEvent` rows only |
| Inbox | Voice note recording and audio playback (`/api/upload` accepts images, PDF, and TXT only; no audio transcription store). | `uploadInboxAttachment` in `src/lib/data/inbox.ts` | No voice recorder button; any audio URL renders as a file link |
| Inbox | Standalone customer profile notes mutation (no action updates `visitors.notes`; agent notes live as internal thread messages via `createInternalNoteAction`). | `getCustomerContext` in `src/lib/data/inbox.ts` | Customer drawer notes point to the composer's "Internal note" mode |
| Inbox | Server-side inbox view counts, full-text search, and server-side filtering across all conversations (`listDashboardConversationsAction` pages by 30). | `listInboxConversations` in `src/lib/data/inbox.ts` | View counts, filters, and sorting run over loaded conversations with a "Load older" button when `hasMore` is true |

## Not wired yet (backend exists)

These have a backend; they are just not connected in the new UI yet.

- Command palette search over conversations, customers and tickets: `listDashboardConversationsAction`, NestJS `contacts`, `searchTicketsAction`.
- Google sign-in lands on the old `/dashboard`: `/auth/callback` defaults `next` to `/dashboard`, and adding `?next=` to the Google redirect URI would have to match what is registered in Google Cloud. Switch the default at the cut-over.
