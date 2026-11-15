# New UI: progress and handoff

Read this first if you are picking up the ORBAT frontend rebuild (any agent or person). It says what is done, how it is built, how to run it, and exactly what to do next. Last updated 2026-11-14. All work is on `main`.

Also read, in this order: `CLAUDE.md` (repo rules; its "New UI" section takes precedence for UI work), `docs/design/HANDOFF.md` (tokens, typography, screen → route map), `docs/design/REPLACE_PLAN.md` (the overall plan), `docs/design/BACKEND_GAPS.md` (what the backend can't do yet).

## The goal

Replace the whole frontend with the ORBAT design in `docs/design/design/*.dc.html` and **keep the backend unchanged**: no edits to the database, migrations, `backend/` (NestJS), `src/app/api/**`, server actions' logic, auth or `src/proxy.ts` unless the owner asks. The new UI runs next to the old one until a cut-over.

## Status

| Step | State | Where |
|---|---|---|
| Audit of the existing app | Done | (in this file, "How the backend looks today") |
| Foundation: tokens, fonts, dark mode, shared components, app shell | Done | `src/components/orbat/` |
| Auth screens (`Auth.dc.html`) | Done | `/login`, `/signup`, `/forgot`, `/sso` |
| Overview (`Main.dc.html`) | Done | `/app` |
| Sidebar badges, usage / trial card | Done | `src/components/orbat/shell/Sidebar.tsx` |
| Inbox (`Inbox.dc.html`, `MobileInbox.dc.html`) | Done | `/app/inbox` (`src/components/orbat/inbox/`, `src/lib/data/inbox.ts`) |
| Landing (`Landing.dc.html`) | Done | `/` (`src/components/orbat/landing/`, `src/app/(orbat)/page.tsx`) |
| Tickets (`Tickets.dc.html`) | Done | `/app/tickets` (`src/components/orbat/tickets/`, `src/lib/data/tickets.ts`, `src/app/actions/tickets.ts`) |
| Customers (`Customers.dc.html`) | Done | `/app/customers` (`src/components/orbat/customers/`, `src/lib/data/customers.ts`, `src/app/actions/customers.ts`, `backend/src/contacts/`) |
| Calls / Voice (`Voice.dc.html`) | Done | `/app/calls` (`src/components/orbat/calls/`, `src/lib/data/calls.ts`, `src/app/actions/voice.ts`, `src/app/api/channels/voice/webhook/route.ts`) |
| AI Agents (`Agents.dc.html`) | Done | `/app/agents` (`src/components/orbat/agents/AiAgentsScreen.tsx`, `src/lib/data/agents.ts`, `src/app/actions/ai-agents.ts`) |
| Agent templates (`AgentTemplates.dc.html`) | Done | `/app/agents/templates` (`src/components/orbat/agents/AgentTemplatesScreen.tsx`, `src/lib/ai/agent-templates.ts`) |
| Agent builder (`AgentBuilder.dc.html`) | Done | `/app/agents/new`, `/app/agents/[id]` (`src/components/orbat/agents/AgentBuilderScreen.tsx`, `src/lib/ai/agent-runtime.ts`, `backend/src/ai-engine/`) |
| AI quality & trust (`AiQuality.dc.html`) | Done | `/app/ai-quality` (`src/components/orbat/ai-quality/AiQualityScreen.tsx`, `src/lib/data/ai-quality.ts`, `src/app/actions/ai-quality.ts`) |
| Languages (`Languages.dc.html`) | Done | `/app/languages` (`src/components/orbat/languages/LanguagesScreen.tsx`, `src/lib/data/languages.ts`, `src/app/actions/ai-languages.ts`) |
| Knowledge (`Knowledge.dc.html`) | Done | `/app/knowledge` (`src/components/orbat/knowledge/KnowledgeScreen.tsx`, `src/lib/data/knowledge.ts`, `src/app/actions/knowledge-hub.ts`) |
| Automation Studio (`Automation.dc.html`) | Done | `/app/automation` (`src/components/orbat/automation/AutomationScreen.tsx`, `src/lib/data/automation.ts`, `src/app/actions/automation-studio.ts`, `src/lib/automation/workflow-templates.ts`) |
| Customer Journeys (`Journey.dc.html`) | Done | `/app/automation/journeys` (`/app/journeys` redirects; `src/components/orbat/journeys/JourneysScreen.tsx`, `src/lib/data/journeys.ts`, `src/app/actions/journeys.ts`) |
| Engagement (`Engagement.dc.html`) | Done | `/app/engagement` (`src/components/orbat/engagement/EngagementScreen.tsx`, `src/lib/data/engagement.ts`, `src/app/actions/engagement.ts`, `backend/src/widget/widget.service.ts`) |
| Analytics & Reports (`Analytics.dc.html`) | Done | `/app/analytics` (`src/components/orbat/analytics/AnalyticsScreen.tsx`, `src/lib/data/analytics.ts`, `src/app/actions/analytics-studio.ts`) |
| Team & Command Center (`Team.dc.html`) | Done | `/app/team` (`src/components/orbat/team/TeamScreen.tsx`, `src/lib/data/team.ts`, `src/app/actions/team-studio.ts`, `src/app/actions/team.ts`) |
| Office Hours & On-Call Schedule (`Schedule.dc.html`) | Done | `/app/team/schedule` (`src/components/orbat/team/ScheduleScreen.tsx`, `src/lib/data/schedule.ts`, `src/app/actions/schedule.ts`, `src/lib/schedule/hours.ts`) |
| Compliance Center (`Compliance.dc.html`) | Done | `/app/compliance` (`src/components/orbat/compliance/ComplianceScreen.tsx`, `src/lib/data/compliance.ts`, `src/app/actions/compliance.ts`, `src/lib/compliance/policy-evaluator.ts`, `backend/src/ai-engine/ai-engine.service.ts`) |
| Policy to Guardrails (`PolicyGuardrail.dc.html`) | Done | `/app/compliance/policies` (`src/components/orbat/compliance/PoliciesScreen.tsx`, `src/app/actions/compliance.ts`) |
| Website Compliance Audit (`WebsiteAudit.dc.html`) | Done | `/app/compliance/website-audit` (`src/components/orbat/compliance/WebsiteAuditScreen.tsx`, `src/app/actions/website-audit.ts`) |
| AI to Human Handoff (`Handoff.dc.html`) | Done | `/app/handoff` (`src/components/orbat/handoff/HandoffScreen.tsx`, `src/lib/data/handoff.ts`, `src/app/actions/handoff.ts`, `backend/src/widget/widget.service.ts`) |
| Channels & Apps (`Channels.dc.html`) | Done | `/app/channels` (`src/components/orbat/channels/ChannelsScreen.tsx`, `src/lib/data/channels.ts`, `src/app/actions/channels-studio.ts`) |
| Connect Website & CRM (`CRMConnect.dc.html`) | Done | `/app/channels/connect` (`/app/crm` redirects; `src/components/orbat/channels/CrmConnectScreen.tsx`, `src/app/actions/channels-studio.ts`) |
| Billing & Usage (`Billing.dc.html`) | Done | `/app/billing` (`src/components/orbat/billing/BillingScreen.tsx`, `src/lib/data/billing.ts`, `src/app/actions/billing-studio.ts`) |
| Checkout (`Checkout.dc.html`) | Done | `/checkout` (`/v2/checkout` redirects; `src/components/orbat/billing/CheckoutScreen.tsx`, `src/app/actions/billing-studio.ts`) |
| Workspace Settings (`Settings.dc.html`) | Done | `/app/settings` (`src/components/orbat/settings/SettingsScreen.tsx`, `src/lib/data/settings.ts`, `src/app/actions/settings-studio.ts`) |
| Transactional Emails (`Emails.dc.html`) | Done | `/app/settings/emails` (`/app/emails` redirects; `src/components/orbat/settings/EmailsScreen.tsx`, `src/app/actions/settings-studio.ts`) |
| Agent Profile (`Profile.dc.html`) | Done | `/app/profile` (`src/components/orbat/profile/ProfileScreen.tsx`, `src/lib/data/profile.ts`, `src/app/actions/profile.ts`) |
| Getting started (`Welcome.dc.html`) | Done | `/app/getting-started` (`src/components/orbat/lifecycle/GettingStartedScreen.tsx`, `src/lib/data/getting-started.ts`, `src/app/actions/lifecycle-studio.ts`) |
| Trial & Upgrade (`Trial.dc.html`) | Done | `/app/trial`, `/app/trial-ended` (`src/components/orbat/lifecycle/TrialScreen.tsx`, `src/lib/data/trial.ts`, `src/app/actions/lifecycle-studio.ts`) |
| System States & Health (`States.dc.html`) | Done | `/app/states` (`src/components/orbat/lifecycle/StatesScreen.tsx`, `src/lib/data/states.ts`, `src/app/actions/lifecycle-studio.ts`) |
| Platform Super Admin (`SuperAdmin.dc.html`) | Done | `/admin` (`/admin/workspaces`, `plans`, `ai`, etc. redirect via `?tab=`; `src/components/orbat/admin/SuperAdminScreen.tsx`, `src/lib/data/super-admin.ts`, `src/app/actions/admin-studio.ts`) |
| Pricing & PAYG (`Pricing.dc.html`) | Done | `/pricing` (`src/components/orbat/public/PricingScreen.tsx`, `src/lib/data/pricing.ts`, `src/app/actions/public-portal.ts`) |
| Public Help Center (`HelpCenter.dc.html`) | Done | `/help`, `/help/[workspaceId]`, `/help/[workspaceId]/[articleId]` (`src/components/orbat/public/HelpCenterScreen.tsx`, `src/lib/data/help-center.ts`, `src/app/actions/public-portal.ts`) |
| Customer Portal (`CustomerPortal.dc.html`) | Done | `/portal`, `/help/requests` (`src/components/orbat/public/CustomerPortalScreen.tsx`, `src/lib/data/customer-portal.ts`, `src/app/actions/public-portal.ts`) |
| Chat Widget Studio (`ChatWidget.dc.html`) | Done | `/widget` (`?workspaceId=<id>` keeps standalone `/widget.js` frame; `src/components/orbat/public/ChatWidgetStudioScreen.tsx`, `src/lib/data/chat-widget.ts`, `src/app/actions/public-portal.ts`, `backend/src/workspaces/`) |
| Onboarding Wizard (`Onboarding.dc.html`) | Done | `/onboarding` (`src/components/orbat/onboarding/OnboardingWizardScreen.tsx`, `src/lib/data/onboarding.ts`, `src/app/actions/lifecycle-studio.ts`) |
| Every planned screen (Phases 1–6) | Done | All 40 ORBAT screens built |
| Cut-over (new UI on the real URLs, old UI/routes cleaned) | Done | All 40 ORBAT screens live on root URLs (`/`, `/pricing`, `/help`, `/portal`, `/widget`, `/onboarding`, `/admin`, `/checkout`, `/app/*`); `/v2/*` & `/dashboard/*` redirect seamlessly; Command Palette (`⌘K`) live entity search wired |

All 7 phases (Foundation + Phases 1–6 + Phase 7 Final Cut-Over) are complete.

## How the new UI is built

### Routes
- `src/app/(orbat)/layout.tsx` wraps every new page in `<div class="orb">` and loads Inter + Inter Tight. The ORBAT tokens only exist inside `.orb`, so old pages are untouched.
- `/app/*` (`src/app/(orbat)/app/`): the signed-in app. `layout.tsx` calls `requireShellSession()` (`src/lib/data/session.ts`), which redirects to `/login` or `/onboarding`, then renders `AppShell`.
- Legacy `/v2/*` URLs cleanly redirect in `src/proxy.ts` to their root ORBAT URLs (`/`, `/pricing`, `/help`, `/portal`, `/widget`, `/onboarding`, `/admin`, `/checkout`, `/login`, `/signup`, `/forgot`, `/sso`) preserving query parameters.
- `/app/design-system`: live gallery of every shared component (development only, 404 in production). Check new components there.

### Styling
- Tokens: `src/components/orbat/orbat.css` (imported from `globals.css`). Use them through the Tailwind bridge: `bg-o-surface`, `text-o-text-2`, `border-o-border`, `bg-o-lime`, `text-o-ai-text`, `font-o-display`… Never hex values or Tailwind palette colours. If a colour is missing, add a token (light **and** dark) to `orbat.css` and the `@theme inline` block at its end.
- Component classes (`.o-btn`, `.o-input`, `.o-card`, `.o-badge`, …) live in `@layer components`, so Tailwind utilities on them still win.
- Dark mode is the existing `data-theme="dark"` on `<html>` (same switch as the old UI); the topbar toggle stores it as `orbat-theme`.
- Lime = primary action and active nav. Violet (`--ai`) = AI only. Buttons are pills, cards 20–24px radius, inputs 12px.

### Components (`src/components/orbat/`)
- `primitives/` (import from `@/components/orbat/primitives`): Button / ButtonLink, Field + Input / Select / Textarea, Card / CardHeader, Badge, Avatar, Skeleton / SkeletonRows, Tabs / TabPanel / Segmented / Toggle, Table, Modal / ConfirmDialog (native `<dialog>`), OrbToastProvider + `useOrbToast`, EmptyState / ErrorState / Alert.
- `shell/`: AppShell, Sidebar (272px; 64px rail on `/app/inbox`), Topbar, CommandPalette (⌘K), NotificationsMenu, PageContainer / PageHeader, `nav.ts` (one list drives sidebar, breadcrumb and palette; add new routes there), `session-context.tsx` (`useShellSession()` gives the agent and workspace to any screen).
- `auth/`, `overview/`: screen-specific pieces. **`overview/OverviewScreen.tsx` is the reference for how to build a screen.**

### Data layer (`src/lib/data/`)
- Screens get data **only** from here. Each file wraps existing server actions (`src/app/actions/*`), existing API routes (`/api/*`) or the NestJS client (`src/lib/api/*`) and returns view models from `types.ts` (or its own exported types), never raw rows.
- `useData(load, key)` (`use-data.ts`) is the one loading / error / reload pattern. Every section of a screen gets its own `useData`, so one failing source never blanks the page.
- Something the backend can't do: return an honest empty or "not available yet" result, add a `TODO(backend)` comment, and add a row to `docs/design/BACKEND_GAPS.md`. **Never show the design's sample data** (names, orders, numbers are fake).
- A `'use client'` data file can't be called from a Server Component. Pure helpers that both need go in a plain module (see `auth-rules.ts`).
- Existing files: `session.ts` (server), `auth.ts`, `auth-rules.ts`, `overview.ts`, `shell.ts`, `notifications.ts`, `use-data.ts`, `types.ts`.

### Every screen must have
Loading, empty and error states; light and dark; keyboard access and visible focus; `prefers-reduced-motion` respected (handled globally in `orbat.css`); a 390px layout with no horizontal scroll.

## How the backend looks today

CLAUDE.md now describes this, but in short: plain Postgres on Neon (no Supabase), reached from Next through `src/lib/pg/` (`createClient()` runs as the signed-in agent so RLS applies; `serviceClient()` bypasses it). A NestJS app in `backend/` serves auth, conversations, messages, contacts, inboxes, users, widget and AI under `/api/v1` plus Socket.IO. Sign-in goes to NestJS and sets the `orbat_access_token` cookie, which `sessionUser()` verifies with `JWT_SECRET`. Live views use `useWorkspaceLive` (socket + polling).

Most data for new screens already exists as server actions: `inbox.ts` (conversations, messages, claim / skip / return to AI, notes, visitor snapshot), `tickets.ts` (bootstrap, views, counts, list, update, reply, merge, search), `team.ts`, `helpdesk.ts`, `bot-knowledge.ts`, `knowledge.ts`, `unanswered.ts`, `automation.ts`, `sla.ts`, `channels.ts`, `email-channel.ts`, `settings.ts`, `admin.ts`, `plans.ts`, `api-keys.ts`, `webhooks.ts`, `copilot.ts`, `sub-agents.ts`, `trader-data.ts`, `platform*.ts` (super admin). Reports: `/api/reports`, `/api/analytics`.

Design screens with **no backend at all**: Calls / Voice, Journeys, Website audit, Policy guardrails, Agent templates, Customer portal (end customers seeing their tickets), Engagement campaigns, CRM connectors, local payment methods at checkout (only LemonSqueezy exists), forgot password, SSO, on-call schedules, a per-workspace email template editor, an agent playground. Build their UI with honest empty states and log each in BACKEND_GAPS.md.

## Run it locally

```bash
npm --prefix backend run start:dev
```

```bash
npm run dev
```

Then sign in at http://localhost:3000/login (or create a workspace at http://localhost:3000/signup); the new app is at http://localhost:3000/app.

- `.env.local` needs `DATABASE_URL`, `JWT_SECRET` (**the same value as `backend/.env`**, otherwise every session is rejected and `/app` loops back to login) and `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`. This was set up on 2026-11-14.
- Both env files point at the hosted Neon database: local runs read and **write real data**. Be careful with anything that sends messages or emails.
- Redis is optional locally (the backend falls back to in-memory queues).

## Checks before every commit

```bash
npx tsc --noEmit
```

```bash
npx eslint "src/components/orbat" "src/app/(orbat)" src/lib/data
```

Both must be clean (the repo-wide `npm run lint` already fails with old errors; don't add new ones). Then open the screen in the browser in light and dark and at 390px. `npm run build` is the production check; stop `npm run dev` first, they share `.next/`. If the build complains about a missing route under `.next/dev/types`, delete `.next/dev` and rebuild.

## Prompt for the next screen

Replace the screen name, design file and data file each time:

```
Build the Inbox screen at /app/inbox from docs/design/design/Inbox.dc.html.
Read docs/design/PROGRESS.md first and follow the Overview screen's pattern
(src/components/orbat/overview/OverviewScreen.tsx): primitives from
src/components/orbat/primitives, data only through a new src/lib/data/inbox.ts
that wraps existing server actions (src/app/actions/inbox.ts) and the realtime
hook (src/lib/realtime/use-workspace-live.ts). Loading, empty and error states
for every section; light and dark; 390px layout; keyboard access.
Anything the backend lacks: honest empty/unavailable state, a TODO(backend)
comment and a row in docs/design/BACKEND_GAPS.md. No fake or sample data.
Do not change any backend code. Run npx tsc --noEmit and the scoped eslint
before finishing, then update the Status table in docs/design/PROGRESS.md.
```

## Cut-over (last step)

When every screen is done: move remaining `/v2/*` pages (`/pricing`, `/help`, etc.) to their real URLs and `/dashboard` → `/app` (redirect old URLs), delete the `[...slug]` placeholder, the old pages and the old components no longer used, and show `git diff --stat` for `backend/`, `src/app/api/`, `src/app/actions/` and `supabase/` to prove the backend did not change. (`/`, `/login`, `/signup`, `/forgot`, `/sso` and `/auth/callback` default `/app` are already cut over.)

## Known issues and decisions

- Naming: the new UI says **ORBAT**; much of the old code, emails and CLAUDE.md say Zentry. The owner has not decided whether to rename everything.
- `CLAUDE.md` still says cron jobs read their URL and secret from "Supabase Vault"; not verified since the move to Neon.
- The root layout renders the marketing chat widget (`ZenTryChatSupport`) on every page except `/dashboard`, `/app`, `/admin`, `/help`, `/csat`, `/widget`, so it shows on `/v2/*` (as it does on the old `/login`).
- The root layout's inline theme script triggers a React dev warning ("Encountered a script tag…"). It predates the new UI and is harmless.
- Notifications bell, activity feed, password reset, SSO, Microsoft sign-in, sign-up email codes and 2FA at sign-in have no backend: see BACKEND_GAPS.md.
