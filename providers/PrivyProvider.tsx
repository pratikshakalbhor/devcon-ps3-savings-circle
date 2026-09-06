'use client';

import { PrivyProvider as PrivyProviderRoot } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

/**
 * Client-side Privy provider for the join flow (Phase 1).
 *
 * Login methods: Email + Google. An Ethereum embedded wallet is auto-created
 * on login (`createOnLogin: 'all-users'`) — this is exactly what the granted
 * access in the join flow delegates FROM (see Step 2 findings: delegated
 * actions run on the embedded wallet; no smart wallet is required).
 */
export default function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

  if (!appId) {
    return (
      <div className="page">
        <div className="card">
          <h1>devcon-ps3</h1>
          <p className="subtitle">
            NEXT_PUBLIC_PRIVY_APP_ID is not set. Copy{' '}
            <span className="code">.env.example</span> to{' '}
            <span className="code">.env</span> and add your Privy app id, then
            restart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProviderRoot
      appId={appId}
      config={{
        loginMethods: ['email', 'google'],
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
        },
      }}
    >
      {children}
    </PrivyProviderRoot>
  );
}