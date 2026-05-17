'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FEATURES, 
  FEATURE_CATEGORIES, 
  PLAN_FEATURES, 
  isMenuItemVisible as checkMenuItemVisible,
  isFeatureEnabled as checkFeatureEnabled,
  getDefaultFeaturesForPlan,
  getDisabledMenuItems,
  type FeatureConfig 
} from '@/lib/feature-flags';

interface FeatureFlagsContextType {
  // State
  enabledFeatures: string[];
  tenantPlan: string;
  isLoading: boolean;
  
  // Feature checks
  isFeatureEnabled: (featureId: string) => boolean;
  isMenuItemVisible: (menuItem: string) => boolean;
  isApiRouteAccessible: (route: string) => boolean;
  
  // Feature management
  enableFeature: (featureId: string) => Promise<void>;
  disableFeature: (featureId: string) => Promise<void>;
  toggleFeature: (featureId: string) => Promise<void>;
  setEnabledFeatures: (features: string[]) => Promise<void>;
  resetToPlanDefaults: () => Promise<void>;
  
  // Data
  getAllFeatures: () => Record<string, FeatureConfig>;
  getFeaturesByCategory: () => Record<string, { name: string; description: string; color: string; features: FeatureConfig[] }>;
  getDisabledMenuItems: () => string[];
  
  // Refresh
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | null>(null);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [enabledFeatures, setEnabledFeaturesState] = useState<string[]>([]);
  const [tenantPlan, setTenantPlan] = useState<string>('trial');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Track previous auth state to detect login transitions
  const prevAuthenticatedRef = useRef(isAuthenticated);

