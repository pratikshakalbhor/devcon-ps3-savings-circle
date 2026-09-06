import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { findMemberById, findLatestGrant } from '@/lib/db/repo';

export const runtime = 'nodejs';

interface Params {
  memberId: string;
}

/**
 * GET /api/members/[memberId]
 *
 * Member + latest grant summary for the dashboard.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { memberId } = await params;
    const db = getDb();
    const member = findMemberById(db, memberId);
    if (!member) {
      return NextResponse.json({ error: 'Unknown member' }, { status: 404 });
    }
    const grant = findLatestGrant(db, memberId);
    return NextResponse.json({ member, grant });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}