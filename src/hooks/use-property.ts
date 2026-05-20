'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store';

/**
 * Returns the current property ID from the auth store.
 * For non-platform-admin users, only fetches properties they are assigned to
 * via the UserProperty junction table. For platform admins, fetches all properties.
 * If no property is selected, auto-selects the default property or the first one.
 */
export function usePropertyId() {
  const { currentProperty, properties, setProperties, setCurrentProperty, user } = useAuthStore();

  useEffect(() => {
    // If we already have a current property, nothing to do
    if (currentProperty) return;
    // If we have properties but no current, select the default one or the first
    if (properties.length > 0) {
      const defaultProp = properties.find((p) => (p as Record<string, unknown>).isDefaultProperty) || properties[0];
      setCurrentProperty(defaultProp);
      return;
    }
    // Otherwise fetch from API
    let cancelled = false;
    const controller = new AbortController();

    // Non-platform-admin users: only fetch their assigned properties
    const isPlatformAdmin = user?.isPlatformAdmin;
    const url = isPlatformAdmin
      ? '/api/properties?limit=100'
      : '/api/properties?myProperties=true&limit=100';

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setProperties(data.data);
          // Select the default property if available, otherwise the first one
          const defaultProp = data.data.find((p: Record<string, unknown>) => p.isDefaultProperty) || data.data[0];
          setCurrentProperty(defaultProp);
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') {
          console.error('Failed to fetch properties:', err);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentProperty, properties, setProperties, setCurrentProperty, user?.isPlatformAdmin]);

  return {
    propertyId: currentProperty?.id || '',
    property: currentProperty || null,
    properties,
    setCurrentProperty,
    loading: false,
  };
}
