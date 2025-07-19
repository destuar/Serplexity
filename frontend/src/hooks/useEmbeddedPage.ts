/**
 * @file useEmbeddedPage.ts
 * @description Hook for managing embedded page states within components
 */

import { useState, useCallback } from 'react';
import { useNavigation } from './useNavigation';

export const useEmbeddedPage = (basePage: string) => {
  const [embeddedPage, setEmbeddedPage] = useState<string | null>(null);
  const { setBreadcrumbs } = useNavigation();

  const openEmbeddedPage = useCallback((pageName: string, pageTitle: string) => {
    setEmbeddedPage(pageName);
    
    // Update breadcrumbs to show nested navigation
    setBreadcrumbs([
      {
        label: basePage,
        onClick: () => {
          setEmbeddedPage(null);
          setBreadcrumbs([{ label: basePage }]);
        }
      },
      {
        label: pageTitle
      }
    ]);
  }, [basePage, setBreadcrumbs]);

  const closeEmbeddedPage = useCallback(() => {
    setEmbeddedPage(null);
    setBreadcrumbs([{ label: basePage }]);
  }, [basePage, setBreadcrumbs]);

  return {
    embeddedPage,
    openEmbeddedPage,
    closeEmbeddedPage,
    isEmbedded: embeddedPage !== null
  };
};