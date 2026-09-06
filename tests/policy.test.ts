import { describe, expect, it } from 'vitest';
import { buildContributionPolicy } from '../lib/policy/contribution-policy';

const CONFIG = {
  tokenAddress: '0xTokenAddress00000000000000000000000000001',
  potRecipient: '0xPotRecipient00000000000000000000000000002',
  amountCeiling: '5.0',
  chain: 'base_sepolia',
  expiresAt: 1767225600,
};

function rule(method: 'transfer' | '*') {
  const rules = buildContributionPolicy(CONFIG).rules;
  const found = rules.find((r) => r.method === method);
  expect(found, `expected a "${method}" rule`).toBeDefined();
  return found!;
}

function condition(field: string) {
  const r = rule('transfer');
  const c = r.conditions.find((c) => 'field' in c && c.field === field);
  expect(c, `expected condition on "${field}"`).toBeDefined();
  return c!;
}

describe('committed contribution policy (Checks 2/3/4)', () => {
  it('is a valid policy create payload (version 1.0, ethereum)', () => {
    const policy = buildContributionPolicy(CONFIG);
    expect(policy.version).toBe('1.0');
    expect(policy.chain_type).toBe('ethereum');
  });

  it('Check 2: allowlists only the pot contract as the transfer destination', () => {
    const c = condition('destination.address');
    expect(c).toMatchObject({
      field_source: 'action_request_body',
      operator: 'eq',
      value: CONFIG.potRecipient.toLowerCase(),
    });
  });

  it('Check 3: caps every transfer at the weekly contribution amount', () => {
    const c = condition('source.amount');
    expect(c).toMatchObject({
      field_source: 'action_request_body',
      operator: 'lte',
      value: CONFIG.amountCeiling,
    });
  });

  it('restricts the source to the committed token and chain', () => {
    expect(condition('source.asset_address')).toMatchObject({
      operator: 'eq',
      value: CONFIG.tokenAddress.toLowerCase(),
    });
    expect(condition('source.chain')).toMatchObject({ operator: 'eq', value: CONFIG.chain });
  });

  it('Check 4: time-expires via the system timestamp', () => {
    const c = condition('current_unix_timestamp');
    expect(c).toMatchObject({
      field_source: 'system',
      operator: 'lte',
      value: String(CONFIG.expiresAt),
    });
  });

  it('default-denies everything outside the weekly transfer', () => {
    const deny = rule('*');
    expect(deny.action).toBe('DENY');
    expect(deny.conditions).toHaveLength(0);
  });
});