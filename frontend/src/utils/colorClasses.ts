/**
 * @file colorClasses.ts
 * @description Centralized Tailwind class configurations based on our color system.
 * 
 * USAGE INSTRUCTIONS:
 * 
 * 1. FOR BUTTONS:
 *    - Import: `import { buttonClasses } from '../utils/colorClasses'`
 *    - Use: `className={buttonClasses.primary}` (black button)
 *    - Use: `className={buttonClasses.secondary}` (blue button)
 * 
 * 2. FOR DASHBOARD ELEMENTS:
 *    - Import: `import { dashboardClasses } from '../utils/colorClasses'`
 *    - Use: `className={dashboardClasses.refresh}` (refresh buttons)
 *    - Use: `className={dashboardClasses.accent}` (text links)
 * 
 * 3. FOR FORMS:
 *    - Import: `import { formClasses } from '../utils/colorClasses'`
 *    - Use: `className={formClasses.focus}` (input focus states)
 * 
 * 4. FOR CHARTS:
 *    - Import: `import { chartColorArrays } from '../utils/colorClasses'`
 *    - Use: `const COLORS = chartColorArrays.primary` (for Recharts, etc.)
 * 
 * 5. UPDATING COLORS:
 *    - To change button colors: Update `buttonClasses.primary/secondary`
 *    - To change dashboard blue: Update `dashboardClasses` entries
 *    - To change chart colors: Update `chartColorArrays.primary/multiColor`
 * 
 * 6. UTILITY FUNCTIONS:
 *    - `getButtonClass('primary', 'additional-classes')`
 *    - `getDashboardClass('refresh', 'additional-classes')`
 * 
 * MIGRATION NOTES:
 * - Replace hardcoded `bg-[#7762ff]` with `buttonClasses.primary`
 * - Replace `bg-blue-600 hover:bg-blue-700` with `dashboardClasses.primary`
 * - Replace chart color arrays with `chartColorArrays.primary`
 * 
 * This system ensures all Tailwind classes are centralized and easy to update.
 */

// Button Classes
export const buttonClasses = {
  primary: "bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl",
  secondary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl",
  outline: "border border-gray-300 bg-transparent text-gray-700 shadow-sm hover:bg-gray-100 hover:text-gray-800",
  ghost: "hover:bg-gray-100 hover:text-gray-800",
  destructive: "bg-red-600 text-white hover:bg-red-700",
} as const;

// Dashboard Element Classes
export const dashboardClasses = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  primaryBorder: "border-blue-600 hover:border-blue-700", 
  accent: "text-blue-600 hover:text-blue-700",
  accentBg: "bg-blue-600/5 hover:bg-blue-600/10",
  refresh: "bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black text-gray-900",
} as const;

// Form Classes
export const formClasses = {
  focus: "focus:ring-blue-600 focus:border-blue-600",
  focusRing: "focus:ring-2 focus:ring-blue-600",
  error: "border-red-300 focus:ring-red-500 focus:border-red-500",
  success: "border-green-300 focus:ring-green-500 focus:border-green-500",
} as const;

// Text Classes
export const textClasses = {
  primary: "text-gray-900",
  secondary: "text-gray-500", 
  accent: "text-blue-600 hover:text-blue-700",
  muted: "text-gray-400",
} as const;

// Chart Color Arrays (for libraries like Recharts)
export const chartColorArrays = {
  primary: ['#2563eb', '#e5e7eb'], // Blue-600, Gray-200
  multiColor: [
    '#2563eb', // Blue-600
    '#3b82f6', // Blue-500  
    '#60a5fa', // Blue-400
    '#93c5fd', // Blue-300
    '#059669', // Emerald-600
    '#d97706', // Amber-600
    '#dc2626', // Red-600
    '#6b7280', // Gray-500
  ],
  status: {
    success: '#059669',
    warning: '#d97706', 
    error: '#dc2626',
    info: '#2563eb',
  }
} as const;

// Utility functions to get complete class strings
export const getButtonClass = (variant: keyof typeof buttonClasses = 'primary', additionalClasses?: string) => {
  return `${buttonClasses[variant]} ${additionalClasses || ''}`.trim();
};

export const getDashboardClass = (variant: keyof typeof dashboardClasses = 'primary', additionalClasses?: string) => {
  return `${dashboardClasses[variant]} ${additionalClasses || ''}`.trim();
};

export const getFormClass = (variant: keyof typeof formClasses = 'focus', additionalClasses?: string) => {
  return `${formClasses[variant]} ${additionalClasses || ''}`.trim();
};

export default {
  button: buttonClasses,
  dashboard: dashboardClasses, 
  form: formClasses,
  text: textClasses,
  chart: chartColorArrays,
};