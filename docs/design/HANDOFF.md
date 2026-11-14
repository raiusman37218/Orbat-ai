# ORBAT AI: design handoff

This folder is the complete ORBAT design, ready for Claude Code to implement in a real codebase.

## What is in `design/`

- One `.dc.html` file per screen (44 files). Each file is a design component with three parts:
  - `<helmet>`: the CSS (tokens, fonts, styles)
  - the markup between `<x-dc>` and `</x-dc>`: `{{name}}` is a value, `<sc-for list="{{x}}" as="i">` is a loop, `<sc-if value="{{x}}">` is a condition, `<dc-import name="Sidebar">` places another component
  - `class Component extends DCLogic` at the bottom: sample data, state and click handlers
- `canvas.json`: the list of screens and their titles.
- These files are a **visual and behaviour reference**. Rebuild them as real components in your stack. Do not copy the `.dc.html` runtime.

## Design tokens

```css
:root {
  /* brand */
  --lime: #9FE870;        /* primary buttons, active nav, highlights */
  --lime-hover: #CDFFAD;
  --forest: #163300;      /* text on lime, dark sections, structure */
  --forest-2: #21420C;
  --mint: #E2F6D5;        /* soft green surfaces, badges, selected rows */
  --ai: #6D3FD6;          /* violet = AI only (Nova, AI drafts, AI badges) */
  --ai-soft: #F1ECFD;

  /* neutrals */
  --text: #0E0F0C;  --text-2: #454745;  --text-3: #6A6C6A;
  --bg: #FFFFFF;    --surface: #FFFFFF; --surface-2: #F2F4EF; --surface-3: #E3E6DF;
  --border: #E3E5E0; --border-strong: #C9CCC5;

  /* status */
  --ok: #1C7C45;   --ok-soft: #E7F4EC;
  --warn: #A4510B; --warn-soft: #FDF2E3;
  --bad: #BF2F28;  --bad-soft: #FCEBEA;
}
```

Dark mode exists in each app file under `.orb.dark`. Keep violet for AI only, so users always know who is speaking.

## Typography

| Use | Font | Size / weight |
|---|---|---|
| Marketing display (landing, help center hero) | Inter Tight | 64–112px, 900, UPPERCASE, line-height 0.86 |
| App page title | Inter Tight | 30px, 800 |
| Topbar title | Inter Tight | 18px, 800 |
| Card title | Inter | 15–18px, 700 |
| Body | Inter | 15px app, 16–18px marketing |
| Numbers | Inter with `font-variant-numeric: tabular-nums` | |

Fonts: Google Fonts `Inter` (400–700) and `Inter Tight` (700–900). Wise Sans is proprietary; Inter Tight is the stand-in.

## Components (Wise-style sizing)

- **Primary button**: lime background, forest text, pill (`border-radius: 9999px`), 40–48px high, 600 weight. Hover: `#CDFFAD` and scale 1.03.
- **Secondary button**: white, 1px border, pill. **Ghost**: `rgba(22,51,0,.08)` background, pill.
- **Input / select**: 40–48px, radius 12px, focus ring 3px `--mint`, border `--forest`.
- **Card**: white, 1px `--border`, radius 20–24px, padding 20–24px.
- **Sidebar**: white, 272px wide, items 44px high, 15.5px text, 22px icons, pill shape. Active item: lime background, forest text. Group labels 12.5px `--text-3`. Usage or trial card at the bottom, profile row last.
- **Topbar**: 64px, breadcrumb (section › page), pill search that opens a ⌘K command palette, theme toggle, notifications dropdown, help.
- **Badges**: pill, 12–13px, soft background with matching text colour.
- **Tables**: uppercase 11.5px headers, 56px rows.

## Screen map → suggested routes

| Design file | Route | Notes |
|---|---|---|
| Landing | `/` | public marketing |
| Pricing | `/pricing` | public |
| Auth | `/login`, `/signup`, `/verify`, `/forgot`, `/sso` | email code verification |
| Onboarding | `/onboarding` | 9 steps incl. connect data + trial/plan choice |
| Checkout | `/checkout` | card, PayPal, JazzCash, Easypaisa, bank transfer |
| Welcome | `/app/getting-started` | trial dashboard + checklist |
| Trial | modal + `/app/trial-ended` | 3-days-left modal, expired lock |
| Main | `/app` | overview |
| Inbox | `/app/inbox` | compact 64px sidebar |
| Tickets | `/app/tickets` | |
| Customers | `/app/customers` | CRM |
| Voice | `/app/calls` | |
| AIAgents | `/app/agents` | |
| AgentTemplates | `/app/agents/templates` | |
| AgentBuilder | `/app/agents/[id]` | builder + playground |
| AITrust | `/app/ai-quality` | |
| Languages | `/app/languages` | |
| Knowledge | `/app/knowledge` | |
| Automation | `/app/automation` | |
| Journey | `/app/automation/journeys` | |
| Engagement | `/app/engagement` | |
| Analytics | `/app/analytics` | |
| Team | `/app/team` | |
| Schedule | `/app/team/schedule` | office hours, on-call |
| Compliance | `/app/compliance` | |
| PolicyGuardrail | `/app/compliance/policies` | |
| WebsiteAudit | `/app/compliance/website-audit` | |
| Handoff | `/app/handoff` | rules + live ping |
| Channels | `/app/channels` | |
| CRMConnect | `/app/channels/connect` | |
| Billing | `/app/billing` | |
| Settings | `/app/settings` | |
| Emails | `/app/settings/emails` | |
| Profile | `/app/profile` | |
| SuperAdmin | `/admin` | platform owner only |
| HelpCenter | `/help` (per workspace domain) | public, tenant-branded |
| CustomerPortal | `/help/requests` | customer's tickets |
| ChatWidget | embeddable widget | separate bundle |
| States | 404, 403, maintenance, offline, failover, empty, session expired | |
| MobileApp, MobileInbox | responsive layouts / mobile app | |
| Sidebar, Topbar, DesignSystem | shared components and reference | |

## Placeholders to replace before launch

`[PRICE]`, `[TOTAL]`, `[TAX]`, `[N]`, `[BANK ACCOUNT DETAILS]`, `[YOUR BUSINESS ADDRESS]`, the landing page numbers (63%, 38s, …), compliance badges (only show certifications you hold), and the fictional logo strip.
