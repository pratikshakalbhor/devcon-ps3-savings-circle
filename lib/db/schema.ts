export const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY NOT NULL,
  did TEXT NOT NULL UNIQUE,
  wallet_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  joined_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  policy_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  pot_recipient TEXT NOT NULL,
  amount_ceiling TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS contributions (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'success', 'failed')),
  tx_hash TEXT,
  error TEXT,
  attempted_at INTEGER NOT NULL,
  PRIMARY KEY (member_id, period)
);

CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_grants_member ON grants(member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_period ON contributions(period);
`;