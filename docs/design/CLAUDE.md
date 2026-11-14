# Instructions for Claude Code (ORBAT AI)

Add this to the CLAUDE.md file at the root of your repo (or merge it into the existing one).

## Design source of truth

- The design lives in `docs/design/`. Read `docs/design/HANDOFF.md` before any UI work.
- Each screen has a reference file in `docs/design/design/<Screen>.dc.html`. Match its layout, spacing, sizes, colours and states.
- The `.dc.html` files are references only. Never import or ship them. Rebuild them with our own components.
- Sample data in the design files (names, orders, numbers) is fake. Always use real data from our backend.

## Rules

- Use the design tokens (CSS variables). Never hard-code colours.
- Lime (`--lime`) is for primary actions and active states. Violet (`--ai`) is only for AI.
- Buttons are pills. Cards use radius 20–24px. Inputs use radius 12px.
- Fonts: Inter Tight for page titles and display, Inter for everything else.
- We are replacing the whole frontend. Do NOT change backend code (database, API routes, server logic, auth) unless I explicitly ask. Follow docs/design/REPLACE_PLAN.md.
- Screens get data only through `lib/data/`. Use the existing backend where it exists; otherwise typed mocks from `lib/mock/` with a `TODO(backend)` comment, and add the gap to `docs/design/BACKEND_GAPS.md`.
- Every screen needs loading, empty and error states (see `States.dc.html`).
- Support light and dark mode, keyboard focus rings and `prefers-reduced-motion`.
- Before adding database tables or API routes, propose them and wait for approval.
- Work one screen at a time and keep the app building after each change.
