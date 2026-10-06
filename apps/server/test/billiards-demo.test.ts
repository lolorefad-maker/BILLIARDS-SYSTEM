import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db';
import { seedIfEmpty } from '../src/seed';
import { floorSnapshot } from '../src/services/floor';

let database: Awaited<ReturnType<typeof openDatabase>>;

beforeAll(async () => {
  database = await openDatabase({ databaseUrl: null, dataDir: null });
  await seedIfEmpty(database.db, { demo: true });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the billiards demo', () => {
  it('has two snooker tables, five regular tables, a price for each kind, and no controllers', async () => {
    const orgBranch = (await database.db.query.branches.findFirst())!;
    const floor = await floorSnapshot(database.db, orgBranch.id, Date.now());
    const names = floor.stations.map((s) => s.name);
    expect(names).toEqual(['SN-1', 'SN-2', 'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5']);
    expect(floor.stations.filter((s) => s.type === 'snooker')).toHaveLength(2);
    expect(floor.stations.filter((s) => s.type === 'pool')).toHaveLength(5);
    expect(floor.controllers).toHaveLength(0);
    expect(floor.rules.some((r) => r.active && (r.match as { stationTypes?: string[] }).stationTypes?.includes('snooker'))).toBe(true);
    expect(floor.rules.some((r) => r.active && (r.match as { stationTypes?: string[] }).stationTypes?.includes('pool'))).toBe(true);
  });
});
