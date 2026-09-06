import { describe, expect, it, vi } from 'vitest';
import { runWeeklyContributionJob } from '../lib/jobs/weekly-contribution';
import { findContribution } from '../lib/db/repo';
import { addActiveMember, makeTestDb } from './helpers';

describe('per-member error isolation (Check 8)', () => {
  it('a failing member does not abort the job for the others', async () => {
    const db = makeTestDb();
    const alice = addActiveMember(db, { wallet_id: 'wal_alice' });
    const bob = addActiveMember(db, { wallet_id: 'wal_bob' });
    const carol = addActiveMember(db, { wallet_id: 'wal_carol' });

    const transfer = vi.fn().mockImplementation(async (contributor: { wallet_id: string }) => {
      if (contributor.wallet_id === 'wal_alice') {
        throw new Error('insufficient balance');
      }
      if (contributor.wallet_id === 'wal_bob') {
        throw new Error('policy rejected');
      }
      return { actionId: 'act_ok', txHash: '0xabc' };
    });

    const now = new Date('2026-09-06T09:00:00Z');
    const outcomes = await runWeeklyContributionJob({ db, transfer, now: () => now });

    expect(transfer).toHaveBeenCalledTimes(3); // every member was attempted
    const byStatus = Object.fromEntries(outcomes.map((o) => [o.memberId, o.status]));
    expect(byStatus[alice.id]).toBe('failed');
    expect(byStatus[bob.id]).toBe('failed');
    expect(byStatus[carol.id]).toBe('success');

    const aliceRow = findContribution(db, alice.id, '2026-W36');
    expect(aliceRow?.status).toBe('failed');
    expect(aliceRow?.error).toBe('insufficient balance');
    const carolRow = findContribution(db, carol.id, '2026-W36');
    expect(carolRow?.status).toBe('success');
    expect(carolRow?.tx_hash).toBe('0xabc');
  });
});