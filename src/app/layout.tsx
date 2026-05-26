import type { Metadata } from "next";
import "./globals.css";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { UIStyleProvider } from "@/components/theme/ui-style-provider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { TaxProvider } from "@/contexts/TaxContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, type Locale, defaultLocale, isValidLocale } from '@/i18n/config';
import { I18nProvider } from '@/contexts/I18nContext';
import { PwaRegister } from '@/components/common/pwa-register';
import { PwaInstallPrompt } from '@/components/common/pwa-install-prompt';
import { FoucGuard } from '@/components/common/fouc-guard';

// System fonts (Google Fonts unreachable in sandbox)
// Restore Geist/Geist_Mono from next/font/google when network available

export const metadata: Metadata = {
  title: "StaySuite HospitalityOS - Multi-Tenant SaaS Platform",
  description: "Complete hospitality management system with 24 modules for hotels, resorts, and property management.",
  keywords: ["Hospitality", "Hotel Management", "PMS", "Booking", "SaaS", "Multi-tenant"],
  authors: [{ name: "StaySuite Team" }],
  icons: {
    icon: "/images/cryptsk-logo.png",
    apple: "/images/cryptsk-logo.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "StaySuite HospitalityOS",
    description: "Complete hospitality management platform",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StaySuite",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get locale from cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;

  let locale: Locale = defaultLocale;

  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale as Locale;
  }

  // Load messages for the locale
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={"antialiased bg-background text-foreground"}
      >
        {/* FOUC Guard — runs in useLayoutEffect before browser paint */}
        <FoucGuard />
        <UIStyleProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <I18nProvider>
              <AuthProvider>
                <PermissionProvider>
                  <FeatureFlagsProvider>
                    <CurrencyProvider>
                      <TimezoneProvider>
                        <SettingsProvider>
                          <TaxProvider>
                            {children}
                          </TaxProvider>
                        </SettingsProvider>
                      </TimezoneProvider>
                    </CurrencyProvider>
                  </FeatureFlagsProvider>
                </PermissionProvider>
                <PwaRegister />
                <PwaInstallPrompt />
                <ShadcnToaster />
                <SonnerToaster />
              </AuthProvider>
            </I18nProvider>
          </NextIntlClientProvider>
        </UIStyleProvider>
      </body>
    </html>
  );
}
