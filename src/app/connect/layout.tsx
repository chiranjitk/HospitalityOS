/**
 * Captive Portal Layout — Isolated from admin theme
 *
 * The /connect page is a PUBLIC captive portal that should NOT inherit
 * the admin dashboard styling (sidebar, header, etc.) or providers.
 * This layout ensures the portal renders as a standalone fullscreen page.
 *
 * We reset ALL CSS variables and body styles to prevent the admin theme
 * (light/dark mode, background colors, fonts) from leaking into the portal.
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
      {/* Reset ALL inherited theme styles so the portal renders standalone */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Reset body background — portal manages its own full-screen background */
            body {
              background-color: #0f766e !important;
              background-image: none !important;
              margin: 0 !important;
              padding: 0 !important;
              min-height: 100vh;
            }
            /* Prevent Next.js theme variables from overriding portal styles */
            :root {
              --background: #0f766e;
              --foreground: #fafafa;
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
