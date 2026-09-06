import { describe, expect, it, vi } from 'vitest';
import { runWeeklyContributionJob } from '../lib/jobs/weekly-contribution';
import { shiftWeeks } from '../lib/jobs/period';
import { findContribution, listContributions, insertContribution } from '../lib/db/repo';
import { addActiveMember, AMOUNT, makeTestDb } from './helpers';

describe('weekly job idempotency (Check 6)', () => {
  it('runs once per member within the same ISO week', async () => {
    const db = makeTestDb();
    const member = addActiveMember(db);
    const transfer = vi.fn().mockResolvedValue({ actionId: 'act_1', txHash: '0xabc' });
    const now = new Date('2026-09-06T09:00:00Z'); // fixed week

    const first = await runWeeklyContributionJob({ db, transfer, now: () => now });
    const second = await runWeeklyContributionJob({ db, transfer, now: () => now });

    expect(transfer).toHaveBeenCalledTimes(1);
    expect(first[0].status).toBe('success');
    expect(second[0].status).toBe('skipped');
    expect(listContributions(db, member.id)).toHaveLength(1);
  });

  it('records a brand new contribution when the period rolls over', async () => {
    const db = makeTestDb();
    const member = addActiveMember(db);
    const transfer = vi.fn().mockResolvedValue({ actionId: 'act_1', txHash: '0xabc' });
    const week1 = new Date('2026-09-06T09:00:00Z');
    const week2 = shiftWeeks(week1, 1);

    await runWeeklyContributionJob({ db, transfer, now: () => week1 });
    await runWeeklyContributionJob({ db, transfer, now: () => week2 });

    expect(transfer).toHaveBeenCalledTimes(2);
    expect(listContributions(db, member.id)).toHaveLength(2);
  });

  it('never re-charges a member who already has a row for the period', async () => {
    const db = makeTestDb();
    const member = addActiveMember(db);
    insertContribution(db, {
      member_id: member.id,
      period: '2026-W36',
      status: 'success',
      attempted_at: 1700000000000,
    });
    const transfer = vi.fn().mockResolvedValue({ actionId: 'act_1' });
    const now = new Date('2026-09-06T09:00:00Z'); // 2026-W36

    const outcomes = await runWeeklyContributionJob({ db, transfer, now: () => now });

    expect(transfer).not.toHaveBeenCalled();
    expect(outcomes[0].status).toBe('skipped');
  });

  it('enforces the unique (member_id, period) key at the database level', () => {
    const db = makeTestDb();
    const member = addActiveMember(db);
    insertContribution(db, {
      member_id: member.id,
      period: '2026-W36',
      status: 'success',
      attempted_at: 1700000000000,
    });
    expect(() =>
      insertContribution(db, {
        member_id: member.id,
        period: '2026-W36',
        status: 'success',
        attempted_at: 1700000000000,
      }),
    ).toThrow();
    expect(findContribution(db, member.id, '2026-W36')?.status).toBe('success');
  });

  it('uses the committed weekly amount on every transfer', async () => {
    const db = makeTestDb();
    addActiveMember(db);
    const transfer = vi.fn().mockResolvedValue({ actionId: 'act_1' });
    const now = new Date('2026-09-06T09:00:00Z');

    await runWeeklyContributionJob({ db, transfer, now: () => now });

    expect(transfer.mock.calls[0][0].grant.amount_ceiling).toBe(AMOUNT);
  });
});