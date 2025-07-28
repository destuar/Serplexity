/**
 * @file colors.ts
 * @description Professional Design System - Inspired by modern NFT/tech aesthetics
 *
 * DESIGN PHILOSOPHY:
 * - Light neutral foundation with dark accent elements
 * - Glassmorphism effects for modern appeal
 * - High contrast for accessibility and readability
 * - Tech-forward, space-age aesthetic
 *
 * USAGE GUIDELINES:
 * 1. Use designSystem.surface.* for backgrounds
 * 2. Use designSystem.glass.* for glassmorphism effects
 * 3. Use designSystem.text.* for typography
 * 4. Use designSystem.interactive.* for buttons and links
 */

export const designSystem = {
  // Surface Colors - Foundation Layer
  surface: {
    primary: "#f8f9fa", // Light gray - main background
    secondary: "#ffffff", // Pure white - elevated surfaces
    tertiary: "#f1f3f4", // Slightly darker gray - subtle sections
    accent: "#000000", // Pure black - primary accent surfaces
    accentSoft: "#1a1a1a", // Soft black - secondary accent surfaces
    accentLight: "#2d2d2d", // Light black - tertiary accent surfaces
  },

  // Glassmorphism System
  glass: {
    // Light glassmorphism (on dark backgrounds)
    lightBlur: "rgba(255, 255, 255, 0.1)",
    lightBorder: "rgba(255, 255, 255, 0.2)",
    lightShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",

    // Dark glassmorphism (on light backgrounds)
    darkBlur: "rgba(0, 0, 0, 0.05)",
    darkBorder: "rgba(0, 0, 0, 0.1)",
    darkShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",

    // Elevated glassmorphism
    elevated: "rgba(255, 255, 255, 0.15)",
    elevatedBorder: "rgba(255, 255, 255, 0.3)",
    elevatedShadow: "0 16px 48px rgba(0, 0, 0, 0.12)",
  },

  // Typography System
  text: {
    // On light backgrounds
    onLight: {
      primary: "#1a1a1a", // Primary text - high contrast
      secondary: "#4a4a4a", // Secondary text - medium contrast
      tertiary: "#6a6a6a", // Tertiary text - lower contrast
      accent: "#3b82f6", // Accent text - brand blue
    },

    // On dark backgrounds
    onDark: {
      primary: "#ffffff", // Primary text - pure white
      secondary: "#e5e7eb", // Secondary text - light gray
      tertiary: "#9ca3af", // Tertiary text - medium gray
      accent: "#60a5fa", // Accent text - lighter blue
    },

    // Brand text
    brand: {
      primary: "#000000", // Brand primary - black
      accent: "#3b82f6", // Brand accent - blue
      gradient: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
    },
  },

  // Interactive Elements
  interactive: {
    // Primary actions
    primary: {
      default: "#000000",
      hover: "#1a1a1a",
      active: "#333333",
      disabled: "#9ca3af",
    },

    // Secondary actions
    secondary: {
      default: "#3b82f6",
      hover: "#2563eb",
      active: "#1d4ed8",
      disabled: "#cbd5e1",
    },

    // Accent actions
    accent: {
      default: "rgba(255, 255, 255, 0.1)",
      hover: "rgba(255, 255, 255, 0.15)",
      active: "rgba(255, 255, 255, 0.2)",
      border: "rgba(255, 255, 255, 0.3)",
    },
  },

  // Gradient System
  gradients: {
    // Primary gradients
    primary: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    accent: "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)",

    // Glassmorphism gradients
    glassLight:
      "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
    glassDark:
      "linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.05) 100%)",

    // Brand gradients
    brand: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
    brandSoft:
      "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",

    // Glow effects
    glow: "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
    glowAccent:
      "radial-gradient(ellipse at center, rgba(0, 0, 0, 0.1) 0%, transparent 70%)",
  },

  // Shadow System
  shadows: {
    // Subtle shadows
    xs: "0 1px 2px rgba(0, 0, 0, 0.05)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",

    // Medium shadows
    md: "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",

    // Strong shadows
    xl: "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)",
    "2xl": "0 25px 50px rgba(0, 0, 0, 0.15)",

    // Glassmorphism shadows
    glass: "0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.1)",
    glassStrong:
      "0 16px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.2)",
  },

  // Status Colors
  status: {
    success: {
      light: "#ecfdf5",
      default: "#10b981",
      dark: "#065f46",
    },
    warning: {
      light: "#fffbeb",
      default: "#f59e0b",
      dark: "#92400e",
    },
    error: {
      light: "#fef2f2",
      default: "#ef4444",
      dark: "#991b1b",
    },
    info: {
      light: "#eff6ff",
      default: "#3b82f6",
      dark: "#1e40af",
    },
  },
} as const;

