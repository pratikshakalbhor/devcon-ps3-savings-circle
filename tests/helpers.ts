import { randomUUID } from 'node:crypto';
import type { DB } from '../lib/db/client';
import { openDb } from '../lib/db/client';
import { createMember, insertGrant, type MemberRow } from '../lib/db/repo';

export const TOKEN_ADDRESS = '0xfoocoin0000000000000000000000000000000000';
export const POT_RECIPIENT = '0xpotcontract0000000000000000000000000000000';
export const CHAIN = 'base_sepolia';
export const AMOUNT = '5.0';
export const EXPIRES_AT = 1767225600;

export function addActiveMember(
  db: DB,
  overrides: { did?: string; wallet_id?: string; wallet_address?: string } = {},
): MemberRow {
  const did = overrides.did ?? `did:privy:${randomUUID()}`;
  const wallet_id = overrides.wallet_id ?? `wal_${randomUUID()}`;
  const wallet_address = overrides.wallet_address ?? `0x${'ab'.repeat(20)}_${randomUUID()}`;
  const joinedAt = new Date('2026-01-01T00:00:00Z');
  const member = createMember(db, { did, wallet_id, wallet_address, now: joinedAt });
  insertGrant(db, member.id, {
    policy_id: `pol_${randomUUID()}`,
    token_address: TOKEN_ADDRESS,
    pot_recipient: POT_RECIPIENT,
    amount_ceiling: AMOUNT,
    expires_at: EXPIRES_AT,
    granted_at: joinedAt.getTime(),
  });
  return member;
}

export function makeTestDb(): DB {
  return openDb(':memory:');
}