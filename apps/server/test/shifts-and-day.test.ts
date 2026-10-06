import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { billiardsLayout } from '../src/seed';
import { createHarness, type Json } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
let station: (name: string) => Json;

beforeAll(async () => {
  h = await createHarness('2026-09-25T15:00:00Z', {}, billiardsLayout); // 18:00 in Amman
  const floor = await h.floor();
  station = (name) => floor.stations.find((s: Json) => s.name === name);
}, 60_000);

afterAll(async () => {
  await h?.close();
});

const cashier = () => h.tokens.cashier;
const days = async () => (await h.api('GET', '/api/days', undefined, h.tokens.manager)).json as Json[];
const report = async (day?: string) => (await h.api('GET', `/api/reports/day${day ? `?day=${day}` : ''}`, undefined, h.tokens.manager)).json as Json;
const sell = async (token: string | undefined, qty = 1) => {
  const p = ((await h.api('GET', '/api/products', undefined, token)).json as Json[]).find((x) => x.price > 0);
  return h.api('POST', '/api/counter/sale', { items: [{ productId: p!.id, qty }], payments: [{ method: 'cash', amount: p!.price * qty }] }, token);
};

describe('shifts hand over inside one day', () => {
  it('closing a shift does not end the day; the next shift takes over the counted cash', async () => {
    expect((await h.api('POST', '/api/shifts/open', { openingFloat: 20000 }, cashier())).status).toBe(200);
    const playing = await h.api('POST', '/api/sessions', { stationId: station('SN-1').id, mode: 'standard', kind: 'open', label: 'ليلي' }, cashier());
    expect(playing.status).toBe(200);
    expect((await sell(cashier(), 2)).status).toBe(200);

    h.advance(6 * 60); // midnight passes: nothing closes by itself
    expect((await days()).find((d) => d.day === '2026-09-25')?.status).toBe('open');

    const expected = (await h.floor()).shift.expectedCash;
    const closed = await h.api('POST', '/api/shifts/close', { countedCash: expected - 500 }, cashier());
    expect(closed.status).toBe(200);
    expect(closed.json.variance).toBe(-500);
    // The day is still the same day, and the table is still playing.
    expect((await days()).find((d) => d.day === '2026-09-25')?.status).toBe('open');
    expect(((await h.floor()).sessions as Json[]).find((s) => s.id === playing.json.id)?.status).toBe('running');

    // The next person takes over exactly what was counted.
    const handover = (await h.floor()).handover;
    expect(handover).toMatchObject({ cash: expected - 500 });
    expect((await h.api('POST', '/api/shifts/open', { openingFloat: handover.cash }, h.tokens.manager)).status).toBe(200);
    h.advance(120);
    const bill = (await h.api('GET', `/api/sessions/${playing.json.id}/bill`, undefined, h.tokens.manager)).json;
    expect((await h.api('POST', `/api/sessions/${playing.json.id}/checkout`, { payments: [{ method: 'cash', amount: bill.totals.due }] }, h.tokens.manager)).status).toBe(200);
    const exp2 = (await h.floor()).shift.expectedCash;
    expect((await h.api('POST', '/api/shifts/close', { countedCash: exp2 }, h.tokens.manager)).status).toBe(200);

    // The ledger shows every shift of the day, in order, with its own numbers.
    const r = await report('2026-09-25');
    expect(r.shifts).toHaveLength(2);
    expect(r.shifts[0]).toMatchObject({ userName: 'الكاشير', openingFloat: 20000, countedCash: expected - 500, variance: -500, bills: 1 });
    expect(r.shifts[1]).toMatchObject({ userName: 'المدير', openingFloat: expected - 500, variance: 0, bills: 1 });
    expect(r.shifts[1].cash).toBe(bill.totals.due);
    // The table that played across the change of shift is not split: all of it is the day's income.
    expect(r.revenue.carriedIn).toBe(0);
    expect(r.revenue.bills).toBe(2);
  });

  it('only the owner or manager ends the day; it opens a new empty day', async () => {
    expect((await h.api('POST', '/api/days/close', {}, cashier())).status).toBe(403);
    const done = await h.api('POST', '/api/days/close', {}, h.tokens.manager);
    expect(done.status).toBe(200);
    expect(done.json.next).toBe('2026-09-26');
    const list = await days();
    expect(list.find((d) => d.day === '2026-09-25')?.status).toBe('closed');
    expect(list.find((d) => d.day === '2026-09-26')?.status).toBe('open');
    expect((await report()).revenue.total).toBe(0);
    // The old day keeps both shifts.
    expect((await report('2026-09-25')).shifts).toHaveLength(2);
    // The shift that opens on the new day still takes over the last counted cash.
    expect((await h.floor()).handover?.cash).toBeGreaterThan(0);
  });

  it('start from zero hides every day so far, leaves the tables alone, and is for the owner', async () => {
    await h.api('POST', '/api/shifts/open', { openingFloat: 0 }, cashier());
    const running = await h.api('POST', '/api/sessions', { stationId: station('PL-1').id, mode: 'standard', kind: 'open' }, cashier());
    expect((await h.api('POST', '/api/ledger/reset', { confirm: true }, h.tokens.manager)).json.code).toBe('owner_only');
    const done = await h.api('POST', '/api/ledger/reset', { confirm: true }, h.tokens.owner);
    expect(done.status).toBe(200);
    const list = await days();
    expect(list).toHaveLength(1);
    expect((await h.api('GET', '/api/reports/day?day=2026-09-25', undefined, h.tokens.manager)).status).toBe(404);
    expect((await h.floor()).handover).toBeNull();
    expect(((await h.floor()).sessions as Json[]).find((s) => s.id === running.json.id)?.status).toBe('running');
  });
});
