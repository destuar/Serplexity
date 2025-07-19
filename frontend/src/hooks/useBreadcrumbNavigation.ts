/**
 * @file useBreadcrumbNavigation.ts
 * @description Hook for managing breadcrumb navigation and page states
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigation } from './useNavigation';

interface PageConfig {
  title: string;
  parentPath?: string;
  parentTitle?: string;
}

const PAGE_CONFIGS: Record<string, PageConfig> = {
  '/dashboard': { title: 'Dashboard' },
  '/dashboard/sentiment': { title: 'Sentiment', parentPath: '/dashboard', parentTitle: 'Dashboard' },
  '/dashboard/competitor-rankings': { title: 'Competitor Rankings', parentPath: '/dashboard', parentTitle: 'Dashboard' },
  '/dashboard/model-comparison': { title: 'Model Comparison', parentPath: '/dashboard', parentTitle: 'Dashboard' },
  '/dashboard/visibility-tasks': { title: 'Visibility Tasks', parentPath: '/dashboard', parentTitle: 'Dashboard' },
  '/dashboard/benchmark-results': { title: 'Benchmark Results', parentPath: '/dashboard', parentTitle: 'Dashboard' },
};

export const useBreadcrumbNavigation = () => {
  const location = useLocation();
  const { setBreadcrumbs, resetBreadcrumbs } = useNavigation();

  useEffect(() => {
    const currentPath = location.pathname;
    const pageConfig = PAGE_CONFIGS[currentPath];

    if (pageConfig) {
      const breadcrumbs = [];

      // Add parent breadcrumb if exists
      if (pageConfig.parentPath && pageConfig.parentTitle) {
        breadcrumbs.push({
          label: pageConfig.parentTitle,
          onClick: () => window.history.pushState({}, '', pageConfig.parentPath!)
        });
      }

      // Add current page breadcrumb
      breadcrumbs.push({
        label: pageConfig.title
      });

      setBreadcrumbs(breadcrumbs);
    } else {
      resetBreadcrumbs();
    }
  }, [location.pathname, setBreadcrumbs, resetBreadcrumbs]);

  return {
    navigateToParent: (parentPath: string) => {
      window.history.pushState({}, '', parentPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };
};