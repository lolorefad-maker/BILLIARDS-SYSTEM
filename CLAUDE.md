# Lounge OS — working notes

Monorepo (npm workspaces): `packages/core` (pure domain engine), `apps/server` (Fastify + Drizzle + Socket.IO), `apps/web` (React + Vite + Tailwind v4).

## How the shop works (owner's words — design around it)

A **billiards club**: two snooker tables and five regular billiard tables (`stations`, types `snooker` / `pool`, one mode `standard`, hourly price per type), plus a **cafeteria**. Everything is on the **table (station)**: when a table is opened the cashier records the time, drinks/food and what was paid (cash or visa, just recorded); drinks are added later from the same table sheet. **No kitchen, no controllers** (the controllers feature of the PlayStation system is still in the code but unused: no controllers are seeded and no screen offers them). The **Cafeteria** page (cashier) sells to someone not on a table, paid on the spot (`POST /api/counter/sale`). The bill is play time × hourly rate + drinks − paid.

**Shifts and the day**: the club works in **shifts** (people take turns on the drawer). A shift is opened with the cash in the drawer — by default **the cash the previous shift counted** (`floor.handover`, the same drawer) — and closed by counting the drawer (`POST /api/shifts/close`). **Closing a shift does not end the day and nothing resets**: the next person opens the next shift and takes over. The **day** is closed only by the owner/manager with **"End the day"** (button in the shift window, or Ledger → End day: counts the drawer if a shift is open, counts the stock, saves the report, opens a new empty day). Nothing closes by itself at midnight and nothing is split (the old midnight mode, `day.autoCloseDay`, is dormant code for old data, off by default and by migration). A table still playing when a shift or the day ends is counted whole on the day it is paid.

**The ledger** (daily page) shows in one look: the day's profit so far and how many tables played, the increase (cash / visa), **every shift of the day in order** (who took it over and when, the cash it started with and from whom it was handed over, what it took in by cash and visa, its bills, the cash the accountant took out, when it was handed over, the counted cash and the difference), then the tables with their drinks and the cafeteria's purchases. A paid entry can be deleted from the ledger on any day (`POST /api/bills/:id/void`, owner/manager, with a confirmation: the bill is voided, its money reversed in the same shift/day, the saved report of a closed day rebuilt; tables still playing are never touched). The owner can "start from zero" (`POST /api/ledger/reset`, typed confirmation): the current shift and day close uncounted, every day so far is hidden (`business_days.archived`, nothing is deleted), a fresh day opens.

**The accountant** comes and takes cash from the drawer: **"Taken by the accountant"** in the shift window (`POST /api/withdrawals`, table `cash_withdrawals`) lowers the drawer's expected cash, does not change the day's income and does not close the shift; shown per shift in the ledger; cancelled (void) only while its shift is open.

**Customer numbers** (`/customers`, cashier + owner): every number typed when a table is opened (or added later from the table sheet, `POST /api/sessions/:id/customer`, or at checkout, or by hand) is kept; a session of more than 4 hours registered with a number earns a free hour ("People Rewards", `rewards` table, told on WhatsApp via a `wa.me` link the cashier presses send on). The next bill of that number can take it off. At checkout the cashier can type the amount to charge (the difference is the shop's discount) and may give any discount (limit `checkout.maxCashierDiscountPercent`, default 100).

## Rules that keep the system correct

- **Money is integer minor units** everywhere (`Minor`). Never floats in storage or APIs. Format only via `formatMoney` / `useFmt()`.
- **Business rules live in `@lounge/core`** and are validated by its zod schemas (`branchSettingsSchema`, `pricingRuleSchema`…). Server and web both import them — never re-implement pricing in one side only.
- **Sessions are segments.** Every change closes the current segment and opens a new one (`planAction`). Billing (`computeTimeBill`) prices each segment and each rule window.
- **Every server write uses `mutate(ctx, actor, fn)`**: one DB transaction + an `events` row (audit log + future sync outbox), published to live clients after commit.
- **Nothing that touches money is deleted**: void with reason; manager approval via `resolveApproval` (manager PIN).
- **Business day** = the open row in `business_days` (not the calendar date). Transactions record `currentDay()`.
- IDs are UUIDv7 (`newId()`), every row carries its branch/org — required for the cloud sync phase.
- Schema changes: edit `apps/server/src/db/schema.ts`, then `npm run db:generate` (commits a SQL migration in `apps/server/drizzle`). Migrations run on startup.

## UI

Before changing anything in `apps/web`, load the project skill **`lounge-ui-ux`** (`.claude/skills/lounge-ui-ux/SKILL.md`): tokens only (no hex in components), logical RTL utilities only (`ms-/me-/start-/end-`), numbers/timers/money through `<Num>`/`<Money>`, every string through `t()` in both `i18n/ar.ts` and `i18n/en.ts`.

## Commands

- `npm run dev` — server (:4000) + web (:5173) with demo data in `apps/server/.data`
- `npm test` — core unit tests + server end-to-end flows (in-memory PGlite)
- `npm run typecheck` — all workspaces (TypeScript 7)
- `npm run build && npm start` — single process serving web + API on :4000
