'use client';

import { usePrivy } from '@privy-io/react-auth';

export default function LoginScreen() {
  const { login } = usePrivy();
  return (
    <div className="page">
      <div className="card">
        <h1>devcon-ps3</h1>
        <p className="subtitle">Authorize once — then stop asking.</p>
        <p>
          A recurring membership: you sign one delegation, and we move your
          weekly contribution to the pot automatically. No popup fatigue.
        </p>
        <button onClick={() => login()}>Join with email</button>
      </div>
    </div>
  );
}