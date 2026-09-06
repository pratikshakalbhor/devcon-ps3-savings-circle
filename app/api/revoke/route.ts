import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenOrThrow } from '@/lib/auth/privy-server';
import { getDb } from '@/lib/db/client';
import { findMemberById, revokeMember } from '@/lib/db/repo';

export const runtime = 'nodejs';

interface RevokeRequestBody {
  accessToken?: string;
  memberId?: string;
}

/**
 * POST /api/revoke
 *
 * Durable revocation: flips the member to `revoked` and marks the grant
 * revoked so the weekly job never attempts a transfer for them again. The
 * client also calls useSigners().removeSigners() to take the server's signer
 * access away inside Privy itself (TEE mode).
 */
export async function POST(request: NextRequest) {
  try {
    const body: RevokeRequestBody = await request.json().catch(() => ({} as Record<string, unknown>));
    const { accessToken, memberId } = body;

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }
    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
    }

    await verifyAccessTokenOrThrow(accessToken);

    const db = getDb();
    const member = findMemberById(db, memberId);
    if (!member) {
      return NextResponse.json({ error: 'Unknown member' }, { status: 404 });
    }

    const revoked = revokeMember(db, memberId, new Date());
    return NextResponse.json({ memberId, status: revoked?.status ?? 'revoked' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}