const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'settings-general': () => import('@/components/settings/general'),
  'settings-tax': () => import('@/components/settings/tax-currency'),
  'settings-localization': () => import('@/components/settings/localization'),
  'settings-features': () => import('@/components/settings/feature-flags'),
  'settings-security': () => import('@/components/settings/security'),
  'settings-integrations': () => import('@/components/settings/system-integrations'),
  'settings-gdpr': () => import('@/components/gdpr/gdpr-manager'),
  'settings-license': () => import('@/components/settings/license-management'),
  'settings-subscription': () => import('@/components/settings/my-subscription'),
  'settings-license-keys': () => import('@/components/settings/license-keys'),
};

export const settingsMap = sectionMap;
