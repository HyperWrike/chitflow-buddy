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
- Built robust CSV processing using `PapaParse`. Current setup gracefully filters incoming missing data and defaults values to guarantee data conformity when pushing bulk creates into the Database.

## Setup and Testing Instructions 
1. **Database Consistency**: Ensure your local Supabase or cloud equivalent has real-time broadcasting enabled for `subscribers`, `subscriptions`, and `chit_groups`. Supabase requires explicit toggling for real-time replication per table via the Dashboard or SQL `alter publication supabase_realtime add table xyz;`.
2. **Build Verification**: Run `npm run build` to confirm TSX constraints (especially those referencing typed table outputs).
3. **Manual Validations**: 
    - Open the app in two browser windows. Add a subscriber to a group in Window A and verify the component updates instantly in Window B.
    - Export a generated CSV, mutate some records inside it, and re-import via the Subscriber dashboard.

## Deviations from Requirements
- **.xlsx Uploads**: Out of the box, `PapaParse` natively accepts CSV. Supporting purely structured .xlsx often demands bulky libraries like `xlsx` or `exceljs`. A robust pre-parsing workflow via a lightweight serverless handler is currently deferred, focusing first on complete CSV fidelity. CSV provides equivalent mass-data abilities minus binary overheads.
