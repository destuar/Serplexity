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
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined); 