/**
 * StaySuite Theme Configuration
 *
 * Default Theme:
 * 1. hospitality-sunrise - Warm orange and white for hotels and resorts (DEFAULT)
 *
 * Original Themes:
 * 2. gradient-modern - Bold gradients, vibrant violet/indigo
 * 3. neumorphism - Soft UI with subtle shadows
 *
 * Enterprise Themes:
 * 4. slate-enterprise - ServiceNow/Workday professional SaaS
 * 5. terra-corporate - Luxury hotel warm corporate
 * 6. arctic-steel - Salesforce Lightning productivity SaaS
 * 7. noir-executive - Boardroom luxury dark minimal
 */

export type ThemeId = 
  | 'hospitality-sunrise'
  | 'gradient-modern'
  | 'neumorphism'
  | 'slate-enterprise'
  | 'terra-corporate'
  | 'arctic-steel'
  | 'noir-executive';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
  input: string;
  destructive: string;
  destructiveForeground: string;
  gradientStart: string;
  gradientEnd: string;
  premium: string;
  premiumForeground: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  icon: string;
  category: 'default' | 'original' | 'enterprise';
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  features: {
    glassEffect: boolean;
    softShadows: boolean;
    gradients: boolean;
    roundedCorners: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    animations: boolean;
    neonGlow: boolean;
  };
}

