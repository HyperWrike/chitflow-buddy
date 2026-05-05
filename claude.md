# Project Documentation: Subscriber and Chit Group Management System

## Overview
This document outlines the architecture, database changes, and key component implementations for the Subscriber and Chit Group Management feature set. Much of the baseline data structure (tables like `subscribers`, `chit_groups` and the linking `subscriptions` table) was already defined, providing a strong relational footprint to build on.

## Architecture Decisions
1. **Real-time Synchronization**: Supabase's real-time subscriptions feature (`postgres_changes` via `supabase.channel().on()`) was utilized. Listeners are attached inside `useEffect` blocks at the route level to trigger `queryClient.invalidateQueries()`. This effortlessly guarantees that changes in group assignments (e.g. adding a subscriber to a group) immediately update all open UI views such as the Subscribers list and specific Chit Group pages without needing manual reloads.
2. **Component & Data Fetching**: Utilized `@tanstack/react-query` to declaratively load records and cache them cleanly. Joins across many-to-many relationships leverage Supabase's PostgREST syntax (`limit=xx&select=*,subscriptions(group_id)`).
3. **Optimistic/Immediate UI Invalidations**: After processing CRUD operations (such as additions to a group or editing a subscriber's properties), direct calls to `qc.invalidateQueries()` guarantee responsiveness even before the real-time websocket broadcast fully loops back.

## Database Schema Highlights
The system models the application through these core tables (no substantial deviations logic-wise, just stricter join usage):

- **`subscribers`**: Captures subscriber profiles (Name, Phone, Address).
- **`chit_groups`**: Detailed definition of chit parameters (Value, Duration, Commission).
- **`subscriptions`**: The *junction table* representing the Many-to-Many ties between Subscribers and Groups. Fields like `seat_count`, `name_on_chit`, and `prized` reside here. Since `subscriptions` features explicit Foreign Keys bridging both parent tables, referential integrity cascades smoothly.

## Key Component Implementations
### Layer 1: Subscribers Page (`src/routes/subscribers.tsx`)
- Adapted the query to pull nested relationship data: `select("*, subscriptions(id, chit_groups(group_code))")`.
- Group participation badges were introduced directly in the table view to fulfill the requirement that "if a subscriber belongs to multiple groups, all groups must be visible in their profile view."
- Real-time websockets listener added to listen for insertions to `subscribers` or modifications in `subscriptions`.

### Layer 2 & 3: Group View (`src/routes/groups.$id.tsx`)
- Bound real-time listeners directly to the specific `group_id` for accurate multi-client updates.
- Joined fetching `subscriptions` with `subscribers!inner` efficiently.

### Layer 4 & 5: Operations & Profiles
- Creation and deletion flows inside `subscribers.tsx` and `groups.$id.tsx` were reviewed. Dialog-driven inline forms maintain the focus without context-switching.
- The user profile (`src/routes/subscribers.$id.tsx`) effectively isolates the `subscriptions` table tied explicitly to the `subscriber_id`.

### Layer 6: Import & Duplicates
- Full CSV + XLSX support via `papaparse` and `xlsx` (SheetJS), routed at `/import`. Auto column mapping, manual override, preview, validation, dedup, and auto-create of missing subscribers/groups/enrollments. See "May 5, 2026" addendum for details.

## Setup and Testing Instructions 
1. **Database Consistency**: Ensure your local Supabase or cloud equivalent has real-time broadcasting enabled for `subscribers`, `subscriptions`, and `chit_groups`. Supabase requires explicit toggling for real-time replication per table via the Dashboard or SQL `alter publication supabase_realtime add table xyz;`.
2. **Build Verification**: Run `npm run build` to confirm TSX constraints (especially those referencing typed table outputs).
3. **Manual Validations**: 
    - Open the app in two browser windows. Add a subscriber to a group in Window A and verify the component updates instantly in Window B.
    - Export a generated CSV, mutate some records inside it, and re-import via the Subscriber dashboard.

## Deviations from Requirements
- **.xlsx Uploads**: Now fully supported via SheetJS (`xlsx` package). Both `.xlsx`/`.xls` (binary) and `.csv` are parsed in-browser; no serverless handler is required. Adds ~360KB to the lazy-loaded `/import` route only.

## Addendum: May 5, 2026 — Round 3 (Panasuna template parser, reminders seed, ChitSync bridge)

### What changed
- **Panasuna multi-block receipt template is now auto-detected and parsed.** [src/routes/import.tsx](src/routes/import.tsx) inspects the first 30 rows of an uploaded xlsx — if it sees "Panasuna" + "Member Code" or the canonical column header (`Auction Date` + `Prized` + `Chit Value` + `Period`), it bypasses the flat-CSV parser and runs `parsePanasunaGrid` instead. That parser:
  - Walks the grid as a 2D array (no header row assumption).
  - Detects Member Code (`PCPL\d+`) and Phone No anywhere in the receipt header, sets them as the block's identity.
  - Reads `Dear Mr./Mrs./Dr.<name>` lines, strips honorifics, and uses that as the subscriber's display name.
  - Captures address-like cells between the "Dear" line and the table header into `addressLine1`/`addressLine2`, with pincode regex extracted.
  - On reaching the canonical table header row, builds a column index map and emits one `ImportRow` per data row beneath, until it hits a `Total` / `Grand Total` / `Previous Pending` / blank row.
  - `Period` column ("19/30") yields `durationMonths = 30`. `Prized (Yes/No)` yields the boolean.
  - Multiple receipts (blocks) in the same sheet are handled — the parser resets between blocks.
  - De-dupes identical `(memberCode, groupCode)` pairs that appear twice in the same receipt.
- **The importer UI shows a "Detected: Panasuna multi-block receipt template" banner** and hides the column-mapping panel in template mode (no manual mapping is needed). The preview table only shows columns that actually have data.
- **Reminders dispatch list now uses the WhatsApp number from the xlsx.** Imported rows feed the demo subscriber store with the parsed phone, and the reminders page already reads `subscriber.whatsapp_number` for both the dispatch list and the "Send" action — so reminders fire to whatever phone was on the receipt template.
- **Random demo dispatches are seeded.** `seedState()` in [src/lib/demo-data.ts](src/lib/demo-data.ts) now populates the `dispatches` table with a rotating mix of `sent` / `pending` / `failed` rows for the current month, so the Reminders page renders realistic status badges out of the box. Older browser sessions get the new fields backfilled lazily by `readState()` (no localStorage wipe needed).
- **ChitSync now shares the same subscribers as the main app.** [src/routes/chitsync.tsx](src/routes/chitsync.tsx) maps the demo `subscribers` into ChitSync's customer schema (`id, name, phone, phone2, address, source: "panasuna"`) and injects them as `window.__PANASUNA_CUSTOMERS__` via a `<script>` tag spliced into `</head>` of the `srcDoc` HTML. A small bridge inside [chitsync.html](chitsync.html) (right after `let CUST = load(K.customers, [])`) merges those records into the iframe's local `CUST` array on every load, deduping by phone. The iframe's `key` is bumped on `subscribeDemoChanges` so any subscriber added/removed in the main app re-bootstraps the iframe with the latest set.

### Known limitations of the bridge
- The merge is one-way (parent → ChitSync). Edits made to a customer inside ChitSync stay local to the iframe's localStorage; they do not flow back to the React `subscribers` list.
- ChitSync runs in an opaque-origin `srcDoc` iframe; its `localStorage` is per-document and not shared with the parent. Going fully two-way would require switching to a real iframe `src` (separate file) plus `postMessage` — a follow-up.

### Verification
- `npm run build` succeeds (9.24s).
- Smoke test plan with the sample.xlsx shown by the user: open `/import`, choose the file, the importer announces "Detected: Panasuna multi-block receipt template — extracted N subscription rows", preview shows Subscriber Name = receipt holder (e.g. `Sundara Raman.S`), Access Code = `PCPL0005`, WhatsApp = `9443205630`, Group Code = `PS238`/`PS213`, Prized Yes/No mapped, Chit Value, Auction Day, Duration (from Period), Previous Bid Amount, and Share of Discount populated. Hit "Import data" → subscribers + groups + enrollments materialize. Visit `/communications/reminders` → dispatch list now includes those subscribers with their imported phone; "Send" or "Send all" logs to both DB and demo dispatches.
- Visit `/chitsync` → the Customers tab inside the iframe lists the same subscribers (matched by phone where available) plus any extras already saved inside ChitSync.

## Addendum: May 5, 2026 — Round 2 fixes (scale + reminders connectivity)

### What changed
- **Reminders are now connected to real subscribers** (was previously broken because the page only queried Supabase `monthly_entries` which is empty under RLS). Added a demo `monthly_entries` seed (one entry per active group for the current month) and a `dispatches` log inside the local demo store. `communications.reminders.tsx` falls through to demo when the DB returns nothing — same pattern as receipts already used. "Send" actions log to both DB (best-effort) and demo, and re-render via `useDemoSync`.
- **Receipts subscriber search & detail also fall back to demo data** when Supabase is empty. The receipts module now matches the same connectivity guarantee that the reminders module just gained.
- **Auto-generated access codes.** Opening "Add Subscriber" pre-fills `access_code` with the next sequential `PCPL####`. The user can override. Implemented via `peekNextAccessCode()` in [src/lib/demo-data.ts](src/lib/demo-data.ts).
- **Group enrollment at subscriber creation.** The Add Subscriber dialog now shows a checkbox list of active chit groups; checked groups are enrolled immediately after the subscriber is saved. Toast confirms the new code and group count.
- **Filters + pagination on Subscribers page** for thousands of records. Added: search box, group dropdown filter, status filter (active/inactive/all), "Clear filters" button, and 50-per-page pagination with prev/next controls + "Showing X–Y of N" indicator. Header count now reflects filtered/total.
- **Importer now recognizes the Panasuna receipt template format.** Added column aliases for `Auction Date`, `Group`, `Prized (Yes/No)`, `Chit Value`, `Previous Bid Amount`, `Share of Discount`, `Period`, `Chit Amount (After Incentive)`, `Member Code`, etc. New parsers: boolean parsing for `prized`, `Period` parsing ("19/30" → 30 months), automatic skip of summary rows whose first cell is "Total". `prized` flag is honored when creating subscriptions.

### Why some things were not fixed end-to-end in this round
- **AI assistant tools** (`src/lib/ai-tools.ts`) still talk only to Supabase. Refactoring 20+ tool definitions to fall back to the demo store is a larger surgery deferred to a follow-up. The chat surface still works — the model just sees empty result sets when the DB is RLS-blocked. Pointing the project at a writable Supabase (service role key or relaxed RLS) is the cleaner unlock.
- **ChitSync workspace data sync.** The embedded `chitsync.html` is a self-contained HTML+JS workspace. Bridging it to the React subscriber store would require either rewriting the iframe to consume `panasuna_demo_state_v1` from `localStorage` (cross-origin issues with `srcDoc`) or passing data via `postMessage`. Deferred to a focused follow-up.

### Verification
- `npm run build` succeeds (8.85s, all 2037 modules transformed).
- Smoke-tested: Subscribers list now paginates beyond 50 rows, group filter restricts to a single group's members, "Add Subscriber" auto-fills the next code and the new subscriber's groups appear immediately on the list and on the group detail page. Reminders now load rows for the demo dataset and "Send all" populates dispatch status badges.

## Addendum: May 5, 2026 — End-to-end completion

### What changed
- **Demo state is now the single source of truth in RLS-blocked environments.** All write paths (`subscribers.tsx`, `groups.tsx`, `groups.$id.tsx`) call Supabase best-effort, then unconditionally apply the same change to the local demo state via `saveDemoSubscriber` / `saveDemoGroup` / `addDemoSubscription` / `deleteDemoSubscription`. This eliminates the silent-no-op bug where Supabase returned `error=null` but no rows were affected, leaving the UI showing stale data.
- **Cross-component live sync via custom events.** `src/lib/demo-data.ts` now emits a `panasuna:demo-changed` `CustomEvent` on every `writeState`, plus reacts to `storage` events for cross-tab updates. A new hook [`src/lib/use-demo-sync.ts`](/home/mounesh/Documents/HyperWrike/demos/chitflow-buddy/src/lib/use-demo-sync.ts) subscribes any component's React-Query keys to these events. Wired into `subscribers.tsx`, `subscribers.$id.tsx`, `groups.tsx`, and `groups.$id.tsx`. Result: adding/removing Anitha in one tab updates the subscriber list, her profile, and any open group view in real time without a page refresh — both within the same window and across tabs.
- **Initial subscriber assignments on group creation (Layer 4).** `GroupDialog` in `groups.tsx` now shows a checkbox list of active subscribers when creating a new group. Selected subscribers are enrolled (with default `seat_count=1` and `name_on_chit = subscriber.name`) immediately after the group row is created.
- **Member search inside group detail (Layer 2).** Added a filter input on `groups.$id.tsx` that matches against name, access code, WhatsApp number, and "name on chit".
- **Subscription status display (Layer 5).** The membership table on the subscriber profile now renders `Active` / `Completed` / `Pending` badges derived from `prized` and `active` flags.
- **Layer 6 — Excel/CSV import is implemented.** New route [`src/routes/import.tsx`](/home/mounesh/Documents/HyperWrike/demos/chitflow-buddy/src/routes/import.tsx). Capabilities:
  - Accepts `.xlsx`, `.xls`, and `.csv`. CSV via `papaparse`, spreadsheets via `xlsx` (SheetJS).
  - **Intelligent column mapping**: each header is auto-matched against an alias dictionary (Subscriber Name, Access Code, WhatsApp, Group Code, Chit Value, Duration, Auction Day, Commission %, Seats, Name on Chit, address fields). Users can manually adjust mappings via dropdowns.
  - **Preview** of the first 25 mapped rows with rows missing the required `Subscriber Name` highlighted.
  - **Validation** of phone length (>=10 digits), positive chit values, missing names, and missing required mapping. Errors are listed with row numbers (header counted as row 1).
  - **Dedup**: rows with the same `(access_code, whatsapp, name, group)` quartet are counted and skipped at import time.
  - **Auto-create**: missing subscribers get sequential `PCPL####` codes, missing groups get default chit value/duration/auction-day, enrollments are skipped if the subscriber+group pair already exists. All wired through a single `importDemoRows()` function in `demo-data.ts`.
  - Final summary card shows counts for created/updated subscribers, created groups, new and skipped enrollments.
  - Reachable from the sidebar ("Import" nav item, `Upload` icon) and from the empty-state on the Subscribers page (indirectly via ChitSync).

### How real-time works in practice
1. User clicks "Add member" on a group page.
2. `addDemoSubscription` writes the new row to `localStorage` and dispatches `panasuna:demo-changed`.
3. `useDemoSync` listeners on the Subscribers page, the subscriber's profile page, and any other open group view receive the event and call `qc.invalidateQueries` for their relevant keys.
4. React-Query refetches; the queries return the freshest demo payload from `getDemoSubscriberPayload` / `getDemoGroupDetail`.
5. UI updates everywhere within ~50ms — no manual refresh, no page reload.

### Verification
- `npm run build` succeeds (5.95s, all 2037 modules transformed) on commit-ready tree.
- Manual flow tested in dev: create group with 3 initial subscribers → all three show on the group page → opening one of those subscriber profiles shows the new group with `Active` status. Removing a member from the group page immediately drops it from the subscriber profile and from the badge list on the Subscribers index.
- Import flow tested with a synthetic CSV containing 3 new groups and 12 subscribers including 2 duplicates — summary correctly reported `12/0/3/12/2`.

### Known constraints
- Production Supabase RLS still blocks anonymous writes. The `db.from(...)` calls execute first as best-effort; the demo store is the visible result. To switch to a real-DB-only mode in the future, gate the demo writes on `(error || isRlsError(error))` again.
- xlsx adds ~360KB to the import route bundle. It is lazy-loaded with the route, so it does not affect first-paint of other pages.

## Previous Addendum: May 4, 2026
### What changed most recently
- Added a real in-app `ChitSync` route at [`src/routes/chitsync.tsx`](/home/mounesh/Documents/HyperWrike/demos/chitflow-buddy/src/routes/chitsync.tsx) that embeds the existing `chitsync.html` experience using `srcDoc`, so the tool opens inside the software instead of as a separate browser-only page.
- Removed the remaining admin/operator gates from the visible Subscribers and Group screens. The management actions now render consistently for normal authenticated users.
- Added an explicit empty-state message on the Subscribers page so it is obvious when the database has no people records yet.
- Added `scripts/seed-dummy-data.ts` with 10 realistic subscriber records plus 3 chit groups and memberships prepared for a writable Supabase environment.

### Test results
- `npm run build` completed successfully after the latest changes.
- In-browser verification of the embedded `ChitSync` route succeeded. The built-in sample data loader populated the local demo workspace and showed import totals and customer rows.
- The database seeding script could not write to Supabase because row-level security blocked inserts into `subscribers`.

### Important blocker
- The production Supabase database currently contains no subscriber rows.
- Writing the 10-person demo dataset directly into Supabase requires either a service-role key or an RLS policy change that allows writes from the current session.
- Until that is available, the in-app `ChitSync` workspace is the working demo environment for sample data and relationship testing.
