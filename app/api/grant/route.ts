import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { createMember, findMemberByDid, insertGrant } from '@/lib/db/repo';
import { grantBoundsFromConfig, getWalletByAddress } from '@/lib/wallet/session-signer-client';
import { attachContributionPolicyToWallet } from '@/lib/wallet/session-signer-client';
import { verifyAccessTokenOrThrow } from '@/lib/auth/privy-server';
import { loadConfig } from '@/lib/config';

export const runtime = 'nodejs';

interface GrantRequestBody {
  accessToken?: string;
  walletAddress?: string;
}

/**
 * POST /api/grant
 *
 * Backs the client-side delegated-actions consent dialog. Records the member
 * + durable grant and, critically, attaches the committed contribution policy
 * to their wallet so the weekly job can only ever transact within its bounds.
 */
export async function POST(request: NextRequest) {
  try {
    const body: GrantRequestBody = await request.json().catch(() => ({} as Record<string, unknown>));
    const accessToken = body.accessToken;
    const walletAddress = body.walletAddress;

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    // Verify the caller really owns this session (Check 5: server-side auth).
    const verified = await verifyAccessTokenOrThrow(accessToken);
    const did = verified.user_id;

    const db = getDb();
    const config = loadConfig();
    const now = new Date();

    // Resolve the authoritative wallet record so policy attach targets the
    // correct wallet id.
    const wallet = await getWalletByAddress(walletAddress);

    // Attach the committed policy (contract allowance, amount ceiling, expiry)
    // and sign the wallet update with the env-provided authorization key.
    const policy = await attachContributionPolicyToWallet(wallet.id);

    let member = findMemberByDid(db, did);
    if (!member) {
      member = createMember(db, {
        did,
        wallet_id: wallet.id,
        wallet_address: wallet.address,
        now,
      });
    }

    const bounds = grantBoundsFromConfig(now, config);
    const grant = insertGrant(db, member.id, {
      policy_id: policy.id,
      token_address: bounds.tokenAddress,
      pot_recipient: bounds.potRecipient,
      amount_ceiling: bounds.amountCeiling,
      expires_at: bounds.expiresAt,
      granted_at: now.getTime(),
    });

    return NextResponse.json({
      memberId: member.id,
      walletId: wallet.id,
      grant,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}