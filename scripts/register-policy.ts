import 'dotenv/config';
import { createPrivyClient } from '../lib/auth/privy-server';
import { loadConfig } from '../lib/config';
import { grantBoundsFromConfig } from '../lib/wallet/session-signer-client';
import { ensureContributionPolicy } from '../lib/wallet/session-signer-client';

async function main() {
  const policy = await ensureContributionPolicy(createPrivyClient());
  const bounds = grantBoundsFromConfig(new Date(), loadConfig());
  console.log('Committed policy ready:');
  console.log(`  id:   ${policy.id}`);
  console.log(`  name: ${policy.name}`);
  console.log('Constraints:');
  console.log(`  token:    ${bounds.tokenAddress}`);
  console.log(`  pot:      ${bounds.potRecipient}`);
  console.log(`  max/week: ${bounds.amountCeiling}`);
  console.log(`  chain:    ${bounds.chain}`);
  console.log(`  expires:  ${new Date(bounds.expiresAt * 1000).toISOString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});