// Legacy colors (for backward compatibility)
export const colors = {
  // Brand Colors
  brand: {
    primary: designSystem.surface.accent,
    primaryHover: designSystem.interactive.primary.hover,
    secondary: designSystem.interactive.secondary.default,
    secondaryHover: designSystem.interactive.secondary.hover,
  },

  // Dashboard & Chart Colors (updated to match new system)
  dashboard: {
    primary: designSystem.interactive.secondary.default,
    primaryHover: designSystem.interactive.secondary.hover,
    accent: designSystem.text.brand.accent,
    background: designSystem.surface.primary,
    border: designSystem.glass.darkBorder,
  },

  // Dark Theme Configuration (now properly integrated)
  darkTheme: {
    primaryBg: designSystem.surface.accent,
    secondaryBg: designSystem.surface.accentSoft,
    cardBg: designSystem.glass.lightBlur,

    glass: {
      light: designSystem.glass.lightBlur,
      medium: designSystem.glass.elevated,
      dark: designSystem.glass.darkBlur,
      border: designSystem.glass.lightBorder,
    },

    text: designSystem.text.onDark,
    gradients: designSystem.gradients,
    hover: {
      cardBg: designSystem.interactive.accent.hover,
      borderGlow: designSystem.interactive.accent.border,
    },
  },

  // Chart Color Palette
  charts: {
    primary: designSystem.interactive.secondary.default,
    secondary: designSystem.surface.tertiary,
    accent1: "#3b82f6",
    accent2: "#60a5fa",
    accent3: "#93c5fd",
    accent4: "#dbeafe",
    success: designSystem.status.success.default,
    warning: designSystem.status.warning.default,
    error: designSystem.status.error.default,
    neutral: "#6b7280",
  },

  // Form & Input Colors
  forms: {
    focusRing: designSystem.interactive.secondary.default,
    focusBorder: designSystem.interactive.secondary.default,
    error: designSystem.status.error.default,
    errorBorder: designSystem.status.error.light,
    success: designSystem.status.success.default,
    successBorder: designSystem.status.success.light,
  },

  // Text Colors
  text: designSystem.text.onLight,

  // Background Colors
  backgrounds: {
    primary: designSystem.surface.secondary,
    secondary: designSystem.surface.primary,
    muted: designSystem.surface.tertiary,
    accent: designSystem.status.info.light,
  },

  // Status Colors
  status: {
    success: designSystem.status.success.default,
    warning: designSystem.status.warning.default,
    error: designSystem.status.error.default,
    info: designSystem.status.info.default,
  },

  // Legacy colors (for gradual migration)
  legacy: {
    purple: "#7762ff",
    purpleHover: "#6650e6",
    purpleLight: "#9e52ff",
  },
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
  "--color-brand-primary": colors.brand.primary,
  "--color-brand-primary-hover": colors.brand.primaryHover,
  "--color-brand-secondary": colors.brand.secondary,
  "--color-brand-secondary-hover": colors.brand.secondaryHover,
  "--color-dashboard-primary": colors.dashboard.primary,
  "--color-dashboard-accent": colors.dashboard.accent,
  "--color-chart-primary": colors.charts.primary,
  "--color-chart-secondary": colors.charts.secondary,
  "--color-text-accent": colors.text.accent,
  "--color-form-focus": colors.forms.focusRing,
} as const;

export default colors;
