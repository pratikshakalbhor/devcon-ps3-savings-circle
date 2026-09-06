import type { PolicyCreateParams } from '@privy-io/node/resources';
import type { GrantBounds } from '../config';

/**
 * The committed policy for the devcon-ps3 recurring contribution.
 *
 * This object is the single source of truth for what a member's delegated
 * authorization may do. It is created through the Privy SDK
 * (`privy.policies().create(...)`) so it lives in Privy's policy store and is
 * attached to each member's wallet via `privy.wallets().update(...)`.
 *
 * Constraints (checklist mapping):
 * - Check 2 (allowlisted destination contract): only `POT_RECIPIENT_ADDRESS`
 *   is ever allowed as the transfer destination.
 * - Check 3 (amount ceiling): `source.amount <= CONTRIBUTION_AMOUNT`.
 * - Check 4 (time expiry): `system.current_unix_timestamp <= <expiry>`,
 *   baked in at grant time as CONTRIBUTION_EXPIRY_DAYS.
 *
 * A catch-all `*` DENY rule ensures everything outside the weekly transfer is
 * refused (default-deny).
 */

export const CONTRIBUTION_POLICY_NAME =
  'Weekly Contribution Policy';

export interface ContributionPolicyConfig extends GrantBounds {
  tokenAddress: string;
  potRecipient: string;
  amountCeiling: string;
  chain: string;
  expiresAt: number;
}

export function buildContributionPolicy(
  config: ContributionPolicyConfig,
): PolicyCreateParams {
  return {
    version: '1.0',
    name: CONTRIBUTION_POLICY_NAME,
    chain_type: 'ethereum',
    rules: [
      {
        name: 'Weekly transfer to the pot, capped and time-bound',
        method: 'transfer',
        action: 'ALLOW',
        conditions: [
          {
            field_source: 'action_request_body',
            field: 'source.asset_address',
            operator: 'eq',
            value: config.tokenAddress.toLowerCase(),
          },
          {
            field_source: 'action_request_body',
            field: 'source.amount',
            operator: 'lte',
            value: config.amountCeiling,
          },
          {
            field_source: 'action_request_body',
            field: 'source.chain',
            operator: 'eq',
            value: config.chain,
          },
          {
            field_source: 'action_request_body',
            field: 'destination.address',
            operator: 'eq',
            value: config.potRecipient.toLowerCase(),
          },
          {
            field_source: 'system',
            field: 'current_unix_timestamp',
            operator: 'lte',
            value: String(config.expiresAt),
          },
        ],
      },
      {
        name: 'Default deny',
        method: '*',
        action: 'DENY',
        conditions: [],
      },
    ],
  };
}