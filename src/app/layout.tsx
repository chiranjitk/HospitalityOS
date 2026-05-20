import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
import Script from 'next/script';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <head>
        {/* Inline FOUC prevention — runs before React hydration */}
        <Script
          id="theme-fouc-prevention"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('staysuite-theme-mode-next');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');document.documentElement.style.setProperty('color-scheme',d?'dark':'light')}catch(e){}})()`,
          }}
        />
        {/* Prevent layout shift when dropdowns/modals open — neutralizes react-remove-scroll-bar */}
        <Script
          id="prevent-scroll-lock-shift"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){function clean(){var b=document.body;if(b.style.paddingRight&&b.style.paddingRight!=='0px'&&b.style.paddingRight!==''){b.style.paddingRight='';}if(b.style.marginRight&&b.style.marginRight!=='0px'&&b.style.marginRight!==''){b.style.marginRight='';}if(b.hasAttribute('data-scroll-locked')){b.removeAttribute('data-scroll-locked');}}var m=new MutationObserver(clean);m.observe(document.body,{attributes:true,attributeFilter:['style','class']});try{document.documentElement.style.scrollbarGutter='stable';}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
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
