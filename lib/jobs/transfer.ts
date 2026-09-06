import { randomUUID } from 'node:crypto';
import type { PrivyClient, PrivyWalletsService } from '@privy-io/node';
import { getAuthorizationContext } from '../auth/privy-server';
import { loadConfig, type AppConfig } from '../config';
import type { ActiveContributor } from '../db/repo';

type TransferResponse = Awaited<ReturnType<PrivyWalletsService['transfer']>>;

export interface TransferResult {
  actionId: string;
  txHash?: string;
}

export type TransferFn = (contributor: ActiveContributor) => Promise<TransferResult>;

function transactionHash(steps: TransferResponse['steps'] | undefined): string | undefined {
  for (const step of steps ?? []) {
    if ('transaction_hash' in step && step.transaction_hash) {
      return step.transaction_hash;
    }
    if ('bundle_transaction_hash' in step && step.bundle_transaction_hash) {
      return step.bundle_transaction_hash;
    }
  }
  return undefined;
}

/**
 * Adapter around Privy's sponsored transfer wallet action. Executes exactly
 * the weekly $CONTRIBUTION_TOKEN -> $POT_RECIPIENT transfer, signed with the
 * server's authorization key. Privy enforces the member wallet's committed
 * policy before preparing the underlying transaction.
 */
export function createPrivyTransfer(
  privy: PrivyClient,
  config: AppConfig = loadConfig(),
): TransferFn {
  const ctx = getAuthorizationContext();
  return async (contributor) => {
    const resp = await privy.wallets().transfer(contributor.wallet_id, {
      destination: { address: config.potRecipient },
      source: { asset_address: config.tokenAddress, chain: config.chain },
      amount: config.amountCeiling,
      nonce: randomUUID(),
      authorization_context: ctx,
    });
    return {
      actionId: resp.id,
      txHash: transactionHash(resp.steps),
    };
  };
}