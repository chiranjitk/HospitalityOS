/**
 * Captive Portal Layout — Isolated from admin theme
 *
 * The /connect page is a PUBLIC captive portal that should NOT inherit
 * the admin dashboard styling (sidebar, header, etc.) or providers.
 * This layout ensures the portal renders as a standalone fullscreen page.
 *
 * We reset body margin/padding but let the portal component manage
 * its own full-screen background, fonts, and colors dynamically.
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
    <>
      {/* Reset body margin/padding — portal manages its own full-screen background */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body {
              margin: 0 !important;
              padding: 0 !important;
              min-height: 100vh;
            }
          `,
        }}
      />
      <div className="min-h-screen">
        {children}
      </div>
    </>
  );
}
