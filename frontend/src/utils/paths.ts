/**
 * Path utilities to reduce deep imports across the codebase
 */

// Re-export commonly used utilities from lib
export { cn } from '../lib/utils';

// Component paths - use these instead of ../../components
export const COMPONENT_PATHS = {
  // UI Components
  UI: {
    Button: () => import('../components/ui/Button'),
    Card: () => import('../components/ui/Card'),
    Input: () => import('../components/ui/Input'),
    Accordion: () => import('../components/ui/Accordion'),
  },
  
  // Layout Components  
  LAYOUT: {
    DashboardLayout: () => import('../components/layout/DashboardLayout'),
    Sidebar: () => import('../components/layout/Sidebar'),
    Navbar: () => import('../components/layout/Navbar'),
  },
  
  // Auth Components
  AUTH: {
    ProtectedRoute: () => import('../components/auth/ProtectedRoute'),
    PaymentGuard: () => import('../components/auth/PaymentGuard'),
  },
} as const;

// Hook paths
export const HOOK_PATHS = {
  useDashboard: () => import('../hooks/useDashboard'),
  useCompany: () => import('../contexts/CompanyContext'),
  useAuth: () => import('../contexts/AuthContext'),
} as const;

// Service paths
export const SERVICE_PATHS = {
  companyService: () => import('../services/companyService'),
  dashboardService: () => import('../services/dashboardService'),
} as const;