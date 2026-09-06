'use client';

import { useState } from 'react';
import { useSigners, usePrivy, useWallets } from '@privy-io/react-auth';

export default function RevokeButton({
  memberId,
  onRevoked,
}: {
  memberId: string;
  onRevoked: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { removeSigners } = useSigners();
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    try {
      setRevoking(true);
      setError(null);

      // Takes the server's signer access away inside Privy (the consent/dialog flow).
      const embeddedWallet = wallets.find((wallet) => wallet.connectorType === 'embedded');
      if (!embeddedWallet?.address) {
        throw new Error('No embedded wallet found to remove signer access from.');
      }
      await removeSigners({ address: embeddedWallet.address });

      // Durable server-side gate: stops the weekly job for this member even if
      // it is already queued.
      const accessToken = await getAccessToken();
      const res = await fetch('/api/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, memberId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Revocation failed');
      }

      onRevoked();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      {!confirming ? (
        <button className="danger" onClick={() => setConfirming(true)}>
          Leave the Circle
        </button>
      ) : (
        <div className="rule">
          <p>
            This ends your membership and stops your weekly contribution right
            away. You can rejoin any time.
          </p>
          <div className="cta">
            <button className="danger" onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Ending…' : 'Yes, end my membership'}
            </button>
            <button className="secondary" onClick={() => setConfirming(false)} disabled={revoking}>
              Keep my membership
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}