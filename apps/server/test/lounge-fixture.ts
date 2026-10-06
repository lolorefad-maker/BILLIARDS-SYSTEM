import type { Tx } from '../src/db';
import { controllers, packages, pricingRules, stations } from '../src/db/schema';
import { newId } from '../src/lib/ids';

/**
 * The PlayStation-lounge layout the end-to-end tests were written against (PS-01…, VIP-1…, VR-1…,
 * controllers, per-mode prices and packages). The shop's own layout is in `src/seed.ts`.
 */
export async function loungeLayout(tx: Tx, branchId: string) {
    const st: (typeof stations.$inferInsert)[] = [];
    let sort = 0;
    for (let i = 1; i <= 10; i++) {
      st.push({ id: newId(), branchId, name: `PS-${String(i).padStart(2, '0')}`, type: 'ps5', tier: 'regular', zone: 'الصالة', modes: ['single', 'multi'], sort: sort++ });
    }
    for (let i = 1; i <= 4; i++) {
      st.push({ id: newId(), branchId, name: `VIP-${i}`, type: 'ps5', tier: 'vip', zone: 'غرف VIP', modes: ['single', 'multi'], sort: sort++ });
    }
    for (let i = 1; i <= 2; i++) {
      st.push({ id: newId(), branchId, name: `VR-${i}`, type: 'vr', tier: 'regular', zone: 'VR', modes: ['standard'], sort: sort++ });
    }
    await tx.insert(stations).values(st);

    // 30 numbered controllers on the shelf, handed out with each session.
    await tx.insert(controllers).values(Array.from({ length: 30 }, (_, i) => ({ id: newId(), branchId, number: i + 1 })));

    const rule = (name: string, priority: number, match: Record<string, unknown>, effect: Record<string, unknown>, active = true) => ({
      id: newId(),
      branchId,
      name,
      priority,
      active,
      match,
      effect,
    });
    await tx.insert(pricingRules).values([
      rule('PS5 فردي', 0, { stationTypes: ['ps5'], tiers: ['regular'], modes: ['single'] }, { kind: 'rate', perHour: 2000 }),
      rule('PS5 زوجي', 0, { stationTypes: ['ps5'], tiers: ['regular'], modes: ['multi'] }, { kind: 'rate', perHour: 3000 }),
      rule('VIP فردي', 0, { stationTypes: ['ps5'], tiers: ['vip'], modes: ['single'] }, { kind: 'rate', perHour: 4000 }),
      rule('VIP زوجي', 0, { stationTypes: ['ps5'], tiers: ['vip'], modes: ['multi'] }, { kind: 'rate', perHour: 5000 }),
      rule('VR', 0, { stationTypes: ['vr'] }, { kind: 'rate', perHour: 8000 }),
      // Sunday–Thursday afternoons (ISO weekdays: 7 = Sunday … 4 = Thursday)
      rule('Happy Hour', 10, { daysOfWeek: [7, 1, 2, 3, 4], timeFrom: '12:00', timeTo: '16:00' }, { kind: 'percent', percent: -20 }),
      rule('ليلة الويكند', 5, { stationTypes: ['ps5'], daysOfWeek: [4, 5], timeFrom: '20:00', timeTo: '02:00' }, { kind: 'percent', percent: 25 }, false),
    ]);

    await tx.insert(packages).values([
      { id: newId(), branchId, name: '3 ساعات فردي', minutes: 180, price: 5000, match: { stationTypes: ['ps5'], tiers: ['regular'], modes: ['single'] } },
      { id: newId(), branchId, name: '3 ساعات زوجي', minutes: 180, price: 7500, match: { stationTypes: ['ps5'], tiers: ['regular'], modes: ['multi'] } },
    ]);
}
