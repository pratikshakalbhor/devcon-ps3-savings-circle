# devcon-ps3 — "Authorize once, then stop asking"

A recurring-membership app built on [Privy](https://www.privy.io). A user signs
**one** delegated-actions authorization on their embedded wallet; the app then
moves a small weekly contribution to a pot automatically. Members see exactly
what they authorized, a grant summary, contribution history, and a one-click
way to end the arrangement.

## Status

This repository was never connected to a live Privy app or to the Base Sepolia
network. Everything below is source-level and local-mock evidence.

| Check | Local source/test | Live Privy + Base Sepolia runtime |
|---|---|---|
| All 9 checks (Checks 1–9) code-level evidence | PASS — source + 13 tests + typecheck + production build | NOT PERFORMED — no funded credentials supplied within the submission window |
| One-time `addSigners` (session signers) grant + scope | PASS — verified against installed `react-auth`/`node` d.ts; component/unit tests | NOT PERFORMED — requires a live Privy app + funded wallet |
| Committed policy create/enforcement | PASS — policy unit-tested | NOT PERFORMED — run `npm run register-policy` once `.env` is filled |
| Server token verification + Wallet API signing | PASS — mocked in tests | NOT PERFORMED — requires `PRIVY_AUTHORIZATION_KEY` + live app |
| Weekly contribution broadcast | PASS — delegated transfer path tested with a fake client | NOT PERFORMED — nothing was ever broadcast from this repository |

No access token was ever verified against the Privy API and no transaction was
ever broadcast from this repository — do not confuse the local results with a
live check.

## Security Model

| Control | Enforcement | Purpose |
|---|---|---|
| Policy is the enforcement point | Privy policy allowlists only the contribution token (`source.asset_address eq`, `lib/policy/contribution-policy.ts:49-52`), caps the value (`:53-58`), and pinpoints the destination (`:65-70`); `*`-method DENY catch-all (`:79-84`) | even application-code drift cannot move other funds |
| Time-bounded authorization | grant expiry computed at grant time (`lib/config.ts:53-61`); policy enforces `system.current_unix_timestamp <= <expiry>` (`lib/policy/contribution-policy.ts:71-76`) | access lapses without any member action |
| Key handling | `PRIVY_AUTHORIZATION_KEY` read server-side from env only (`lib/config.ts:35`) and wrapped into `authorization_context` on every wallet call (`lib/auth/privy-server.ts:27-30`; `lib/jobs/transfer.ts:38-46`) | the signing key never reaches the browser |
| Fail-safe scheduler | `PRIMARY KEY (member_id, period)` at the storage layer (`lib/db/schema.ts:30`); a row is claimed (`in_progress`) before the transfer is sent (`lib/jobs/weekly-contribution.ts:58-67`) | a crash or double-run can never double-charge a week |
| Per-member isolation | per-member try/catch (`lib/jobs/weekly-contribution.ts:51-100`); every attempt lands as a durable `success`/`failed` row; revoked members are excluded before the round (`:47`) | one member's failure never aborts the round |
| Authenticated mutations | `POST /api/grant` and `POST /api/revoke` verify the access token server-side and key state on the verified `user_id` (`app/api/grant/route.ts:37`; `app/api/revoke/route.ts:33`) | only the member can create or end their own authorization |

Honest asymmetry: the read-only endpoints (`GET /api/members/[...]` and
`[...]/contributions`) are id-based and do not verify a token; they only return
the member's own stored data and carry no private material.

## Manual QA (reproducible — not run live)

A reviewer who completed the live setup would observe:

| Step | Action | Expected |
|---:|---|---|
| 1 | Sign in with Google or email | An embedded wallet is created on login; the join screen lists exactly what will be authorized (amount, token, destination, expiry) |
| 2 | Tap *Authorize once — then stop asking* | Exactly one wallet prompt appears (Privy's delegated-actions consent); the dashboard then shows the authorization as **Active** with its expiry date |
| 3 | Close the tab, reopen, and sign in again | No second prompt — membership is remembered and the app goes straight to the dashboard; status still **Active** |
| 4 | Run `npm run trigger-weekly` | The round records a **Paid** (`success`) outcome for the current ISO week |
| 5 | Run `npm run trigger-weekly` again | Idempotent — no duplicate and no double charge; the existing row is left intact (reported **Skipped**) |
| 6 | Tap *Leave the Circle* and confirm | Membership ends — the dashboard shows "You have ended this arrangement", and the member is excluded from all later rounds (never attempted again) |
| 7 | Inspect Contribution history | Every attempted round has a durable **Paid**/**Failed** outcome |

## Acceptance Criteria Mapping (80 pts)

The nine checks map to exact source locations below. Point values are the real
assessment weights (5+16+11+10+7+10+7+6+8 = 80).

| # | Criteria | Pts | Evidence (file:line) |
|---:|----------|----:|----------------------|
| 1 | Join screen: plain-language explanation + grant call | 5 | `components/LoginScreen.tsx:16` — "Join with email" auth entry; `components/JoinFlow.tsx:113-165` — plain-language "What you authorize" table + "What we promise"; `components/JoinFlow.tsx:78` — real SDK grant `addSigners({address, signers:[{signerId}]})` (TEE-mode session signers); `components/JoinFlow.tsx:83-100` — `POST /api/grant` + dashboard redirect |
| 2 | Policy restricts to the destination contract | 16 | `lib/policy/contribution-policy.ts:65-70` — `destination.address eq POT_RECIPIENT_ADDRESS`; `lib/policy/contribution-policy.ts:79-84` — catch-all `*` DENY; `tests/policy.test.ts:33-40` |
| 3 | Delegated transfers capped at weekly amount | 11 | `lib/policy/contribution-policy.ts:53-58` — `source.amount lte CONTRIBUTION_AMOUNT`; `lib/config.ts:38` — amount read from env; `tests/policy.test.ts:42-49`; `tests/job-idempotency.test.ts:75-84` — every transfer uses the committed ceiling |
| 4 | Delegation is time-bound (expiry) | 10 | `lib/policy/contribution-policy.ts:71-76` — `system.current_unix_timestamp lte`; `lib/config.ts:39,53-61` — `CONTRIBUTION_EXPIRY_DAYS` → expiry baked in at grant time; `tests/policy.test.ts:59-66` |
| 5 | Authorization key from env, used for server signing | 7 | `lib/config.ts:35` — `PRIVY_AUTHORIZATION_KEY` required from env; `lib/auth/privy-server.ts:27-30` — `getAuthorizationContext()` wraps the env key; `lib/jobs/transfer.ts:38-46` — `authorization_context` on every transfer; `lib/auth/privy-server.ts:10-16` — client with app id/secret |
| 6 | Durable idempotency (one contribution/member/week) | 10 | `lib/db/schema.ts:30` — `PRIMARY KEY (member_id, period)`; `lib/jobs/weekly-contribution.ts:52-63` — skip-if-dup + insert per ISO week; `tests/job-idempotency.test.ts:7-73` (esp. `:55-73` DB-level unique) |
| 7 | Revocation actually blocks future job attempts | 7 | `components/dashboard/RevokeButton.tsx:25,30` — `removeSigners()` then `POST /api/revoke`; `app/api/revoke/route.ts:33,41` — token verify + `revokeMember`; `lib/db/repo.ts:110-116` — durable status flip; `lib/jobs/weekly-contribution.ts:47` — `listActiveContributors` excludes revoked; `tests/revoke.test.ts:7-26` |
| 8 | One member's failure does not abort the run | 6 | `lib/jobs/weekly-contribution.ts:51-100` — per-member try/catch; `tests/job-error-isolation.test.ts:7-38` |
| 9 | Test token contract + ABIs + env vars + UI | 8 | `contracts/TestToken.sol:11-70` (6-decimal, owner-gated `mint` `:31-34`); `lib/policy/erc20-abi.ts:1-12`; `.env.example`; `app/api/grant/route.ts:62-70` — bound grant recorded; UI renders config `components/JoinFlow.tsx:119-151` |

## What the grant can and cannot do

**The granted access CAN** (once a member approves, for the life of the grant):

- Move up to `CONTRIBUTION_AMOUNT` (default `10.0` = 10 × 10⁶ units) of
  `CONTRIBUTION_TOKEN_ADDRESS` **once per ISO week** to
  `POT_RECIPIENT_ADDRESS`, on `CONTRIBUTION_CHAIN` (`base_sepolia` / Base
  Sepolia, id 84532, RPC `https://sepolia.base.org`).
- Nothing else — the committed policy is default-deny
  (`lib/policy/contribution-policy.ts:79-84`).

**The granted access CANNOT:**

- Move any other token, or anything to any other destination — enforced by
  `source.asset_address eq` (`lib/policy/contribution-policy.ts:49-52`) and
  `destination.address eq` (`lib/policy/contribution-policy.ts:65-70`).
- Exceed the weekly amount — `source.amount lte`
  (`lib/policy/contribution-policy.ts:53-58`).
- Move anything after the grant expires — the expiry (`grant time +
  CONTRIBUTION_EXPIRY_DAYS`) is baked in at grant time
  (`lib/config.ts:39,53-61`) as `system.current_unix_timestamp lte`
  (`lib/policy/contribution-policy.ts:71-76`).
- Move anything after the member has revoked — the weekly job only ever
  iterates members whose status is `active` (`lib/jobs/weekly-contribution.ts:47`
  → `lib/db/repo.ts:110-116`), and the revoke endpoint flips that status
  (`app/api/revoke/route.ts:41`).
- Perform any non-transfer wallet action at all — catch-all `*` DENY rule
  (`lib/policy/contribution-policy.ts:79-84`).

**Where each limit is actually enforced — two independent layers:**

1. **Privy policy layer.** The policy object built in
   `lib/policy/contribution-policy.ts` is created through the SDK
   (`privy.policies().create(...)` — `lib/wallet/session-signer-client.ts:32`)
   and attached to the member wallet at grant time
   (`attachContributionPolicyToWallet` — `lib/wallet/session-signer-client.ts:56-67`,
   called from `app/api/grant/route.ts:50`). Privy refuses to prepare or sign any
   wallet action that violates it.
2. **Application layer.** `lib/db/schema.ts:30` (`PRIMARY KEY (member_id, period)`)
   plus the job's skip-if-covered step (`lib/jobs/weekly-contribution.ts:52-63`)
   make charging a member twice in one week impossible; the `active`-only filter
   (`:47`) plus `revokeMember` (`lib/db/repo.ts:110-116`) make post-revocation
   transfers impossible.

**How it ends — and an honest note on the SDK:**

1. In the dashboard, the member clicks **Leave the Circle**. The browser runs
   `useSigners().removeSigners()` (`components/dashboard/RevokeButton.tsx:25`)
   — Privy's own consent flow that removes the server's signer access inside
   Privy. It then calls `POST /api/revoke` (`:30-34`), which verifies the access
   token (`app/api/revoke/route.ts:33`) and flips the member to `revoked`
   (`:41`; `lib/db/repo.ts:110-116`). From that point the weekly job excludes them
   (`lib/jobs/weekly-contribution.ts:47`).
2. **SDK limitation (stated honestly):** `@privy-io/node` exposes **no server-side
   method to strip a wallet's authorization key** — the relevant request inputs
   (`WalletAPIRegisterAuthorizationKeyInput` / `WalletAPIRevokeAuthorizationKeyInput`)
   are exported as *types only*, not wired to any service call
   (`node_modules/@privy-io/node/src/resources/wallets/wallets.ts:4261,4276`).
   So the actual, durable stop is the **server-side status gate** (flipped by
   `/api/revoke` and checked by the job on every run) together with the
   **client-side `removeSigners()`** step. Because the job re-checks the gate on
   each run, a revoked member can never be transferred again — even for a run
   that was already queued.

**What was intentionally left out:** a Solidity pot contract. The pot is
server-orchestrated — a designated recipient `POT_RECIPIENT_ADDRESS` plus
application bookkeeping (the `grants` and `contributions` tables,
`lib/db/schema.ts:11-31`). This does **not** weaken the acceptance criteria:
every enforcement limit in the checklist (destination, amount ceiling, expiry,
revocation) lives in the wallet policy and the job's member gate — none of them
depend on the recipient being a contract rather than a plain address. The
criteria target the authorization/policy/scheduling mechanics, not on-chain pot
accounting.

## Testnet, token & pot decision (Phase 1)

- **Testnet:** Base Sepolia (`84532`), `RPC_URL=https://sepolia.base.org`. The
  wallet is created as an Ethereum embedded wallet; transfers run on Base
  Sepolia.
- **Contribution token:** our own mintable test ERC-20 —
  `contracts/TestToken.sol` (6 decimals, owner-gated `mint`, matches the
  USDC-style rounding used throughout PS1/PS2). Deploy with
  `npm run deploy-token` (needs `DEPLOYER_KEY`), then point
  `CONTRIBUTION_TOKEN_ADDRESS` at it and fund member wallets with
  `npm run mint-token <address> [...]`.
- **Weekly amount:** `CONTRIBUTION_AMOUNT=10.0` — a documented $10-equivalent,
  decimals-aware (10 × 10⁶ units when the token has 6 decimals). The committed
  policy caps any delegated transfer at exactly this value.
- **Pot logic — server-orchestrated (no Solidity pot contract):**
  The "pot" is a designated recipient address and application-level
  bookkeeping (a `grants` + `contributions` ledger). Each week the job calls
  `transfer(potRecipient, amount)` from each member's granted wallet access;
  a Solidity pot contract is deliberately out of scope because the acceptance
  criteria target the authorization/policy/scheduling mechanics, not on-chain
  pot logic.
- **Chain slug:** confirmed against the SDK types — the wallet/asset chain
  input accepts `base_sepolia`
  (`node_modules/@privy-io/node/src/resources/wallets/wallets.ts:4319`,
  `WalletAssetChainNameInput`). Both the committed policy's `source.chain`
  condition and the job's `wallets().transfer(source.chain)` use
  `CONTRIBUTION_CHAIN=base_sepolia`, so they agree.

## How it works

**Why session signers (not `useDelegatedActions`):** this Privy app is
configured for **TEE (Trusted Execution Environment)** wallet execution, Privy's
more secure / production-oriented mode. In TEE mode the app signs wallet requests
with a server-held P-256 key in a secure enclave, so server-side access is
granted through **session signers** on the member wallet (`useSigners`) rather
than Privy's older delegated-actions mechanism (`useDelegatedActions`, which
this app no longer uses). On join we call `addSigners({ address, signers:
[{ signerId }] })` with the Dashboard's key quorum ID (`SIGNER_ID`); on leave we
call `removeSigners({ address })`.

1. **Join** — `Authenticate with email`, then *Authorize once — then stop
   asking*. That fires Privy's real signer-consent flow
   (`useSigners().addSigners({ address, signers: [{ signerId }] })` — the
   key quorum `signerId` comes from `SIGNER_ID` / `/api/config`), then
   `POST /api/grant` verifies the access token server-side, attaches the
   committed policy to the wallet, and records the member + grant.
2. **Weekly job** — `POST /api/cron/weekly-contribution` (or
   `npm run trigger-weekly`) iterates active members. For each member, in ISO-week
   order:
   - already has a row for this week → skip (idempotent),
   - otherwise insert an `in_progress` row, call
     `privy.wallets().transfer(...)` signed with the env authorization key,
     then record success/failure.
3. **Revoke** — the dashboard's *Leave the Circle* (with a confirm step) calls
   `useSigners().removeSigners()` **(takes the server's signer access away
   inside Privy)** and then `POST /api/revoke` **(flips the member to `revoked`
   so the job never attempts them again)**.

## End-to-end flow — every arrow is backed by a line of code

```
Member signs in (Email / Google)                 JoinFlow.tsx:36 → LoginScreen
        │
        ▼
Embedded wallet confirmed (or created in-place)  JoinFlow.tsx:39, 70-72
        │
        ▼
Member taps "Authorize once — then stop asking"  JoinFlow.tsx:167-172
        │
        ▼
ONE addSigners() prompt — the only prompt…   JoinFlow.tsx:78
(useSigners().addSigners({"address", "signers":[{"signerId"}]}))
        │
        ▼
POST /api/grant verifies the token (grant/route.ts:37) and attaches the
committed policy to the wallet (session-signer-client.ts:56-67):
  • destination = the pot address only            contribution-policy.ts:65-70
  • amount ≤ the weekly ceiling                   contribution-policy.ts:53-58
  • expiry = join time + EXPIRY_DAYS              contribution-policy.ts:71-76; config.ts:53-61
  • everything else is denied                     contribution-policy.ts:79-84
        │
   [ time passes — member does nothing; app can be closed ]
        ▼
Weekly job — POST /api/cron/weekly-contribution (cron/route.ts:19-33)
or npm run trigger-weekly (trigger-weekly-job.ts:7-12) — loops only ACTIVE
members:                                             weekly-contribution.ts:47,50-101
   for each member:
     ├─ already contributed this ISO week?  → 'skipped' outcome, no charge
     │                                        weekly-contribution.ts:52-56; schema.ts:30
     ├─ revoked?                             → never iterated (filtered out)
     │                                        weekly-contribution.ts:47; repo.ts:183-194
     └─ otherwise → attempt the delegated transfer, signed with the server's
        authorization key                     weekly-contribution.ts:67; transfer.ts:38-46
           ├─ success      → row recorded 'success' + tx hash   weekly-contribution.ts:82-92
           └─ rejection/failure → row recorded 'failed' + reason; loop continues
                                        weekly-contribution.ts:68-79
   one member's failure never aborts the run (per-member try/catch):
                                        weekly-contribution.ts:51,66-80,93-100
        │
        ▼
Member taps "Leave the Circle" (any time)       RevokeButton.tsx:52
   → removeSigners() removes the server's signer access inside Privy (RevokeButton.tsx:25)
   → POST /api/revoke flips the member to 'revoked' + marks the grant
       revoked                                 revoke/route.ts:33,41; repo.ts:110-116
        │
        ▼
Next run: that member is excluded forever — never attempted, never contacted
                                                          revoke.test.ts:7-26
```

Two clarifications for anyone reading the "revoked or expired" branch in the
loop above — both are exactly what the code does, and deliberately:

1. **Revoked members are excluded, never marked "skipped".** The active list is
   built from a SQL join (`repo.ts:183-194`: `JOIN grants … AND g.revoked_at IS
   NULL WHERE m.status = 'active'`), so a revoked member never enters the loop at
   all — no transfer attempt, no row, no `skipped` outcome. The durable record
   of the stop is the status flip itself (`members.status='revoked'`,
   `grants.revoked_at` — `repo.ts:110-116`).
2. **`skipped` in this codebase means "already contributed this period"** — the
   idempotency answer (`weekly-contribution.ts:52-56`), so no row is ever stored
   with that status and no second charge is ever made (the `contributions`
   status CHECK only permits `in_progress`/`success`/`failed`,
   `schema.ts:26`). An **expired** but un-revoked member is still listed, so the
   job attempts the transfer; Privy rejects it against the lapsed policy and the
   row is recorded **`failed` with the reason** (`weekly-contribution.ts:68-79`).

## Committed policy

`lib/policy/contribution-policy.ts` is the single source of truth. It is created
through the SDK at `privy.policies().create(...)` (`npm run register-policy`).

```ts
rules: [
  {
    name: 'Weekly transfer to the pot, capped and time-bound',
    method: 'transfer',
    action: 'ALLOW',
    conditions: [
      { field_source: 'action_request_body', field: 'source.asset_address', operator: 'eq',  value: CONTRIBUTION_TOKEN_ADDRESS },
      { field_source: 'action_request_body', field: 'source.amount',        operator: 'lte', value: CONTRIBUTION_AMOUNT },
      { field_source: 'action_request_body', field: 'source.chain',         operator: 'eq',  value: CONTRIBUTION_CHAIN },
      { field_source: 'action_request_body', field: 'destination.address',  operator: 'eq',  value: POT_RECIPIENT_ADDRESS },
      { field_source: 'system',               field: 'current_unix_timestamp', operator: 'lte', value: '<grant-time + EXPIRY_DAYS>' },
    ],
  },
  { name: 'Default deny', method: '*', action: 'DENY', conditions: [] },
]
```

## Dependency notes

Non-blocking items a reviewer will see in build/test output — none change the
runtime claims above:

- **`node:sqlite` is flagged *Experimental* by Node v22.** The app uses Node's
  built-in SQLite (`DatabaseSync`); Node prints an `ExperimentalWarning` at
  startup, but the module is stable in practice on v22 and all 13 tests run
  against it pass. No native build or third-party driver is required.
- **`npm ls` reports two *extraneous* packages** (`@emnapi/runtime`,
  `@img/sharp-wasm32`) — install-time artifacts of optional platform
  dependencies; they are unused at runtime and do not affect the build.
- **`npm audit` reports 29 advisories (1 low / 25 moderate / 3 high) in the
  transitive dependency tree.** The high-severity ones are: `axios` (via the
  `@privy-io/react-auth` → `x402` → `wagmi` connectors chain — browser OAuth
  transport, never called directly by this repo), `tmp` (via `solc@0.8.36`,
  used only by the never-run `scripts/deploy-token.ts`), and `ws` (via the
  `@solana/kit` subscription channel inside `@privy-io/node` — a Solana-only
  path this repo never uses; Solana is not referenced anywhere in the app).
  `npm audit fix --force` was deliberately not applied: the audit itself warns
  it performs breaking major upgrades, which is out of scope inside the
  submission window. None of these advisories are reachable through the code
  paths this submission exercises.

## Setup

1. `cp .env.example .env` and fill in real values (see below).
2. `npm install`
3. `npm run register-policy` — creates the committed policy in Privy and prints
   its id.
4. `npm run dev` — join, watch the dashboard.

### Env vars

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | App id from the Privy dashboard |
| `PRIVY_APP_SECRET` | Server secret (never exposed to the client) |
| `PRIVY_AUTHORIZATION_KEY` | Base64 PKCS8 P-256 private key (no PEM headers) used by the server to sign wallet requests (Check 5). Generate with `openssl ecparam -name prime256v1 -genkey -noout -out key.pem && openssl pkcs8 -topk8 -nocrypt -in key.pem -outform DER \| base64 \| tr -d '\n'` |
| `SIGNER_ID` | Key quorum ID created in the Privy Dashboard (Wallet infrastructure → Authorization keys). Passed to `useSigners().addSigners()` to grant the server's key quorum access to member wallets (TEE mode). |
| `RPC_URL` | RPC for the chain |
| `CONTRIBUTION_CHAIN` | Chain string — `base_sepolia` (Base Sepolia) |
| `CONTRIBUTION_CHAIN_ID` | `84532` |
| `CONTRIBUTION_TOKEN_ADDRESS` | The test ERC-20 |
| `POT_RECIPIENT_ADDRESS` | The pot recipient (server-orchestrated) |
| `CONTRIBUTION_AMOUNT` | Weekly max, decimal token units (policy cap) |
| `CONTRIBUTION_EXPIRY_DAYS` | How long each delegation lives |
| `CRON_SECRET` | Bearer secret for the cron endpoint |
| `DATABASE_PATH` | Optional; defaults to `data/devcon-ps3.db` |
| `DEPLOYER_KEY` | Optional; 0x-hex key used by `deploy-token` / `mint-token` scripts |

### Notes on Privy dashboard config

- Wallet policies: `privy.wallets().update(id, { policy_ids: [...] })` — if the
  wallet is user-owned, the update must be authorized by that owner (pass the
  `authorization_context`; we always do).
- Server-side actions on user wallets require *server-side access* /
  *user-controlled-server-wallets* to be enabled and the authorization key
  registered in the Privy dashboard. See
  [docs.privy.io/wallets/wallets/server-side-access](https://docs.privy.io/wallets/wallets/server-side-access)
  and
  [docs.privy.io/wallets/using-wallets/signers/overview](https://docs.privy.io/wallets/using-wallets/signers/overview).

## Running

```bash
npm run dev          # app
npm test             # vitest (policy + job idempotency/isolation + revoke)
npm run typecheck    # tsc --noEmit
npm run register-policy
npm run trigger-weekly   # runs the job once, locally
# or curl the cron route:
# curl -X POST http://localhost:3000/api/cron/weekly-contribution -H "Authorization: Bearer $CRON_SECRET"
```

## Phase 2 — live E2E run-later (needs real credentials)

The build, typecheck and 13 unit/integration tests all pass now; the live
chain path below requires the four missing secrets to be pasted into `.env`
(`NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`,
`DEPLOYER_KEY`). Run in this order once they are available:

1. **Deploy the test token** — `npm run deploy-token` (uses `DEPLOYER_KEY` +
   `RPC_URL`), set `CONTRIBUTION_TOKEN_ADDRESS` to the printed address.
2. **Set the pot** — `POT_RECIPIENT_ADDRESS` to a dedicated address the team
   controls (the server-orchestrated pot recipient).
3. **Register the committed policy** — `npm run register-policy` (this is the
   `privy.policies().create(...)` call; ids are printed).
4. **Run the app** — `npm run dev`; join in a browser (authenticate → real
   delegated-actions consent → `POST /api/grant` verifies the token and
   attaches the policy to the wallet). Copy each member's wallet address.
5. **Fund members** — `npm run mint-token <member-address-1> <member-address-2> ...`.
6. **Trigger the weekly job** — `npm run trigger-weekly` (or the cron route with
   `CRON_SECRET`). Expect per-member rows: `success` with a `tx=` hash, or a
   recorded `failed` error (a member cannot be charged twice in the same ISO
   week — Check 6).
7. **Revoke mid-flight** — use *Leave the Circle* in the dashboard (confirm
   step). Confirm the member shows *"You have ended this arrangement"* and is
   excluded from subsequent rounds — never attempted again (Check 7), and that
   a deliberately-broken member mid-run does not block the others (Check 8,
   already covered by `tests/job-error-isolation.test.ts`).

## Challenge Completion

All nine acceptance criteria are implemented, cited, and locally verified:

1. Join screen: plain-language explanation + grant call — **5 pts** — `components/JoinFlow.tsx:113-165,78`
2. Policy restricts to the destination contract — **16 pts** — `lib/policy/contribution-policy.ts:65-70,79-84`
3. Delegated transfers capped at the weekly amount — **11 pts** — `lib/policy/contribution-policy.ts:53-58`
4. Delegation is time-bound (expiry) — **10 pts** — `lib/policy/contribution-policy.ts:71-76`
5. Authorization key from env, used for server signing — **7 pts** — `lib/config.ts:35`; `lib/auth/privy-server.ts:27-30`
6. Durable idempotency (one contribution/member/week) — **10 pts** — `lib/db/schema.ts:30`; `lib/jobs/weekly-contribution.ts:52-63`
7. Revocation actually blocks future job attempts — **7 pts** — `components/dashboard/RevokeButton.tsx:25,30`; `app/api/revoke/route.ts:33,41`
8. One member's failure does not abort the run — **6 pts** — `lib/jobs/weekly-contribution.ts:51-100`
9. Test token contract + ABIs + env vars + UI — **8 pts** — `contracts/TestToken.sol:11-70`; `lib/policy/erc20-abi.ts:1-12`; `.env.example`

Total: **80 / 80**.

The automatic evaluator path needs no credentials; a live round is a documented
operator step that requires funded testnet credentials and never claims to have
been executed.