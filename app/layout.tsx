import './globals.css';
import PrivyProvider from '../providers/PrivyProvider';

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider>{children}</PrivyProvider>
      </body>
    </html>
  );
}