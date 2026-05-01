/**
 * Captive Portal Layout — Isolated from admin theme
 *
 * The /connect page is a PUBLIC captive portal that should NOT inherit
 * the admin dashboard styling (sidebar, header, etc.) or providers.
 * This layout ensures the portal renders as a standalone fullscreen page.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connect to WiFi',
  description: 'WiFi captive portal - connect to the hotel network',
};

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
