import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Self-Service Kiosk — StaySuite HospitalityOS",
  description: "Express check-in and check-out self-service kiosk for hotel guests.",
};

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Standalone layout: bypasses all app chrome (no sidebar, no header).
  // The root layout still provides harmless providers (Auth, Theme, etc.)
  // but this page never calls those contexts.
  return (
    <div className="kiosk-standalone">
      {children}
    </div>
  );
}
