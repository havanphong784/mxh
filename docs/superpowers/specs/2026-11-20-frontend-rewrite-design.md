# MXH frontend replacement

Rebuild the entire Vietnamese social web client independently of the old frontend. Preserve existing backend and data, using backend controllers, DTOs and events as the contract. No copying or importing legacy frontend code, images, tests or styles. Never seed fake content in production.

**Approaches:** Rebuild in a new framework within the existing workspace (chosen: React 19, Vite, TypeScript and native CSS); rebuild in Next with fresh code (viable, but keeps server/runtime complexity for this API-first UI); leave a standalone redesign prototype (rejected: does not replace the working site).

**Design:** A readable social desk: paper background, ink text, forest green accent, understated rules, editorial type for headings, and a steady navigation rail. Content takes priority; desktop navigation becomes a phone bottom bar, with conversation panes shown one at a time on phones. Auth has its own compact public layout. Support keyboard navigation, reduced motion, real loading/error/empty states, and responsive media.

**Scope:** Account lifecycle, feeds and discovery, posts/threads and all interactions, profiles and relationships, notifications, one-to-one realtime messages, account settings and signed media uploads. Keep deployed API flows and refresh cookies intact. No backend/database changes. Existing public path aliases will be retained where identified through product docs. Cut over the workspace only after building the replacement. No deploy or commit requested.