export const themes: Record<ThemeId, ThemeConfig> = {
  // ============================================
  // DEFAULT THEME
  // ============================================

  'hospitality-sunrise': {
    id: 'hospitality-sunrise',
    name: 'Hospitality Sunrise',
    description: 'Warm hospitality theme with vibrant orange and clean white — designed for hotels and resorts.',
    icon: 'Sun',
    category: 'default',
    colors: {
      light: {
        primary: 'oklch(0.65 0.20 55)',
        primaryForeground: 'oklch(0.99 0 0)',
        secondary: 'oklch(0.97 0 0)',
        secondaryForeground: 'oklch(0.25 0 0)',
        accent: 'oklch(0.97 0 0)',
        accentForeground: 'oklch(0.25 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.15 0 0)',
        card: 'oklch(1 0 0)',
        cardForeground: 'oklch(0.15 0 0)',
        muted: 'oklch(0.96 0 0)',
        mutedForeground: 'oklch(0.50 0 0)',
        border: 'oklch(0.92 0 0)',
        ring: 'oklch(0.65 0.20 55)',
        input: 'oklch(0.92 0 0)',
        destructive: 'oklch(0.55 0.22 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.68 0.22 55)',
        gradientEnd: 'oklch(0.62 0.18 40)',
        premium: 'oklch(0.78 0.14 75)',
        premiumForeground: 'oklch(0.15 0.02 75)',
        sidebar: 'oklch(0.99 0 0)',
        sidebarForeground: 'oklch(0.20 0 0)',
        sidebarPrimary: 'oklch(0.68 0.22 55)',
        sidebarPrimaryForeground: 'oklch(0.99 0 0)',
        sidebarAccent: 'oklch(0.97 0 0)',
        sidebarAccentForeground: 'oklch(0.20 0 0)',
        sidebarBorder: 'oklch(0.92 0 0)',
        sidebarRing: 'oklch(0.65 0.20 55)',
        chart1: 'oklch(0.65 0.20 55)',
        chart2: 'oklch(0.60 0.16 40)',
        chart3: 'oklch(0.55 0.12 75)',
        chart4: 'oklch(0.65 0.14 142)',
        chart5: 'oklch(0.70 0.10 280)',
      },
      dark: {
        primary: 'oklch(0.72 0.20 55)',
        primaryForeground: 'oklch(0.12 0 0)',
        secondary: 'oklch(0.20 0 0)',
        secondaryForeground: 'oklch(0.90 0 0)',
        accent: 'oklch(0.22 0 0)',
        accentForeground: 'oklch(0.90 0 0)',
        background: 'oklch(0.10 0 0)',
        foreground: 'oklch(0.95 0 0)',
        card: 'oklch(0.13 0 0)',
        cardForeground: 'oklch(0.95 0 0)',
        muted: 'oklch(0.18 0 0)',
        mutedForeground: 'oklch(0.60 0 0)',
        border: 'oklch(0.24 0 0)',
        ring: 'oklch(0.72 0.20 55)',
        input: 'oklch(0.24 0 0)',
        destructive: 'oklch(0.60 0.22 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.72 0.22 55)',
        gradientEnd: 'oklch(0.65 0.18 40)',
        premium: 'oklch(0.78 0.14 75)',
        premiumForeground: 'oklch(0.12 0.02 75)',
        sidebar: 'oklch(0.08 0 0)',
        sidebarForeground: 'oklch(0.92 0 0)',
        sidebarPrimary: 'oklch(0.72 0.20 55)',
        sidebarPrimaryForeground: 'oklch(0.99 0 0)',
        sidebarAccent: 'oklch(0.18 0 0)',
        sidebarAccentForeground: 'oklch(0.92 0 0)',
        sidebarBorder: 'oklch(0.20 0 0)',
        sidebarRing: 'oklch(0.72 0.20 55)',
        chart1: 'oklch(0.72 0.20 55)',
        chart2: 'oklch(0.65 0.16 40)',
        chart3: 'oklch(0.60 0.12 75)',
        chart4: 'oklch(0.70 0.14 142)',
        chart5: 'oklch(0.75 0.10 280)',
      },
    },
    features: {
      glassEffect: false,
      softShadows: true,
      gradients: true,
      roundedCorners: 'xl',
      animations: true,
      neonGlow: false,
    },
  },

  // ============================================
  // ORIGINAL THEMES
  // ============================================

  'gradient-modern': {
    id: 'gradient-modern',
    name: 'Gradient Modern',
    description: 'Bold gradients with vibrant violet and indigo colors.',
    icon: 'Sparkles',
    category: 'original',
    colors: {
      light: {
        primary: 'oklch(0.48 0.18 275)',
        primaryForeground: 'oklch(0.99 0 0)',
        secondary: 'oklch(0.97 0 0)',
        secondaryForeground: 'oklch(0.25 0.04 275)',
        accent: 'oklch(0.97 0 0)',
        accentForeground: 'oklch(0.25 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.15 0.02 270)',
        card: 'oklch(1 0 0)',
        cardForeground: 'oklch(0.15 0.02 270)',
        muted: 'oklch(0.96 0 0)',
        mutedForeground: 'oklch(0.50 0.02 270)',
        border: 'oklch(0.92 0 0)',
        ring: 'oklch(0.48 0.18 275)',
        input: 'oklch(0.92 0 0)',
        destructive: 'oklch(0.55 0.22 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.50 0.20 275)',
        gradientEnd: 'oklch(0.45 0.18 290)',
        premium: 'oklch(0.75 0.15 75)',
        premiumForeground: 'oklch(0.20 0.02 75)',
        sidebar: 'oklch(0.99 0 0)',
        sidebarForeground: 'oklch(0.22 0.03 275)',
        sidebarPrimary: 'oklch(0.50 0.20 275)',
        sidebarPrimaryForeground: 'oklch(0.99 0 0)',
        sidebarAccent: 'oklch(0.97 0 0)',
        sidebarAccentForeground: 'oklch(0.20 0 0)',
        sidebarBorder: 'oklch(0.92 0 0)',
        sidebarRing: 'oklch(0.50 0.20 275)',
        chart1: 'oklch(0.50 0.20 275)',
        chart2: 'oklch(0.55 0.18 290)',
        chart3: 'oklch(0.60 0.16 310)',
        chart4: 'oklch(0.65 0.14 142)',
        chart5: 'oklch(0.70 0.12 60)',
      },
      dark: {
        primary: 'oklch(0.65 0.20 275)',
        primaryForeground: 'oklch(0.12 0.015 275)',
        secondary: 'oklch(0.20 0 0)',
        secondaryForeground: 'oklch(0.90 0.02 275)',
        accent: 'oklch(0.22 0 0)',
        accentForeground: 'oklch(0.90 0.02 275)',
        background: 'oklch(0.10 0 0)',
        foreground: 'oklch(0.95 0.01 270)',
        card: 'oklch(0.13 0 0)',
        cardForeground: 'oklch(0.95 0.01 270)',
        muted: 'oklch(0.18 0 0)',
        mutedForeground: 'oklch(0.65 0.02 270)',
        border: 'oklch(0.24 0 0)',
        ring: 'oklch(0.65 0.20 275)',
        input: 'oklch(0.24 0 0)',
        destructive: 'oklch(0.60 0.22 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.65 0.22 275)',
        gradientEnd: 'oklch(0.60 0.20 290)',
        premium: 'oklch(0.75 0.15 75)',
        premiumForeground: 'oklch(0.20 0.02 75)',
        sidebar: 'oklch(0.08 0 0)',
        sidebarForeground: 'oklch(0.92 0.01 270)',
        sidebarPrimary: 'oklch(0.65 0.20 275)',
        sidebarPrimaryForeground: 'oklch(0.99 0 0)',
        sidebarAccent: 'oklch(0.18 0 0)',
        sidebarAccentForeground: 'oklch(0.92 0 0)',
        sidebarBorder: 'oklch(0.20 0 0)',
        sidebarRing: 'oklch(0.65 0.20 275)',
        chart1: 'oklch(0.65 0.20 275)',
        chart2: 'oklch(0.68 0.18 290)',
        chart3: 'oklch(0.72 0.16 310)',
        chart4: 'oklch(0.75 0.14 142)',
        chart5: 'oklch(0.78 0.12 60)',
      },
    },
    features: {
      glassEffect: false,
      softShadows: false,
      gradients: true,
      roundedCorners: 'xl',
      animations: true,
      neonGlow: false,
    },
  },

  'neumorphism': {
    id: 'neumorphism',
    name: 'Neumorphism',
    description: 'Soft UI with subtle shadows creating an extruded effect.',
    icon: 'Box',
    category: 'original',
    colors: {
      light: {
        primary: 'oklch(0.52 0.13 172)',
        primaryForeground: 'oklch(0.99 0 0)',
        secondary: 'oklch(0.82 0.008 172)',
        secondaryForeground: 'oklch(0.22 0.01 172)',
        accent: 'oklch(0.82 0.008 172)',
        accentForeground: 'oklch(0.22 0.01 172)',
        background: 'oklch(0.88 0.005 172)',
        foreground: 'oklch(0.22 0.01 172)',
        card: 'oklch(0.88 0.005 172)',
        cardForeground: 'oklch(0.22 0.01 172)',
        muted: 'oklch(0.85 0.005 172)',
        mutedForeground: 'oklch(0.45 0.01 172)',
        border: 'oklch(0.88 0.005 172)',
        ring: 'oklch(0.52 0.13 172)',
        input: 'oklch(0.85 0.005 172)',
        destructive: 'oklch(0.55 0.20 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.55 0.14 172)',
        gradientEnd: 'oklch(0.50 0.12 182)',
        premium: 'oklch(0.55 0.14 172)',
        premiumForeground: 'oklch(0.99 0 0)',
        sidebar: 'oklch(0.93 0.005 172)',
        sidebarForeground: 'oklch(0.22 0.01 172)',
        sidebarPrimary: 'oklch(0.52 0.13 172)',
        sidebarPrimaryForeground: 'oklch(0.99 0 0)',
        sidebarAccent: 'oklch(0.87 0 0)',
        sidebarAccentForeground: 'oklch(0.22 0.01 172)',
        sidebarBorder: 'oklch(0.88 0.005 172)',
        sidebarRing: 'oklch(0.52 0.13 172)',
        chart1: 'oklch(0.52 0.13 172)',
        chart2: 'oklch(0.55 0.12 162)',
        chart3: 'oklch(0.58 0.11 152)',
        chart4: 'oklch(0.60 0.10 142)',
        chart5: 'oklch(0.62 0.09 60)',
      },
      dark: {
        primary: 'oklch(0.58 0.14 172)',
        primaryForeground: 'oklch(0.12 0.01 172)',
        secondary: 'oklch(0.20 0 0)',
        secondaryForeground: 'oklch(0.88 0.005 172)',
        accent: 'oklch(0.25 0 0)',
        accentForeground: 'oklch(0.88 0.005 172)',
        background: 'oklch(0.18 0 0)',
        foreground: 'oklch(0.88 0.005 172)',
        card: 'oklch(0.20 0 0)',
        cardForeground: 'oklch(0.88 0.005 172)',
        muted: 'oklch(0.20 0 0)',
        mutedForeground: 'oklch(0.72 0.008 172)',
        border: 'oklch(0.24 0 0)',
        ring: 'oklch(0.58 0.14 172)',
        input: 'oklch(0.24 0 0)',
        destructive: 'oklch(0.60 0.20 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.60 0.15 172)',
        gradientEnd: 'oklch(0.55 0.13 182)',
        premium: 'oklch(0.58 0.14 172)',
        premiumForeground: 'oklch(0.12 0.01 172)',
        sidebar: 'oklch(0.12 0 0)',
        sidebarForeground: 'oklch(0.88 0.005 172)',
        sidebarPrimary: 'oklch(0.58 0.14 172)',
        sidebarPrimaryForeground: 'oklch(0.12 0.01 172)',
        sidebarAccent: 'oklch(0.18 0 0)',
        sidebarAccentForeground: 'oklch(0.88 0.005 172)',
        sidebarBorder: 'oklch(0.20 0 0)',
        sidebarRing: 'oklch(0.58 0.14 172)',
        chart1: 'oklch(0.58 0.14 172)',
        chart2: 'oklch(0.60 0.12 162)',
        chart3: 'oklch(0.62 0.11 152)',
        chart4: 'oklch(0.65 0.10 142)',
        chart5: 'oklch(0.68 0.09 60)',
      },
    },
    features: {
      glassEffect: false,
      softShadows: true,
      gradients: false,
      roundedCorners: 'lg',
      animations: true,
      neonGlow: false,
    },
  },

  // ============================================
  // ENTERPRISE THEMES
  // ============================================

  'slate-enterprise': {
    id: 'slate-enterprise',
    name: 'Slate Enterprise',
    description: 'Professional enterprise theme with refined slate tones — built for serious business operations.',
    icon: 'Building2',
    category: 'enterprise',
    colors: {
      light: {
        primary: 'oklch(0.40 0.05 230)',
        primaryForeground: 'oklch(0.98 0.005 230)',
        secondary: 'oklch(0.97 0 0)',
        secondaryForeground: 'oklch(0.28 0.03 230)',
        accent: 'oklch(0.97 0 0)',
        accentForeground: 'oklch(0.25 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.18 0.015 230)',
        card: 'oklch(1 0 0)',
        cardForeground: 'oklch(0.18 0.015 230)',
        muted: 'oklch(0.96 0 0)',
        mutedForeground: 'oklch(0.52 0.02 230)',
        border: 'oklch(0.92 0 0)',
        ring: 'oklch(0.40 0.05 230)',
        input: 'oklch(0.92 0 0)',
        destructive: 'oklch(0.50 0.15 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.42 0.05 230)',
        gradientEnd: 'oklch(0.38 0.04 230)',
        premium: 'oklch(0.55 0.04 230)',
        premiumForeground: 'oklch(0.98 0.005 230)',
        sidebar: 'oklch(0.99 0 0)',
        sidebarForeground: 'oklch(0.25 0.02 230)',
        sidebarPrimary: 'oklch(0.55 0.06 230)',
        sidebarPrimaryForeground: 'oklch(0.25 0.02 230)',
        sidebarAccent: 'oklch(0.97 0 0)',
        sidebarAccentForeground: 'oklch(0.20 0 0)',
        sidebarBorder: 'oklch(0.92 0 0)',
        sidebarRing: 'oklch(0.55 0.06 230)',
        chart1: 'oklch(0.45 0.05 230)',
        chart2: 'oklch(0.50 0.06 215)',
        chart3: 'oklch(0.55 0.04 30)',
        chart4: 'oklch(0.60 0.03 230)',
        chart5: 'oklch(0.50 0.035 215)',
      },
      dark: {
        primary: 'oklch(0.55 0.06 230)',
        primaryForeground: 'oklch(0.98 0.005 230)',
        secondary: 'oklch(0.20 0 0)',
        secondaryForeground: 'oklch(0.88 0.01 230)',
        accent: 'oklch(0.22 0 0)',
        accentForeground: 'oklch(0.88 0.01 230)',
        background: 'oklch(0.10 0 0)',
        foreground: 'oklch(0.90 0.01 230)',
        card: 'oklch(0.13 0 0)',
        cardForeground: 'oklch(0.90 0.01 230)',
        muted: 'oklch(0.18 0 0)',
        mutedForeground: 'oklch(0.55 0.02 230)',
        border: 'oklch(0.24 0 0)',
        ring: 'oklch(0.55 0.06 230)',
        input: 'oklch(0.24 0 0)',
        destructive: 'oklch(0.55 0.15 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.57 0.06 230)',
        gradientEnd: 'oklch(0.50 0.05 230)',
        premium: 'oklch(0.60 0.05 230)',
        premiumForeground: 'oklch(0.17 0.012 230)',
        sidebar: 'oklch(0.08 0 0)',
        sidebarForeground: 'oklch(0.90 0.01 230)',
        sidebarPrimary: 'oklch(0.60 0.06 230)',
        sidebarPrimaryForeground: 'oklch(0.98 0.005 230)',
        sidebarAccent: 'oklch(0.18 0 0)',
        sidebarAccentForeground: 'oklch(0.92 0 0)',
        sidebarBorder: 'oklch(0.20 0 0)',
        sidebarRing: 'oklch(0.60 0.06 230)',
        chart1: 'oklch(0.55 0.06 230)',
        chart2: 'oklch(0.58 0.05 215)',
        chart3: 'oklch(0.52 0.035 30)',
        chart4: 'oklch(0.60 0.04 230)',
        chart5: 'oklch(0.55 0.04 215)',
      },
    },
    features: {
      glassEffect: false,
      softShadows: true,
      gradients: false,
      roundedCorners: 'md',
      animations: false,
      neonGlow: false,
    },
  },

  'terra-corporate': {
    id: 'terra-corporate',
    name: 'Terra Corporate',
    description: 'Warm corporate theme with copper and ivory — refined hospitality aesthetics.',
    icon: 'Palmtree',
    category: 'enterprise',
    colors: {
      light: {
        primary: 'oklch(0.50 0.08 45)',
        primaryForeground: 'oklch(0.99 0.005 45)',
        secondary: 'oklch(0.97 0 0)',
        secondaryForeground: 'oklch(0.28 0.04 45)',
        accent: 'oklch(0.97 0 0)',
        accentForeground: 'oklch(0.25 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.20 0.02 40)',
        card: 'oklch(1 0 0)',
        cardForeground: 'oklch(0.20 0.02 40)',
        muted: 'oklch(0.96 0 0)',
        mutedForeground: 'oklch(0.52 0.02 45)',
        border: 'oklch(0.92 0 0)',
        ring: 'oklch(0.50 0.08 45)',
        input: 'oklch(0.92 0 0)',
        destructive: 'oklch(0.50 0.14 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.52 0.08 45)',
        gradientEnd: 'oklch(0.48 0.07 50)',
        premium: 'oklch(0.60 0.06 45)',
        premiumForeground: 'oklch(0.20 0.02 45)',
        sidebar: 'oklch(0.99 0 0)',
        sidebarForeground: 'oklch(0.25 0.015 60)',
        sidebarPrimary: 'oklch(0.60 0.08 45)',
        sidebarPrimaryForeground: 'oklch(0.25 0.015 60)',
        sidebarAccent: 'oklch(0.97 0 0)',
        sidebarAccentForeground: 'oklch(0.20 0 0)',
        sidebarBorder: 'oklch(0.92 0 0)',
        sidebarRing: 'oklch(0.60 0.08 45)',
        chart1: 'oklch(0.52 0.08 45)',
        chart2: 'oklch(0.45 0.06 30)',
        chart3: 'oklch(0.48 0.05 100)',
        chart4: 'oklch(0.42 0.06 25)',
        chart5: 'oklch(0.85 0.02 75)',
      },
      dark: {
        primary: 'oklch(0.62 0.08 45)',
        primaryForeground: 'oklch(0.15 0.01 30)',
        secondary: 'oklch(0.20 0 0)',
        secondaryForeground: 'oklch(0.90 0.01 50)',
        accent: 'oklch(0.22 0 0)',
        accentForeground: 'oklch(0.90 0.01 50)',
        background: 'oklch(0.10 0 0)',
        foreground: 'oklch(0.90 0.01 50)',
        card: 'oklch(0.13 0 0)',
        cardForeground: 'oklch(0.90 0.01 50)',
        muted: 'oklch(0.18 0 0)',
        mutedForeground: 'oklch(0.55 0.02 40)',
        border: 'oklch(0.24 0 0)',
        ring: 'oklch(0.62 0.08 45)',
        input: 'oklch(0.24 0 0)',
        destructive: 'oklch(0.55 0.14 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.64 0.08 45)',
        gradientEnd: 'oklch(0.58 0.07 50)',
        premium: 'oklch(0.65 0.06 45)',
        premiumForeground: 'oklch(0.16 0.012 30)',
        sidebar: 'oklch(0.08 0 0)',
        sidebarForeground: 'oklch(0.92 0.01 50)',
        sidebarPrimary: 'oklch(0.65 0.08 45)',
        sidebarPrimaryForeground: 'oklch(0.99 0.005 45)',
        sidebarAccent: 'oklch(0.18 0 0)',
        sidebarAccentForeground: 'oklch(0.92 0 0)',
        sidebarBorder: 'oklch(0.20 0 0)',
        sidebarRing: 'oklch(0.65 0.08 45)',
        chart1: 'oklch(0.62 0.08 45)',
        chart2: 'oklch(0.52 0.06 30)',
        chart3: 'oklch(0.55 0.05 100)',
        chart4: 'oklch(0.50 0.06 25)',
        chart5: 'oklch(0.82 0.02 75)',
      },
    },
    features: {
      glassEffect: false,
      softShadows: true,
      gradients: false,
      roundedCorners: 'lg',
      animations: false,
      neonGlow: false,
    },
  },

  'arctic-steel': {
    id: 'arctic-steel',
    name: 'Arctic Steel',
    description: 'Modern productivity theme with cool steel tones — crisp and efficient.',
    icon: 'LayoutDashboard',
    category: 'enterprise',
    colors: {
      light: {
        primary: 'oklch(0.45 0.08 215)',
        primaryForeground: 'oklch(0.99 0 0)',
        secondary: 'oklch(0.97 0 0)',
        secondaryForeground: 'oklch(0.25 0.04 215)',
        accent: 'oklch(0.97 0 0)',
        accentForeground: 'oklch(0.25 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.15 0.015 215)',
        card: 'oklch(1 0 0)',
        cardForeground: 'oklch(0.15 0.015 215)',
        muted: 'oklch(0.96 0 0)',
        mutedForeground: 'oklch(0.50 0.015 215)',
        border: 'oklch(0.92 0 0)',
        ring: 'oklch(0.45 0.08 215)',
        input: 'oklch(0.92 0 0)',
        destructive: 'oklch(0.50 0.15 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.47 0.08 215)',
        gradientEnd: 'oklch(0.43 0.07 220)',
        premium: 'oklch(0.55 0.06 215)',
        premiumForeground: 'oklch(0.99 0 0)',
        sidebar: 'oklch(0.99 0 0)',
        sidebarForeground: 'oklch(0.22 0.015 220)',
        sidebarPrimary: 'oklch(0.58 0.08 215)',
        sidebarPrimaryForeground: 'oklch(0.22 0.015 220)',
        sidebarAccent: 'oklch(0.97 0 0)',
        sidebarAccentForeground: 'oklch(0.20 0 0)',
        sidebarBorder: 'oklch(0.92 0 0)',
        sidebarRing: 'oklch(0.58 0.08 215)',
        chart1: 'oklch(0.48 0.08 215)',
        chart2: 'oklch(0.42 0.10 270)',
        chart3: 'oklch(0.50 0.07 195)',
        chart4: 'oklch(0.55 0.10 20)',
        chart5: 'oklch(0.50 0.05 230)',
      },
      dark: {
        primary: 'oklch(0.60 0.08 215)',
        primaryForeground: 'oklch(0.99 0 0)',
        secondary: 'oklch(0.20 0 0)',
        secondaryForeground: 'oklch(0.92 0.008 215)',
        accent: 'oklch(0.22 0 0)',
        accentForeground: 'oklch(0.92 0.008 215)',
        background: 'oklch(0.10 0 0)',
        foreground: 'oklch(0.92 0.008 215)',
        card: 'oklch(0.13 0 0)',
        cardForeground: 'oklch(0.92 0.008 215)',
        muted: 'oklch(0.18 0 0)',
        mutedForeground: 'oklch(0.55 0.015 215)',
        border: 'oklch(0.24 0 0)',
        ring: 'oklch(0.60 0.08 215)',
        input: 'oklch(0.24 0 0)',
        destructive: 'oklch(0.55 0.15 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.62 0.08 215)',
        gradientEnd: 'oklch(0.57 0.07 220)',
        premium: 'oklch(0.64 0.06 215)',
        premiumForeground: 'oklch(0.15 0.01 215)',
        sidebar: 'oklch(0.08 0 0)',
        sidebarForeground: 'oklch(0.93 0.008 215)',
        sidebarPrimary: 'oklch(0.62 0.08 215)',
        sidebarPrimaryForeground: 'oklch(0.99 0 0)',
        sidebarAccent: 'oklch(0.18 0 0)',
        sidebarAccentForeground: 'oklch(0.92 0 0)',
        sidebarBorder: 'oklch(0.20 0 0)',
        sidebarRing: 'oklch(0.62 0.08 215)',
        chart1: 'oklch(0.60 0.08 215)',
        chart2: 'oklch(0.52 0.10 270)',
        chart3: 'oklch(0.55 0.07 195)',
        chart4: 'oklch(0.58 0.10 20)',
        chart5: 'oklch(0.55 0.05 230)',
      },
    },
    features: {
      glassEffect: false,
      softShadows: false,
      gradients: true,
      roundedCorners: 'sm',
      animations: true,
      neonGlow: false,
    },
  },

  'noir-executive': {
    id: 'noir-executive',
    name: 'Noir Executive',
    description: 'Executive dark theme with champagne accents — premium boardroom aesthetics.',
    icon: 'Briefcase',
    category: 'enterprise',
    colors: {
      light: {
        primary: 'oklch(0.55 0.04 85)',
        primaryForeground: 'oklch(0.16 0.01 60)',
        secondary: 'oklch(0.97 0 0)',
        secondaryForeground: 'oklch(0.25 0.02 85)',
        accent: 'oklch(0.97 0 0)',
        accentForeground: 'oklch(0.25 0 0)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.18 0.01 60)',
        card: 'oklch(1 0 0)',
        cardForeground: 'oklch(0.18 0.01 60)',
        muted: 'oklch(0.96 0 0)',
        mutedForeground: 'oklch(0.52 0.015 65)',
        border: 'oklch(0.92 0 0)',
        ring: 'oklch(0.55 0.04 85)',
        input: 'oklch(0.92 0 0)',
        destructive: 'oklch(0.50 0.14 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.57 0.04 85)',
        gradientEnd: 'oklch(0.52 0.035 85)',
        premium: 'oklch(0.62 0.03 85)',
        premiumForeground: 'oklch(0.16 0.01 60)',
        sidebar: 'oklch(0.99 0 0)',
        sidebarForeground: 'oklch(0.20 0 0)',
        sidebarPrimary: 'oklch(0.60 0.04 85)',
        sidebarPrimaryForeground: 'oklch(0.20 0 0)',
        sidebarAccent: 'oklch(0.97 0 0)',
        sidebarAccentForeground: 'oklch(0.20 0 0)',
        sidebarBorder: 'oklch(0.92 0 0)',
        sidebarRing: 'oklch(0.60 0.04 85)',
        chart1: 'oklch(0.60 0.04 85)',
        chart2: 'oklch(0.65 0.005 85)',
        chart3: 'oklch(0.55 0.015 65)',
        chart4: 'oklch(0.50 0.03 60)',
        chart5: 'oklch(0.48 0.03 195)',
      },
      dark: {
        primary: 'oklch(0.65 0.04 85)',
        primaryForeground: 'oklch(0.06 0 0)',
        secondary: 'oklch(0.20 0 0)',
        secondaryForeground: 'oklch(0.88 0.008 65)',
        accent: 'oklch(0.22 0 0)',
        accentForeground: 'oklch(0.88 0.008 65)',
        background: 'oklch(0.10 0 0)',
        foreground: 'oklch(0.88 0.008 65)',
        card: 'oklch(0.13 0 0)',
        cardForeground: 'oklch(0.88 0.008 65)',
        muted: 'oklch(0.18 0 0)',
        mutedForeground: 'oklch(0.52 0.015 65)',
        border: 'oklch(0.24 0 0)',
        ring: 'oklch(0.65 0.04 85)',
        input: 'oklch(0.24 0 0)',
        destructive: 'oklch(0.55 0.14 25)',
        destructiveForeground: 'oklch(0.99 0 0)',
        gradientStart: 'oklch(0.67 0.04 85)',
        gradientEnd: 'oklch(0.60 0.035 85)',
        premium: 'oklch(0.68 0.03 85)',
        premiumForeground: 'oklch(0.06 0 0)',
        sidebar: 'oklch(0.08 0 0)',
        sidebarForeground: 'oklch(0.88 0.008 65)',
        sidebarPrimary: 'oklch(0.65 0.04 85)',
        sidebarPrimaryForeground: 'oklch(0.99 0 0)',
        sidebarAccent: 'oklch(0.18 0 0)',
        sidebarAccentForeground: 'oklch(0.92 0 0)',
        sidebarBorder: 'oklch(0.20 0 0)',
        sidebarRing: 'oklch(0.65 0.04 85)',
        chart1: 'oklch(0.65 0.04 85)',
        chart2: 'oklch(0.70 0.005 85)',
        chart3: 'oklch(0.58 0.015 65)',
        chart4: 'oklch(0.55 0.03 60)',
        chart5: 'oklch(0.50 0.03 195)',
      },
    },
    features: {
      glassEffect: false,
      softShadows: true,
      gradients: false,
      roundedCorners: 'sm',
      animations: false,
      neonGlow: false,
    },
  },

};

// ============================================
// UTILITY EXPORTS
// ============================================

export const DEFAULT_THEME: ThemeId = 'hospitality-sunrise';

export const themeIcons: Record<ThemeId, string> = {
  'hospitality-sunrise': 'Sun',
  'gradient-modern': 'Sparkles',
  'neumorphism': 'Box',
  'slate-enterprise': 'Building2',
  'terra-corporate': 'Palmtree',
  'arctic-steel': 'LayoutDashboard',
  'noir-executive': 'Briefcase',
};

export function getThemeConfig(id: ThemeId): ThemeConfig {
  return themes[id];
}

export function getAllThemes(): ThemeConfig[] {
  return Object.values(themes);
}

export function getThemesByCategory(category: string): ThemeConfig[] {
  return Object.values(themes).filter(t => t.category === category);
}
