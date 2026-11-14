# Plan: replace the whole frontend, keep the backend

Goal: the old UI is fully replaced by the ORBAT design. The backend (database, API routes, auth, server code) stays exactly as it is. Where the design needs data the backend doesn't have yet, the UI uses a temporary mock that will be swapped for a real API later.

## How it works

1. **Build the new UI next to the old one.** New pages live in a separate folder (for Next.js App Router: a route group such as `app/(new)/...`, or a temporary `/v2` prefix). The old UI keeps working while you build.
2. **One data layer between UI and backend.** Every screen gets its data through `lib/data/<area>.ts` (for example `lib/data/inbox.ts`). Each function either:
   - calls an **existing** API or database query (real), or
   - returns **typed mock data** from `lib/mock/` with a `// TODO(backend): ...` comment (temporary).
   The UI never knows which one it is. Later you only change the data layer, never the screens.
3. **Track the gaps.** Claude keeps `docs/design/BACKEND_GAPS.md` up to date: every screen, field, action or endpoint that is still mocked. This becomes your to-do list for the backend later.
4. **Cut over.** When all screens are done, switch the routes from old to new, delete the old UI files and the temporary prefix.

## Prompts for Claude Code (in order)

### 1. Audit (no changes)
```
Read docs/design/HANDOFF.md, docs/design/REPLACE_PLAN.md and docs/design/CLAUDE.md.
We are replacing the ENTIRE frontend with this design and keeping the backend unchanged.
Explore the codebase and report:
- stack, routing, styling, auth flow, how pages get data today (API routes, server actions, direct DB calls)
- every existing page and which design screen it maps to
- every existing API route / query and which design screen can use it
- design screens with no backend support at all
Then propose the folder structure for the new UI and the data layer. Do not write code yet.
```

### 2. Foundation
```
Set up the new UI foundation: design tokens, Inter + Inter Tight fonts, dark mode,
the shared components (Button, Input, Select, Textarea, Badge, Card, Tabs, Toggle, Avatar,
Table, Modal, Toast, EmptyState, Skeleton) and the app shell (Sidebar + Topbar + ⌘K palette)
in the new route group. Do not touch old pages or any backend code.
```

### 3. Data layer
```
Create lib/data/ with one file per area (overview, inbox, tickets, customers, agents,
knowledge, automation, engagement, analytics, team, compliance, channels, billing, settings, auth).
For each function, use the existing backend if it exists; otherwise return typed mock data
from lib/mock/ (based on the sample data in the design files) and add a TODO(backend) comment.
Create docs/design/BACKEND_GAPS.md listing every mocked function.
Do not change any backend files.
```

### 4. Screens (repeat, one screen per prompt)
```
Build the <Inbox> screen in the new UI from docs/design/design/Inbox.dc.html.
Match it exactly, including empty, loading and error states. Get all data through lib/data/inbox.ts.
Wire every button to the existing backend where possible; otherwise to the mock, and add it to BACKEND_GAPS.md.
```
Order: Auth → Onboarding → Overview (Main) → Inbox → Tickets → Customers → Calls → AI Agents → Templates → Builder → AI quality → Languages → Knowledge → Automation → Journeys → Engagement → Analytics → Team → Schedule → Compliance → Policies → Website audit → Handoff → Channels → CRM connect → Billing → Checkout → Settings → Emails → Profile → Getting started → Trial → States → Super admin → Landing → Pricing → Help center → Customer portal → Chat widget → Mobile layouts.

### 5. Cut over
```
All new screens are done. Switch every route to the new UI, redirect old URLs to the new ones,
delete the old UI components and pages that are no longer used, and remove the temporary
route prefix. Make sure the build passes and nothing in the backend changed (show git diff for backend folders).
```

### 6. Later: backend
```
Open docs/design/BACKEND_GAPS.md. For each item, propose the database schema change and API
route, wait for my approval, implement it, then switch the matching lib/data function from mock to real.
```
