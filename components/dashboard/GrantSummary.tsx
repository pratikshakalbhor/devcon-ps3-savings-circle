'use client';

import { useEffect, useState } from 'react';
import type { GrantRow, MemberRow } from '@/lib/db/repo';

interface Summary {
  member?: MemberRow;
  grant?: GrantRow;
}

function reasonablyRemaining(expiresAt: number): string {
  const hideFuture = () => {
    if (Number.isNaN(expiresAt)) return '—';
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 'expired';
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return `${days} day${days === 1 ? '' : 's'}`;
  };
  return hideFuture();
}

export default function GrantSummary({ memberId }: { memberId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/members/${encodeURIComponent(memberId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setSummary(body);
      })
      .catch(() => !cancelled && setError('Failed to load your membership.'));
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (error) return <p className="error">{error}</p>;
  if (!summary?.member || !summary.grant) return <p className="detail">Loading…</p>;

  const { member, grant } = summary;
  const revoked = member.status === 'revoked' || grant.revoked_at !== null;

  return (
    <div>
      <div className="rule">
        <h3>Your authorization</h3>
        <p>
          You&rsquo;ve authorized up to <strong>{grant.amount_ceiling}</strong>{' '}
          tokens a week to the Circle&rsquo;s pot, until{' '}
          <strong>{new Date(grant.expires_at).toLocaleDateString()}</strong>.
          {revoked && <span> This arrangement has ended.</span>}
        </p>
        <table>
          <tbody>
            <tr>
              <th>Status</th>
              <td>
                <span className={`badge ${revoked ? 'revoked' : 'active'}`}>
                  {revoked ? 'Ended' : 'Active'}
                </span>
              </td>
            </tr>
            <tr>
              <th>Weekly amount</th>
              <td>
                {grant.amount_ceiling} tokens, once a week
              </td>
            </tr>
            <tr>
              <th>Token</th>
              <td>
                <span className="code">{grant.token_address}</span>
              </td>
            </tr>
            <tr>
              <th>Destination</th>
              <td>
                <span className="code">{grant.pot_recipient}</span>
              </td>
            </tr>
            <tr>
              <th>Granted</th>
              <td>{new Date(grant.granted_at).toLocaleDateString()}</td>
            </tr>
            <tr>
              <th>Expires</th>
              <td>
                {new Date(grant.expires_at).toLocaleDateString()}{' '}
                <span className="detail">({reasonablyRemaining(grant.expires_at)})</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}