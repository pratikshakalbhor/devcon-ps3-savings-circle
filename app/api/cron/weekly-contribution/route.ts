import { NextRequest, NextResponse } from 'next/server';
import { createPrivyClient } from '@/lib/auth/privy-server';
import { loadConfig } from '@/lib/config';
import { getDb } from '@/lib/db/client';
import { createPrivyTransfer } from '@/lib/jobs/transfer';
import { runWeeklyContributionJob } from '@/lib/jobs/weekly-contribution';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/cron/weekly-contribution
 *
 * Invoked by a scheduled job (Vercel Cron, an OS cron, or manually via the
 * trigger script). Protected by CRON_SECRET. Runs the recurring contribution
 * once per active member per ISO week — durably idempotent and never lets one
 * member's failure abort the rest.
 */
export async function POST(request: NextRequest) {
  const { cronSecret } = loadConfig();
  const authorization = request.headers.get('authorization') ?? '';
  const presented = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!presented || presented !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const outcomes = await runWeeklyContributionJob({
      db: getDb(),
      transfer: createPrivyTransfer(createPrivyClient()),
    });
    return NextResponse.json({ outcomes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}