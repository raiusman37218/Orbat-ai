# Backend gaps for the new UI

Every screen, field, action or endpoint the new UI needs that the backend does not have yet. Each row matches a `TODO(backend)` comment in `src/lib/data/` or `src/lib/mock/`. When a gap is closed, switch the data function to the real backend and delete the row.

| Area | What is missing | Data function | Shown in the UI as |
|---|---|---|---|
| Shell | In-app notification feed: a per-agent list (handoffs, mentions, SLA warnings, AI events) with read state, plus "mark all read". Push and email notifications exist (`/api/notifications/*`), but nothing stores a list. | `listNotifications`, `markAllNotificationsRead` in `src/lib/data/notifications.ts` | Bell dropdown always shows "You're all caught up" |

## Not wired yet (backend exists)

These have a backend; they are just not connected in the new UI yet. They are done in the data-layer step, not here.

- Sidebar badges (open inbox, tickets): `listDashboardConversationsAction`, `getViewCountsAction`.
- Sidebar usage / trial card: `getWorkspaceBillingAndUsageAction`, `getWorkspaceSubscriptionAction`.
- Command palette search over conversations, customers and tickets: `listDashboardConversationsAction`, NestJS `contacts`, `searchTicketsAction`.
