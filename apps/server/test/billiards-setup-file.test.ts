import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;

beforeAll(async () => {
  // A new online install: no demo data, only the owner.
  h = await createHarness('2026-09-25T15:00:00Z', { seedDemo: false, owner: { name: 'المالك', pin: '123456' } });
}, 60_000);

afterAll(async () => {
  await h?.close();
});

describe('the billiards setup file (setup/billiards-setup.json)', () => {
  it('loads into a new empty install: two snooker tables, five regular tables, prices and the cafeteria products', async () => {
    const file = JSON.parse(readFileSync(new URL('../../../setup/billiards-setup.json', import.meta.url), 'utf8'));
    const done = await h.api('POST', '/api/settings/import', file, h.tokens.owner);
    expect(done.status).toBe(200);
    const floor = await h.floor('owner');
    expect(floor.stations.map((s: { name: string }) => s.name)).toEqual(['SN-1', 'SN-2', 'PL-1', 'PL-2', 'PL-3', 'PL-4', 'PL-5']);
    expect(floor.rules.filter((r: { active: boolean }) => r.active)).toHaveLength(2);
    const products = (await h.api('GET', '/api/products', undefined, h.tokens.owner)).json as unknown[];
    expect(products.length).toBe(11);
  });
});
