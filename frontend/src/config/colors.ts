/**
 * @file colors.ts
 * @description Centralized color configuration for the application.
 * 
 * USAGE INSTRUCTIONS:
 * 
 * 1. UPDATING BRAND COLORS:
 *    - To change the main brand color (black buttons), update `brand.primary`
 *    - To change dashboard elements (blue), update `dashboard.primary`
 *    - To change chart colors, update `charts.primary` and related colors
 * 
 * 2. FOR COMPONENTS:
 *    - Import specific colors: `import { colors } from '../config/colors'`
 *    - Use in components: `backgroundColor: colors.brand.primary`
 *    - For charts: `const chartColors = getChartColors()`
 * 
 * 3. FOR TAILWIND CLASSES:
 *    - Use colorClasses.ts instead (see utils/colorClasses.ts)
 *    - Import: `import { buttonClasses, dashboardClasses } from '../utils/colorClasses'`
 *    - Use: `className={buttonClasses.primary}`
 * 
 * 4. ADDING NEW COLORS:
 *    - Add to appropriate section (brand, dashboard, charts, etc.)
 *    - Update colorClasses.ts if Tailwind classes are needed
 *    - Document the purpose of the new color
 * 
 * 5. MIGRATION FROM HARDCODED COLORS:
 *    - Replace #7762ff (old purple) with colors.dashboard.primary
 *    - Replace #6650e6 (old purple hover) with colors.dashboard.primaryHover
 *    - Replace button colors with colors.brand.primary/primaryHover
 * 
 * This centralized system ensures:
 * - Easy theme changes (change one line, update everywhere)
 * - Consistent color usage across the app
 * - Clear separation between brand, dashboard, and UI colors
 * - Type safety and autocomplete
 */

export const colors = {
  // Brand Colors
  brand: {
    primary: '#000000',        // Black - main brand color for buttons
    primaryHover: '#374151',   // Gray-700 - hover state for black buttons
    secondary: '#2563eb',      // Blue-600 - secondary brand color
    secondaryHover: '#1d4ed8', // Blue-700 - hover state for secondary
  },

  // Dashboard & Chart Colors
  dashboard: {
    primary: '#2563eb',        // Blue-600 - main dashboard color
    primaryHover: '#1d4ed8',   // Blue-700 - hover state
    accent: '#3b82f6',         // Blue-500 - accent color
    background: '#f8fafc',     // Slate-50 - light background
    border: '#e2e8f0',         // Slate-200 - borders
  },

  // Chart Color Palette
  charts: {
    primary: '#2563eb',        // Blue-600 - primary chart color
    secondary: '#e5e7eb',      // Gray-200 - secondary/background
    accent1: '#3b82f6',        // Blue-500
    accent2: '#60a5fa',        // Blue-400
    accent3: '#93c5fd',        // Blue-300
    accent4: '#dbeafe',        // Blue-100
    success: '#059669',        // Emerald-600
    warning: '#d97706',        // Amber-600
    error: '#dc2626',          // Red-600
    neutral: '#6b7280',        // Gray-500
  },

  // Form & Input Colors
  forms: {
    focusRing: '#2563eb',      // Blue-600 - focus ring color
    focusBorder: '#2563eb',    // Blue-600 - focus border color
    error: '#dc2626',          // Red-600 - error state
    errorBorder: '#fca5a5',    // Red-300 - error border
    success: '#059669',        // Emerald-600 - success state
    successBorder: '#86efac',  // Green-300 - success border
  },

  // Text Colors
  text: {
    primary: '#111827',        // Gray-900 - primary text
    secondary: '#6b7280',      // Gray-500 - secondary text
    accent: '#2563eb',         // Blue-600 - accent text (links, highlights)
    accentHover: '#1d4ed8',    // Blue-700 - accent text hover
    muted: '#9ca3af',          // Gray-400 - muted text
    white: '#ffffff',          // White text
  },

  // Background Colors
  backgrounds: {
    primary: '#ffffff',        // White - primary background
    secondary: '#f8fafc',      // Slate-50 - secondary background
    muted: '#f1f5f9',          // Slate-100 - muted background
    accent: '#eff6ff',         // Blue-50 - accent background
  },

  // Status Colors
  status: {
    success: '#059669',        // Emerald-600
    warning: '#d97706',        // Amber-600
    error: '#dc2626',          // Red-600
    info: '#2563eb',           // Blue-600
  },

  // Legacy colors (for gradual migration)
  legacy: {
    purple: '#7762ff',         // Old purple color
    purpleHover: '#6650e6',    // Old purple hover
    purpleLight: '#9e52ff',    // Old light purple
  }
} as const;

// Utility functions for accessing colors
export const getChartColors = () => [
  colors.charts.primary,
  colors.charts.accent1,
  colors.charts.accent2,
  colors.charts.accent3,
  colors.charts.success,
  colors.charts.warning,
  colors.charts.error,
  colors.charts.neutral,
];

export const getBrandGradient = () => ({
  from: colors.brand.primary,
  to: colors.brand.primaryHover,
});

export const getDashboardGradient = () => ({
  from: colors.dashboard.primary,
  to: colors.dashboard.accent,
});

// CSS Custom Properties (for use in CSS/Tailwind)
export const cssVariables = {
  '--color-brand-primary': colors.brand.primary,
  '--color-brand-primary-hover': colors.brand.primaryHover,
  '--color-brand-secondary': colors.brand.secondary,
  '--color-brand-secondary-hover': colors.brand.secondaryHover,
  '--color-dashboard-primary': colors.dashboard.primary,
  '--color-dashboard-accent': colors.dashboard.accent,
  '--color-chart-primary': colors.charts.primary,
  '--color-chart-secondary': colors.charts.secondary,
  '--color-text-accent': colors.text.accent,
  '--color-form-focus': colors.forms.focusRing,
} as const;

export default colors;