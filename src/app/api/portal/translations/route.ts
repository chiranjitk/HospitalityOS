/**
 * Portal Translations API
 *
 * GET /api/portal/translations?lang=en
 *
 * Returns translations for the guest portal in the requested language.
 * Falls back to English if the language is not supported.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortalTranslation, getSupportedLanguages } from '@/lib/i18n/portal-translations';

export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang') || 'en';
  const t = getPortalTranslation(lang);

  return NextResponse.json({
    success: true,
    data: {
      lang,
      translations: t,
    },
    supportedLanguages: getSupportedLanguages(),
  });
}
