/**
 * Portal Translations (i18n)
 *
 * Multi-language support for the guest portal.
 * Supported languages: en, hi, es, fr, de, ar
 */

type TranslationMap = Record<string, Record<string, string>>;

const translations: TranslationMap = {
  en: {
    welcome: 'Welcome',
    good_morning: 'Good Morning',
    good_evening: 'Good Evening',
    checkout: 'Check-out',
    feedback: 'Feedback',
    room_service: 'Room Service',
    my_bill: 'My Bill',
    digital_key: 'Digital Key',
    hotel_info: 'Hotel Info',
    spa: 'Spa & Wellness',
    restaurant: 'Restaurant',
    help: 'Help & Support',
    language: 'Language',
  },
  hi: {
    welcome: 'स्वागत है',
    good_morning: 'सुप्रभात',
    good_evening: 'शुभ संध्या',
    checkout: 'चेक-आउट',
    feedback: 'प्रतिक्रिया',
    room_service: 'रूम सर्विस',
    my_bill: 'मेरा बिल',
    digital_key: 'डिजिटल कुंजी',
    hotel_info: 'होटल जानकारी',
    spa: 'स्पा और वेलनेस',
    restaurant: 'रेस्टोरेंट',
    help: 'सहायता और समर्थन',
    language: 'भाषा',
  },
  es: {
    welcome: 'Bienvenido',
    good_morning: 'Buenos Días',
    good_evening: 'Buenas Tardes',
    checkout: 'Check-out',
    feedback: 'Comentarios',
    room_service: 'Servicio de Habitación',
    my_bill: 'Mi Cuenta',
    digital_key: 'Llave Digital',
    hotel_info: 'Información del Hotel',
    spa: 'Spa y Bienestar',
    restaurant: 'Restaurante',
    help: 'Ayuda y Soporte',
    language: 'Idioma',
  },
  fr: {
    welcome: 'Bienvenue',
    good_morning: 'Bonjour',
    good_evening: 'Bonsoir',
    checkout: 'Départ',
    feedback: 'Commentaires',
    room_service: 'Service en Chambre',
    my_bill: 'Ma Facture',
    digital_key: 'Clé Numérique',
    hotel_info: 'Infos Hôtel',
    spa: 'Spa et Bien-être',
    restaurant: 'Restaurant',
    help: 'Aide et Support',
    language: 'Langue',
  },
  de: {
    welcome: 'Willkommen',
    good_morning: 'Guten Morgen',
    good_evening: 'Guten Abend',
    checkout: 'Check-out',
    feedback: 'Feedback',
    room_service: 'Zimmerservice',
    my_bill: 'Meine Rechnung',
    digital_key: 'Digitalschlüssel',
    hotel_info: 'Hotelinformationen',
    spa: 'Spa & Wellness',
    restaurant: 'Restaurant',
    help: 'Hilfe & Support',
    language: 'Sprache',
  },
  ar: {
    welcome: 'مرحباً',
    good_morning: 'صباح الخير',
    good_evening: 'مساء الخير',
    checkout: 'تسجيل الخروج',
    feedback: 'ملاحظات',
    room_service: 'خدمة الغرف',
    my_bill: 'فاتورتي',
    digital_key: 'مفتاح رقمي',
    hotel_info: 'معلومات الفندق',
    spa: 'سبا ووينس',
    restaurant: 'مطعم',
    help: 'المساعدة والدعم',
    language: 'اللغة',
  },
};

const DEFAULT_LANG = 'en';
const supportedLanguages = Object.keys(translations);

/**
 * Get translations for a specific language.
 * Falls back to English if the requested language is not supported.
 *
 * @param lang - Language code (e.g., 'en', 'hi', 'es')
 * @returns Record of translation key → translated string
 */
export function getPortalTranslation(lang: string): Record<string, string> {
  const normalizedLang = lang.toLowerCase().trim();
  return translations[normalizedLang] || translations[DEFAULT_LANG];
}

/**
 * Get the list of supported language codes.
 */
export function getSupportedLanguages(): string[] {
  return supportedLanguages;
}
