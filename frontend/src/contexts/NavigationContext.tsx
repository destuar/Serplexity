/**
 * @file NavigationContext.tsx
 * @description Context for managing breadcrumb navigation and nested page states
 */

import React, { useState, useCallback } from 'react';
import { NavigationContext, BreadcrumbItem } from './NavigationContextTypes';
// import { useLocation } from 'react-router-dom';

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([]);
  const [embeddedPageClosers, setEmbeddedPageClosers] = useState<Record<string, () => void>>({});

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

  const registerEmbeddedPageCloser = useCallback((route: string, closeFn: () => void) => {
    setEmbeddedPageClosers(prev => ({ ...prev, [route]: closeFn }));
  }, []);

  const unregisterEmbeddedPageCloser = useCallback((route: string) => {
    setEmbeddedPageClosers(prev => {
      const newClosers = { ...prev };
      delete newClosers[route];
      return newClosers;
    });
  }, []);

  const closeEmbeddedPageForRoute = useCallback((route: string) => {
    const closeFn = embeddedPageClosers[route];
    if (closeFn) {
      closeFn();
      return true;
    }
    return false;
  }, [embeddedPageClosers]);

  return (
    <NavigationContext.Provider value={{
      breadcrumbs,
      setBreadcrumbs,
      pushBreadcrumb,
      popBreadcrumb,
      resetBreadcrumbs,
      registerEmbeddedPageCloser,
      unregisterEmbeddedPageCloser,
      closeEmbeddedPageForRoute
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

