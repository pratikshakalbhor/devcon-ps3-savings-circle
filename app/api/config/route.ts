import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';

export const runtime = 'nodejs';

/** Public (non-secret) config for rendering the join screen and dashboard. */
export async function GET() {
  const config = loadConfig();
  return NextResponse.json({
    amountCeiling: config.amountCeiling,
    tokenAddress: config.tokenAddress,
    potRecipient: config.potRecipient,
    signerId: config.signerId,
    chain: config.chain,
    expiryDays: config.expiryDays,
  });
}