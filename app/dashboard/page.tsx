'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GrantSummary from '@/components/dashboard/GrantSummary';
import RevokeButton from '@/components/dashboard/RevokeButton';
import ContributionHistory from '@/components/dashboard/ContributionHistory';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get('memberId');
    if (fromQuery) {
      setMemberId(fromQuery);
      try {
        window.localStorage.setItem('devcon-ps3.member-id', fromQuery);
      } catch {
        // ignore
      }
      return;
    }
    try {
      const stored = window.localStorage.getItem('devcon-ps3.member-id');
      if (stored) setMemberId(stored);
    } catch {
      // ignore
    }
  }, [searchParams]);

  if (!memberId) {
    return (
      <div className="page">
        <div className="card">
          <p className="subtitle">
            You are not a member yet.{' '}
            <a href="/">Authorize once to join.</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Your membership</h1>
        <p className="subtitle">
          The weekly contribution runs automatically until the expiry date — or
          until you end it.
        </p>
        <GrantSummary memberId={memberId} />
        {revoked ? (
          <p className="badge revoked">You have ended this arrangement.</p>
        ) : (
          <div className="cta">
            <RevokeButton memberId={memberId} onRevoked={() => setRevoked(true)} />
            <button className="secondary" onClick={() => router.push('/')}>
              Back to home
            </button>
          </div>
        )}
        <ContributionHistory memberId={memberId} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}