# MXH Frontend Replacement Implementation Plan

> **For agentic workers:** Use task-scoped implementation and verify the integrated app. Steps use checkbox syntax for tracking.

**Goal:** Replace the legacy MXH frontend with a clean React app on the existing backend.

**Architecture:** The root owns session, navigation and socket lifecycle. Feature modules own their DTOs, REST calls, view state and stylesheet. The Vite development proxy keeps API and socket requests same-origin; production can use same-origin reverse proxy or the configured API origin.

**Tech stack:** React 19, Vite, TypeScript, Socket.IO Client and CSS.

**Spec:** `docs/superpowers/specs/2026-11-20-frontend-rewrite-design.md`

## Global constraints

- No legacy frontend code, styles, media or tests as inputs; backend and data unchanged.
- Vietnamese copy; responsive, keyboard-accessible UI; no fake content in production.
- No commits or deploys.

## Review focus

- Concurrent expired requests share a single refresh; a failed refresh clears private state.
- Navigating to another route/identity cannot reuse stale private data.
- Reconnect re-reads inbox and selected conversation; duplicate incoming items are not rendered.
- Post/media failures do not report success or clear the text draft.
- Narrow viewports keep navigation and primary actions reachable without horizontal scrolling.

## Tasks

- [ ] Foundation: `frontend/src/api.ts`, `session.ts`, `ui.tsx`, `app.tsx`, `style.css`; test concurrent refresh, session failure and routing. Run `npm test -w frontend` and `npm run build -w frontend`.
- [ ] Social view: `frontend/src/social/`; derive DTOs and requests from posts/media controllers; test paging, authored edits and publish errors. Expose `Social({ path, user })`.
- [ ] Inbox: `frontend/src/inbox/`; derive requests from messaging and notifications; test message merge, unread and reconnect behavior. Expose `Inbox({ path, user })`.
- [ ] People: `frontend/src/people/`; cover user search and profiles, relationships, account changes; test URL/data handling. Expose `People({ path, user, onUser })`.
- [ ] Public auth: `frontend/src/auth.tsx`; render login, signup, verification and recovery, with exact API payloads. Exercise browser form submission against the API contract.
- [ ] Replace legacy tracked paths, update workspace manifests and runbook; run monorepo checks and verify desktop/mobile in a real browser.
