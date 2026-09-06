'use client';

import { useEffect, useState } from 'react';
import type { ContributionRow } from '@/lib/db/repo';

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Pending',
  success: 'Paid',
  failed: 'Failed',
  skipped: 'Skipped',
};

export default function ContributionHistory({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/members/${encodeURIComponent(memberId)}/contributions`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setRows(body.contributions ?? []);
      })
      .catch(() => !cancelled && setError('Failed to load contributions.'));
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (error) return <p className="error">{error}</p>;
  if (rows.length === 0) {
    return (
      <p className="detail">
        No contributions yet — the first one lands on the next weekly run.
      </p>
    );
  }

  return (
    <div>
      <h3>Contribution history</h3>
      <table>
        <thead>
          <tr>
            <th>Week</th>
            <th>Status</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.period}>
              <td>{row.period}</td>
              <td>
                <span className={`badge ${row.status}`}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </span>
                {row.status === 'failed' && (
                  <div className="detail">
                    Didn&rsquo;t go through this week — we retry on the next run.
                  </div>
                )}
              </td>
              <td>
                {row.tx_hash ? (
                  <span className="code" title={row.tx_hash}>
                    {row.tx_hash.slice(0, 12)}…
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}