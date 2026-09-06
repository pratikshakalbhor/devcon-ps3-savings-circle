import 'dotenv/config';
import { createPrivyClient } from '../lib/auth/privy-server';
import { openDb } from '../lib/db/client';
import { createPrivyTransfer } from '../lib/jobs/transfer';
import { runWeeklyContributionJob } from '../lib/jobs/weekly-contribution';

async function main() {
  const db = openDb();
  const outcomes = await runWeeklyContributionJob({
    db,
    transfer: createPrivyTransfer(createPrivyClient()),
  });

  if (outcomes.length === 0) {
    console.log('No active members — nothing to do.');
    return;
  }
  for (const outcome of outcomes) {
    console.log(
      `[${outcome.status}] ${outcome.memberId} ${outcome.period}` +
        (outcome.txHash ? ` tx=${outcome.txHash}` : '') +
        (outcome.error ? ` error=${outcome.error}` : ''),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});