import type { Policy, PrivyClient, AuthorizationContext } from '@privy-io/node';
import { createPrivyClient, getAuthorizationContext } from '../auth/privy-server';
import { grantBounds, loadConfig, type AppConfig, type GrantBounds } from '../config';
import { buildContributionPolicy } from '../policy/contribution-policy';

/**
 * Server-side counterpart to the client-side grant flow.
 *
 * The client-facing "single source" for the grant call is the Privy session
 * signers flow in components/JoinFlow.tsx (useSigners().addSigners — the real
 * consent dialog, used in TEE mode). This module owns everything the server
 * needs to back that grant: ensure the committed policy exists, attach it to
 * the member's wallet, and record the durable grant.
 */

let policyCache: Policy | null = null;

export function grantBoundsFromConfig(now: Date, config: AppConfig = loadConfig()): GrantBounds {
  return grantBounds(now, config);
}

/**
 * Creates the committed contribution policy through the Privy SDK (or returns
 * the one created earlier in this process).
 */
export async function ensureContributionPolicy(
  privy: PrivyClient = createPrivyClient(),
  now: Date = new Date(),
  config: AppConfig = loadConfig(),
): Promise<Policy> {
  if (!policyCache) {
    policyCache = await privy.policies().create(
      buildContributionPolicy(grantBoundsFromConfig(now, config)),
    );
  }
  return policyCache;
}

/**
 * Resolves a member wallet by its on-chain address so we operate on the wallet
 * id Privy actually knows.
 */
export async function getWalletByAddress(
  address: string,
  privy: PrivyClient = createPrivyClient(),
) {
  return privy.wallets().getWalletByAddress({ address });
}

/**
 * Attaches the committed contribution policy to a member wallet. This is the
 * enforcement point: from now on, only transfers that satisfy the policy
 * (destination contract, amount ceiling, expiry) are allowed to be signed with
 * the server's authorization key.
 */
export async function attachContributionPolicyToWallet(
  walletId: string,
  ctx: AuthorizationContext = getAuthorizationContext(),
  privy: PrivyClient = createPrivyClient(),
): Promise<Policy> {
  const policy = await ensureContributionPolicy(privy);
  await privy.wallets().update(walletId, {
    policy_ids: [policy.id],
    authorization_context: ctx,
  });
  return policy;
}

/**
 * Records the granted delegation in local storage so the job and dashboard can
 * reason about it. The single active grant per member is the most recent row.
 */
export type { AppConfig } from '../config';