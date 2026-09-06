import { describe, expect, it, vi } from 'vitest';
import { runWeeklyContributionJob } from '../lib/jobs/weekly-contribution';
import { revokeMember, listActiveContributors, findMemberById, findContribution } from '../lib/db/repo';
import { addActiveMember, makeTestDb } from './helpers';

describe('revocation actually blocks future job attempts (Check 7)', () => {
  it('revoked members are excluded from the weekly run', async () => {
    const db = makeTestDb();
    const alice = addActiveMember(db, { wallet_id: 'wal_alice' });
    const bob = addActiveMember(db, { wallet_id: 'wal_bob' });

    const revoked = revokeMember(db, alice.id, new Date('2026-09-01T00:00:00Z'));
    expect(revoked?.status).toBe('revoked');
    expect(findMemberById(db, alice.id)?.status).toBe('revoked');
    expect(listActiveContributors(db).map((c) => c.id)).toEqual([bob.id]);

    const transfer = vi.fn().mockResolvedValue({ actionId: 'act_1', txHash: '0xabc' });
    const now = new Date('2026-09-06T09:00:00Z');
    const outcomes = await runWeeklyContributionJob({ db, transfer, now: () => now });

    expect(transfer).toHaveBeenCalledTimes(1);
    expect(transfer.mock.calls[0][0].wallet_id).toBe('wal_bob');
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].memberId).toBe(bob.id);
    expect(findContribution(db, alice.id, '2026-W36')).toBeUndefined();
  });
});