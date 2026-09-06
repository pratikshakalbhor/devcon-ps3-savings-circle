import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { findMemberById, listContributions } from '@/lib/db/repo';

export const runtime = 'nodejs';

interface Params {
  memberId: string;
}

/**
 * GET /api/members/[memberId]/contributions
 *
 * Contribution history for the dashboard.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { memberId } = await params;
    const db = getDb();
    const member = findMemberById(db, memberId);
    if (!member) {
      return NextResponse.json({ error: 'Unknown member' }, { status: 404 });
    }
    return NextResponse.json({ contributions: listContributions(db, memberId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}