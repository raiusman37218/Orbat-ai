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

## Not wired yet (backend exists)

These have a backend; they are just not connected in the new UI yet.

- Command palette search over conversations, customers and tickets: `listDashboardConversationsAction`, NestJS `contacts`, `searchTicketsAction`.
- Google sign-in lands on the old `/dashboard`: `/auth/callback` defaults `next` to `/dashboard`, and adding `?next=` to the Google redirect URI would have to match what is registered in Google Cloud. Switch the default at the cut-over.
