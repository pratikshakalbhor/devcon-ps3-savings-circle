import { randomUUID } from 'node:crypto';
import type { DB } from './client';

export type MemberStatus = 'active' | 'revoked';
export type ContributionStatus = 'in_progress' | 'success' | 'failed';

export interface MemberRow {
  id: string;
  did: string;
  wallet_id: string;
  wallet_address: string;
  status: MemberStatus;
  joined_at: number;
}

export interface GrantRow {
  id: string;
  member_id: string;
  policy_id: string;
  token_address: string;
  pot_recipient: string;
  amount_ceiling: string;
  expires_at: number;
  granted_at: number;
  revoked_at: number | null;
}

export interface ContributionRow {
  member_id: string;
  period: string;
  status: ContributionStatus;
  tx_hash: string | null;
  error: string | null;
  attempted_at: number;
}

export interface ActiveContributor extends MemberRow {
  wallet_id: string;
  grant: GrantRow;
}

export interface GrantInput {
  policy_id: string;
  token_address: string;
  pot_recipient: string;
  amount_ceiling: string;
  expires_at: number;
  granted_at: number;
}

function rowToMember(row: Record<string, unknown>): MemberRow {
  return {
    id: String(row.id),
    did: String(row.did),
    wallet_id: String(row.wallet_id),
    wallet_address: String(row.wallet_address),
    status: row.status as MemberStatus,
    joined_at: Number(row.joined_at),
  };
}

function rowToGrant(row: Record<string, unknown>): GrantRow {
  return {
    id: String(row.id),
    member_id: String(row.member_id),
    policy_id: String(row.policy_id),
    token_address: String(row.token_address),
    pot_recipient: String(row.pot_recipient),
    amount_ceiling: String(row.amount_ceiling),
    expires_at: Number(row.expires_at),
    granted_at: Number(row.granted_at),
    revoked_at: row.revoked_at === null ? null : Number(row.revoked_at),
  };
}

function rowToContribution(row: Record<string, unknown>): ContributionRow {
  return {
    member_id: String(row.member_id),
    period: String(row.period),
    status: row.status as ContributionStatus,
    tx_hash: row.tx_hash === null ? null : String(row.tx_hash),
    error: row.error === null ? null : String(row.error),
    attempted_at: Number(row.attempted_at),
  };
}

export function createMember(
  db: DB,
  input: { did: string; wallet_id: string; wallet_address: string; now: Date },
): MemberRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO members (id, did, wallet_id, wallet_address, status, joined_at)
     VALUES (?, ?, ?, ?, 'active', ?)`,
  ).run(id, input.did, input.wallet_id, input.wallet_address, input.now.getTime());
  const row = db.prepare(`SELECT * FROM members WHERE id = ?`).get(id);
  return rowToMember(row as Record<string, unknown>);
}

export function findMemberByDid(db: DB, did: string): MemberRow | undefined {
  const row = db.prepare(`SELECT * FROM members WHERE did = ?`).get(did);
  return row ? rowToMember(row as Record<string, unknown>) : undefined;
}

export function findMemberById(db: DB, id: string): MemberRow | undefined {
  const row = db.prepare(`SELECT * FROM members WHERE id = ?`).get(id);
  return row ? rowToMember(row as Record<string, unknown>) : undefined;
}

export function revokeMember(db: DB, memberId: string, at: Date): MemberRow | undefined {
  db.prepare(`UPDATE members SET status = 'revoked' WHERE id = ?`).run(memberId);
  db.prepare(`UPDATE grants SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL`).run(
    at.getTime(),
    memberId,
  );
  return findMemberById(db, memberId);
}

export function insertGrant(db: DB, memberId: string, input: GrantInput): GrantRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO grants (id, member_id, policy_id, token_address, pot_recipient, amount_ceiling, expires_at, granted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    memberId,
    input.policy_id,
    input.token_address,
    input.pot_recipient,
    input.amount_ceiling,
    input.expires_at,
    input.granted_at,
  );
  const row = db.prepare(`SELECT * FROM grants WHERE id = ?`).get(id);
  return rowToGrant(row as Record<string, unknown>);
}

export function findLatestGrant(db: DB, memberId: string): GrantRow | undefined {
  const row = db
    .prepare(`SELECT * FROM grants WHERE member_id = ? ORDER BY granted_at DESC, id DESC LIMIT 1`)
    .get(memberId);
  return row ? rowToGrant(row as Record<string, unknown>) : undefined;
}

export function findContribution(db: DB, memberId: string, period: string): ContributionRow | undefined {
  const row = db
    .prepare(`SELECT * FROM contributions WHERE member_id = ? AND period = ?`)
    .get(memberId, period);
  return row ? rowToContribution(row as Record<string, unknown>) : undefined;
}

export function insertContribution(
  db: DB,
  input: { member_id: string; period: string; status: ContributionStatus; attempted_at: number },
): ContributionRow {
  db.prepare(
    `INSERT INTO contributions (member_id, period, status, tx_hash, error, attempted_at)
     VALUES (?, ?, ?, NULL, NULL, ?)`,
  ).run(input.member_id, input.period, input.status, input.attempted_at);
  return findContribution(db, input.member_id, input.period)!;
}

export function updateContributionStatus(
  db: DB,
  memberId: string,
  period: string,
  patch: { status: ContributionStatus; tx_hash?: string | null; error?: string | null },
): ContributionRow | undefined {
  db.prepare(
    `UPDATE contributions SET status = ?, tx_hash = ?, error = ?
     WHERE member_id = ? AND period = ?`,
  ).run(patch.status, patch.tx_hash ?? null, patch.error ?? null, memberId, period);
  return findContribution(db, memberId, period);
}

export function listContributions(db: DB, memberId: string): ContributionRow[] {
  const rows = db
    .prepare(`SELECT * FROM contributions WHERE member_id = ? ORDER BY period DESC`)
    .all(memberId) as unknown as Record<string, unknown>[];
  return rows.map(rowToContribution);
}

export function listActiveContributors(db: DB): ActiveContributor[] {
  const rows = db
    .prepare(
      `SELECT m.id AS member_id, m.did, m.wallet_id, m.wallet_address, m.status, m.joined_at,
              g.id AS grant_id, g.policy_id, g.token_address, g.pot_recipient, g.amount_ceiling,
              g.expires_at, g.granted_at, g.revoked_at
       FROM members m
       JOIN grants g ON g.member_id = m.id AND g.revoked_at IS NULL
       WHERE m.status = 'active'
       ORDER BY m.joined_at ASC`,
    )
    .all() as unknown as Record<string, unknown>[];
  return rows.map((row) => {
    const member = rowToMember({
      id: row.member_id,
      did: row.did,
      wallet_id: row.wallet_id,
      wallet_address: row.wallet_address,
      status: row.status,
      joined_at: row.joined_at,
    });
    const grant = rowToGrant({
      id: row.grant_id,
      member_id: String(row.member_id),
      policy_id: row.policy_id,
      token_address: row.token_address,
      pot_recipient: row.pot_recipient,
      amount_ceiling: row.amount_ceiling,
      expires_at: row.expires_at,
      granted_at: row.granted_at,
      revoked_at: row.revoked_at,
    });
    return { ...member, grant };
  });
}