import type { DB } from '../db/client';
import {
  findContribution,
  insertContribution,
  listActiveContributors,
  updateContributionStatus,
} from '../db/repo';
import { isoWeekOf } from './period';
import type { TransferFn } from './transfer';

export type JobOutcomeStatus = 'success' | 'failed' | 'skipped';

export interface JobOutcome {
  memberId: string;
  period: string;
  status: JobOutcomeStatus;
  txHash?: string;
  error?: string;
}

export interface WeeklyContributionDeps {
  db: DB;
  transfer: TransferFn;
  now?: () => Date;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Runs the weekly recurring contribution for every active member.
 *
 * - Idempotency (Check 6): the contributions table is keyed by
 *   PRIMARY KEY (member_id, period) — the ISO week bucket — so a member is
 *   never charged more than once per week, even if the job runs repeatedly or
 *   is replayed after a crash.
 * - Isolation (Check 8): each member is attempted inside its own try/catch. A
 *   failure for one member is recorded and never aborts the other members.
 */
export async function runWeeklyContributionJob(
  deps: WeeklyContributionDeps,
): Promise<JobOutcome[]> {
  const now = deps.now?.() ?? new Date();
  const period = isoWeekOf(now);
  const contributors = listActiveContributors(deps.db);
  const outcomes: JobOutcome[] = [];

  for (const contributor of contributors) {
    try {
      const existing = findContribution(deps.db, contributor.id, period);
      if (existing) {
        outcomes.push({ memberId: contributor.id, period, status: 'skipped' });
        continue;
      }

      insertContribution(deps.db, {
        member_id: contributor.id,
        period,
        status: 'in_progress',
        attempted_at: now.getTime(),
      });

      let result;
      try {
        result = await deps.transfer(contributor);
      } catch (error) {
        updateContributionStatus(deps.db, contributor.id, period, {
          status: 'failed',
          error: errorMessage(error),
        });
        outcomes.push({
          memberId: contributor.id,
          period,
          status: 'failed',
          error: errorMessage(error),
        });
        continue;
      }

      updateContributionStatus(deps.db, contributor.id, period, {
        status: 'success',
        tx_hash: result.txHash ?? null,
        error: null,
      });
      outcomes.push({
        memberId: contributor.id,
        period,
        status: 'success',
        txHash: result.txHash,
      });
    } catch (error) {
      outcomes.push({
        memberId: contributor.id,
        period,
        status: 'failed',
        error: errorMessage(error),
      });
    }
  }

  return outcomes;
}