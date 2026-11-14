# Claude Code prompts, step by step

Copy this folder into your repo as `docs/design/`. Then paste these prompts one by one in Claude Code, from the repo root. Finish and check each step before the next one. Commit after every step.

---

## Step 0: Understand the existing system (no code changes)

```
Read docs/design/HANDOFF.md and skim the files in docs/design/design/.
Then explore this codebase and tell me:
1. The stack (framework, styling, component library, auth, database).
2. Which ORBAT screens already exist here, and their routes and files.
3. Which screens are missing.
4. A step-by-step migration plan that keeps the app working after every step.
Do not change any code yet.
```

## Step 1: Tokens, fonts and base styles

```
Implement the design tokens from docs/design/HANDOFF.md in this project
(CSS variables in the global stylesheet, plus the Tailwind theme if we use Tailwind).
Add the Inter and Inter Tight fonts. Add dark mode using the .orb.dark values found in
docs/design/design/Main.dc.html. Don't change any page layouts yet.
Show me the diff before applying.
```

## Step 2: Shared UI components

```
Build reusable components that match docs/design/design/DesignSystem.dc.html and the
"Components" section of HANDOFF.md: Button (primary lime pill, secondary, ghost, danger),
Input, Select, Textarea, Badge, Card, Tabs, Toggle, Avatar, Table, Modal, Toast,
EmptyState. Put them in our existing components folder and follow our naming conventions.
Make sure they are accessible (focus rings, labels, aria).
```

## Step 3: App shell

```
Rebuild the app layout to match docs/design/design/Sidebar.dc.html and Topbar.dc.html:
white 272px sidebar with grouped nav, active lime pill, badges, usage/trial card and profile row;
64px topbar with breadcrumb, ⌘K command palette, theme toggle and notifications dropdown.
Inbox uses the compact 64px sidebar. Wire the nav links to our real routes.
```

## Step 4: Restyle existing screens, one at a time

Repeat for each screen that already exists:

```
Restyle our <Inbox> page to match docs/design/design/Inbox.dc.html exactly
(layout, spacing, typography, states, empty/loading states).
Keep all existing data fetching, API calls and business logic. Only change the UI.
Replace the sample data in the design with our real data.
When done, list anything in the design that our backend does not support yet.
```

Suggested order: Overview → Inbox → Tickets → Customers → AI Agents → Knowledge → Settings → Team → Analytics → others.

## Step 5: Build the missing screens

```
Build the <Checkout> page from docs/design/design/Checkout.dc.html at route /checkout.
Use our existing components and data layer. If it needs new database tables or API routes,
propose the schema and endpoints first and wait for my approval.
```

## Step 6: Public pages

```
Build the public landing page from docs/design/design/Landing.dc.html at "/",
the pricing page from Pricing.dc.html at "/pricing" and the help center from
HelpCenter.dc.html at "/help". Keep the animations (CSS only) and respect
prefers-reduced-motion. Make them responsive down to 375px.
```

## Step 7: Chat widget

```
Build the embeddable chat widget from docs/design/design/ChatWidget.dc.html as a separate
bundle that loads with one <script> tag. Include the launcher, home, messages, help,
chat, handoff to a human, OTP verification before refunds, and CSAT.
```

## Step 8: Final check

```
Go through every screen listed in docs/design/HANDOFF.md and compare it with our app.
Make a table: screen, route, status (done / partial / missing), what is different.
Also check light and dark mode, mobile width and keyboard navigation.
```
