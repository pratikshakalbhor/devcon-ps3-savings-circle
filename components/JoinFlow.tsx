'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSigners, usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import LoadingScreen from './LoadingScreen';
import LoginScreen from './LoginScreen';
import ContributeCTA from './ContributeCTA';

interface PublicConfig {
  amountCeiling: string;
  tokenAddress: string;
  potRecipient: string;
  signerId: string;
  chain: string;
  expiryDays: number;
}

export default function JoinFlow() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { addSigners } = useSigners();
  const { createWallet } = useCreateWallet();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [phase, setPhase] = useState<'idle' | 'creating' | 'granting'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  if (!ready || !walletsReady) return <LoadingScreen />;
  if (!authenticated) return <LoginScreen />;
  if (!config) return <LoadingScreen />;

  const embeddedWallet = wallets.find((wallet) => wallet.connectorType === 'embedded');

  const hasGranted = () => {
    try {
      return Boolean(window.localStorage.getItem('devcon-ps3.member-id'));
    } catch {
      return false;
    }
  };

  if (hasGranted()) {
    return (
      <div className="page">
        <ContributeCTA
          action="You are already in."
          description="Your delegation is already on file. Head to your dashboard to review or end it."
          ctaLabel="Go to dashboard"
          onCta={() => router.push('/dashboard')}
        />
      </div>
    );
  }

  async function handleAuthorizeOnce() {
    try {
      setError(null);
      setPhase('creating');

      if (!config) {
        throw new Error('Configuration not loaded yet.');
      }

      const embedAddress = embeddedWallet?.address;
      let address = embedAddress;
      if (!address) {
        const wallet = await createWallet();
        address = wallet?.address;
      }
      if (!address) {
        throw new Error('No embedded wallet available to grant access to.');
      }

      setPhase('granting');
      await addSigners({
        address,
        signers: [{ signerId: config.signerId }],
      });

      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Missing access token.');

      const res = await fetch('/api/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, walletAddress: address }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Grant failed');
      }

      const data = await res.json();
      try {
        window.localStorage.setItem('devcon-ps3.member-id', data.memberId);
      } catch {
        // localStorage unavailable — dashboard id still passed via query
      }

      router.push(`/dashboard?memberId=${encodeURIComponent(data.memberId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setPhase('idle');
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1>devcon-ps3</h1>
        <p className="subtitle">Authorize once — then stop asking.</p>

        <p>
          Join as a member. You approve this just <strong>once</strong>, and we
          handle the rest — a small payment from your wallet to the Circle&rsquo;s
          pot, automatically, every week.
        </p>

        <div className="rule">
          <h3>What you authorize</h3>
          <table>
            <tbody>
              <tr>
                <th>Amount</th>
                <td>
                  up to <strong>{config.amountCeiling}</strong> tokens — once a
                  week
                </td>
              </tr>
              <tr>
                <th>Token</th>
                <td>
                  <span className="code">{config.tokenAddress}</span>
                </td>
              </tr>
              <tr>
                <th>Destination</th>
                <td>
                  <span className="code">{config.potRecipient}</span>
                </td>
              </tr>
              <tr>
                <th>Expires</th>
                <td>
                  {config.expiryDays} days after joining — then we stop, no
                  further confirmation needed
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rule">
          <h3>What we promise</h3>
          <ul>
            <li>Only the pot address above ever receives funds.</li>
            <li>Never more than the weekly amount, ever.</li>
            <li>Nothing happens after the expiry date — no action needed from you.</li>
            <li>End the arrangement any time from your dashboard.</li>
          </ul>
          <p className="detail">
            These limits are enforced by your wallet itself, not just promised
            in good faith.
          </p>
        </div>

        <button onClick={handleAuthorizeOnce} disabled={phase !== 'idle'}>
          {phase === 'creating'
            ? 'Creating your wallet…'
            : phase === 'granting'
              ? 'Confirming authorization…'
              : 'Authorize once — then stop asking'}
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}