import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db';
import { ensureStarterSetup, seedIfEmpty } from '../src/seed';
import { floorSnapshot } from '../src/services/floor';
import { listStock } from '../src/services/stock';

let database: Awaited<ReturnType<typeof openDatabase>>;

beforeAll(async () => {
  database = await openDatabase({ databaseUrl: null, dataDir: null });
  // A new online install: only the owner.
  await seedIfEmpty(database.db, { demo: false, owner: { name: 'المالك', pin: '123456' } });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the club starting setup on an empty online install', () => {
  it('adds the tables, the prices and the cafeteria products once, and never any staff', async () => {
    expect(await ensureStarterSetup(database.db)).toBe(true);
    const branch = (await database.db.query.branches.findFirst())!;
    const floor = await floorSnapshot(database.db, branch.id, Date.now());
    expect(floor.stations.map((s) => s.name)).toEqual(['SN-1', 'SN-2', 'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5']);
    expect(floor.rules.filter((r) => r.active)).toHaveLength(2);
    expect((await listStock(database.db, branch.id)).length).toBe(11);
    expect((await database.db.query.users.findMany()).map((u) => u.role)).toEqual(['owner']);
    // It does not run twice, nor over a club that already has its own tables.
    expect(await ensureStarterSetup(database.db)).toBe(false);
  });
});