  // Initial load and re-fetch when auth state changes
  // Key fix: re-fetches feature flags when user logs in (isAuthenticated changes false→true)
  // and keeps isLoading=true when not authenticated so sidebar stays in loading state
  useEffect(() => {
    let cancelled = false;

    // When user is not authenticated, keep loading state true
    // so the sidebar shows skeleton instead of incomplete menu items
    if (!isAuthenticated) {
      setIsLoading(true);
      prevAuthenticatedRef.current = false;
      return;
    }

    const load = async () => {
      try {
        const response = await fetch('/api/settings/feature-flags');
        if (cancelled) return;
        const data = await response.json();
        
        if (data.success && data.data?.enabledFeatures) {
          // Use the enabledFeatures directly from API response
          const featureIds = data.data.enabledFeatures || [];
          setEnabledFeaturesState(featureIds);
          setTenantPlan(data.data.plan || 'trial');
        } else {
          // Security: use trial defaults (most restrictive plan) on API failure
          // Never fall back to enterprise to prevent feature leakage
          console.warn('Feature flags API returned unsuccessful, using trial defaults');
          const defaults = getDefaultFeaturesForPlan('trial');
          setEnabledFeaturesState(defaults);
          setTenantPlan('trial');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch feature flags:', error);
        // Security: use trial defaults on error (most restrictive plan)
        const defaults = getDefaultFeaturesForPlan('trial');
        setEnabledFeaturesState(defaults);
        setTenantPlan('trial');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger, isAuthenticated]);

  // Refresh function for manual re-fetch
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Save features to backend
  const saveFeatures = useCallback(async (features: string[]) => {
    try {
      const featureUpdates = Object.keys(FEATURES).map(key => ({
        key,
        enabled: features.includes(key),
      }));

      const response = await fetch('/api/settings/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: featureUpdates }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save features');
      }
    } catch (error) {
      console.error('Failed to save feature flags:', error);
      throw error;
    }
  }, []);

  // Feature check functions
  const isFeatureEnabledFn = useCallback((featureId: string) => {
    return checkFeatureEnabled(featureId, enabledFeatures);
  }, [enabledFeatures]);

  const isMenuItemVisibleFn = useCallback((menuItem: string) => {
    return checkMenuItemVisible(menuItem, enabledFeatures);
  }, [enabledFeatures]);

  const isApiRouteAccessible = useCallback((route: string) => {
    for (const featureId of enabledFeatures) {
      const config = FEATURES[featureId];
      if (config?.apiRoutes.some(r => route.startsWith(r))) {
        return true;
      }
    }
    // Check if route is not controlled by any feature (public)
    for (const config of Object.values(FEATURES)) {
      if (config.apiRoutes.some(r => route.startsWith(r))) {
        return false; // Route is controlled but feature not enabled
      }
    }
    return true; // Route not controlled by any feature
  }, [enabledFeatures]);

  // Feature management functions
  const enableFeature = useCallback(async (featureId: string) => {
    if (!enabledFeatures.includes(featureId)) {
      const newFeatures = [...enabledFeatures, featureId];
      // Add dependencies
      const config = FEATURES[featureId];
      if (config?.dependencies) {
        for (const dep of config.dependencies) {
          if (!newFeatures.includes(dep)) {
            newFeatures.push(dep);
          }
        }
      }
      setEnabledFeaturesState(newFeatures);
      await saveFeatures(newFeatures);
    }
  }, [enabledFeatures, saveFeatures]);

  const disableFeature = useCallback(async (featureId: string) => {
    // Check if any enabled feature depends on this one
    for (const enabledId of enabledFeatures) {
      const config = FEATURES[enabledId];
      if (config?.dependencies?.includes(featureId)) {
        throw new Error(`Cannot disable ${featureId} - it's required by ${enabledId}`);
      }
    }
    
    const newFeatures = enabledFeatures.filter(f => f !== featureId);
    setEnabledFeaturesState(newFeatures);
    await saveFeatures(newFeatures);
  }, [enabledFeatures, saveFeatures]);

  const toggleFeature = useCallback(async (featureId: string) => {
    if (enabledFeatures.includes(featureId)) {
      await disableFeature(featureId);
    } else {
      await enableFeature(featureId);
    }
  }, [enabledFeatures, enableFeature, disableFeature]);

  const setFeatures = useCallback(async (features: string[]) => {
    setEnabledFeaturesState(features);
    await saveFeatures(features);
  }, [saveFeatures]);

  const resetToPlanDefaults = useCallback(async () => {
    const defaults = getDefaultFeaturesForPlan(tenantPlan);
    setEnabledFeaturesState(defaults);
    await saveFeatures(defaults);
  }, [tenantPlan, saveFeatures]);

  // Data getters
  const getAllFeatures = useCallback(() => FEATURES, []);

  const getFeaturesByCategoryFn = useCallback(() => {
    const grouped: Record<string, { name: string; description: string; color: string; features: FeatureConfig[] }> = {};
    
    for (const [categoryKey, categoryInfo] of Object.entries(FEATURE_CATEGORIES)) {
      const features = Object.values(FEATURES).filter(f => f.category === categoryKey);
      grouped[categoryKey] = {
        ...categoryInfo,
        features,
      };
    }
    
    return grouped;
  }, []);

  const getDisabledMenuItemsFn = useCallback(() => {
    return getDisabledMenuItems(enabledFeatures);
  }, [enabledFeatures]);

  const value = useMemo(() => ({
    enabledFeatures,
    tenantPlan,
    isLoading,
    isFeatureEnabled: isFeatureEnabledFn,
    isMenuItemVisible: isMenuItemVisibleFn,
    isApiRouteAccessible,
    enableFeature,
    disableFeature,
    toggleFeature,
    setEnabledFeatures: setFeatures,
    resetToPlanDefaults,
    getAllFeatures,
    getFeaturesByCategory: getFeaturesByCategoryFn,
    getDisabledMenuItems: getDisabledMenuItemsFn,
    refresh,
  }), [
    enabledFeatures,
    tenantPlan,
    isLoading,
    isFeatureEnabledFn,
    isMenuItemVisibleFn,
    isApiRouteAccessible,
    enableFeature,
    disableFeature,
    toggleFeature,
    setFeatures,
    resetToPlanDefaults,
    getAllFeatures,
    getFeaturesByCategoryFn,
    getDisabledMenuItemsFn,
    refresh,
  ]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}

// Convenience hook for checking a single feature
export function useFeature(featureId: string) {
  const { isFeatureEnabled, isLoading } = useFeatureFlags();
  return {
    enabled: isFeatureEnabled(featureId),
    isLoading,
  };
}

// Convenience hook for checking menu visibility
export function useMenuItemVisibility(menuItem: string) {
  const { isMenuItemVisible, isLoading } = useFeatureFlags();
  return {
    visible: isMenuItemVisible(menuItem),
    isLoading,
  };
}
