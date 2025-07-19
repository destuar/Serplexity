/**
 * @file NavigationContextTypes.ts
 * @description Types and context for navigation state management
 */

import { createContext } from 'react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
}

export interface NavigationContextType {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  pushBreadcrumb: (item: BreadcrumbItem) => void;
  popBreadcrumb: () => void;
  resetBreadcrumbs: () => void;
  registerEmbeddedPageCloser: (route: string, closeFn: () => void) => void;
  unregisterEmbeddedPageCloser: (route: string) => void;
  closeEmbeddedPageForRoute: (route: string) => boolean;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined); 