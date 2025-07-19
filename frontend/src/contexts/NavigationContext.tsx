/**
 * @file NavigationContext.tsx
 * @description Context for managing breadcrumb navigation and nested page states
 */

import React, { useState, useCallback } from 'react';
import { NavigationContext, BreadcrumbItem } from './NavigationContextTypes';

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([]);

  const setBreadcrumbs = useCallback((newBreadcrumbs: BreadcrumbItem[]) => {
    setBreadcrumbsState(newBreadcrumbs);
  }, []);

  const pushBreadcrumb = useCallback((item: BreadcrumbItem) => {
    setBreadcrumbsState(prev => [...prev, item]);
  }, []);

  const popBreadcrumb = useCallback(() => {
    setBreadcrumbsState(prev => prev.slice(0, -1));
  }, []);

  const resetBreadcrumbs = useCallback(() => {
    setBreadcrumbsState([]);
  }, []);

  return (
    <NavigationContext.Provider value={{
      breadcrumbs,
      setBreadcrumbs,
      pushBreadcrumb,
      popBreadcrumb,
      resetBreadcrumbs
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

