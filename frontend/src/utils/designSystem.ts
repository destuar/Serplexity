/**
 * @file designSystem.ts
 * @description Design System Utilities for React Components
 * Professional UI/UX utilities matching the NFT collection reference aesthetic
 */

import { designSystem } from "../config/colors";

// Component Class Generators
export const getFloatingCardClasses = (variant: "light" | "dark" = "light") => {
  const baseClasses =
    "transition-all duration-300 ease-cubic-bezier rounded-2xl";
  return variant === "dark"
    ? `floating-card-dark ${baseClasses}`
    : `floating-card ${baseClasses}`;
};

export const getGlassClasses = (
  variant: "light" | "dark" | "elevated" = "light"
) => {
  const baseClasses = "backdrop-blur-md rounded-xl";
  switch (variant) {
    case "dark":
      return `glass-dark ${baseClasses}`;
    case "elevated":
      return `glass-elevated ${baseClasses}`;
    default:
      return `glass-light ${baseClasses}`;
  }
};

export const getButtonClasses = (
  variant: "primary" | "secondary" | "glass" = "primary"
) => {
  const baseClasses =
    "font-semibold transition-all duration-200 ease-cubic-bezier focus:outline-none focus:ring-2 focus:ring-offset-2";
  switch (variant) {
    case "secondary":
      return `btn-secondary ${baseClasses} focus:ring-blue-500`;
    case "glass":
      return `btn-glass ${baseClasses} focus:ring-white`;
    default:
      return `btn-primary ${baseClasses} focus:ring-gray-500`;
  }
};

export const getTextClasses = (
  variant:
    | "display"
    | "heading-1"
    | "heading-2"
    | "heading-3"
    | "body-large"
    | "body"
    | "body-small" = "body"
) => {
  const baseClasses = "font-sans";
  switch (variant) {
    case "display":
      return `text-display ${baseClasses}`;
    case "heading-1":
      return `text-heading-1 ${baseClasses}`;
    case "heading-2":
      return `text-heading-2 ${baseClasses}`;
    case "heading-3":
      return `text-heading-3 ${baseClasses}`;
    case "body-large":
      return `text-body-large ${baseClasses}`;
    case "body-small":
      return `text-body-small ${baseClasses}`;
    default:
      return `text-body ${baseClasses}`;
  }
};

// Animation Classes
export const animationClasses = {
  fadeInUp: "animate-fade-in-up",
  slideInLeft: "animate-slide-in-left",
  scaleIn: "animate-scale-in",
  glow: "glow-blue",
} as const;

// Layout Classes
export const layoutClasses = {
  professionalGrid: "professional-grid",
  container: "max-w-7xl mx-auto px-6 lg:px-8",
  section: "py-16 md:py-20",
  centeredContent: "text-center max-w-4xl mx-auto",
} as const;

// Form Classes
export const formClasses = {
  input: "form-input focus-ring",
  label: "block text-sm font-medium mb-2",
  error: "text-red-500 text-sm mt-1",
  fieldGroup: "mb-6",
} as const;

// Design System Component Props
export interface DesignSystemProps {
  variant?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children?: React.ReactNode;
}

// Responsive Utilities
export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// Color Utilities for React Components
export const colorUtils = {
  surface: designSystem.surface,
  glass: designSystem.glass,
  text: designSystem.text,
  interactive: designSystem.interactive,
  gradients: designSystem.gradients,
  shadows: designSystem.shadows,
  status: designSystem.status,
} as const;

// Professional Spacing Scale
export const spacing = {
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
  "3xl": "4rem", // 64px
  "4xl": "6rem", // 96px
  "5xl": "8rem", // 128px
} as const;

// Professional Border Radius Scale
export const borderRadius = {
  none: "0",
  sm: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  "3xl": "1.5rem", // 24px
  full: "9999px",
} as const;

// Typography Scale
export const typography = {
  display: {
    fontSize: "clamp(2.5rem, 8vw, 4rem)",
    fontWeight: "700",
    lineHeight: "1.1",
    letterSpacing: "-0.02em",
  },
  heading1: {
    fontSize: "clamp(2rem, 6vw, 3rem)",
    fontWeight: "700",
    lineHeight: "1.2",
    letterSpacing: "-0.01em",
  },
  heading2: {
    fontSize: "clamp(1.5rem, 4vw, 2rem)",
    fontWeight: "600",
    lineHeight: "1.3",
  },
  heading3: {
    fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
    fontWeight: "600",
    lineHeight: "1.4",
  },
  bodyLarge: {
    fontSize: "18px",
    fontWeight: "400",
    lineHeight: "1.6",
  },
  body: {
    fontSize: "16px",
    fontWeight: "400",
    lineHeight: "1.6",
  },
  bodySmall: {
    fontSize: "14px",
    fontWeight: "400",
    lineHeight: "1.5",
  },
} as const;

// Professional Component Variants
export const componentVariants = {
  card: {
    light: "bg-white border border-black/6 shadow-lg rounded-2xl p-6",
    dark: "bg-black text-white border border-white/10 shadow-lg rounded-2xl p-6",
    glass: "glass-light rounded-2xl p-6",
    floating: "floating-card p-6",
    floatingDark: "floating-card-dark p-6",
  },
  button: {
    primary: "btn-primary",
    secondary: "btn-secondary",
    glass: "btn-glass",
    outline:
      "border border-black text-black hover:bg-black hover:text-white transition-colors duration-200 rounded-xl px-6 py-3 font-semibold",
  },
  input: {
    default: "form-input",
    error: "form-input border-red-500 focus:border-red-500 focus:ring-red-500",
    success:
      "form-input border-green-500 focus:border-green-500 focus:ring-green-500",
  },
} as const;

// Utility Functions
export const cn = (
  ...classes: (string | undefined | null | false)[]
): string => {
  return classes.filter(Boolean).join(" ");
};

export const getResponsiveClasses = (
  sm?: string,
  md?: string,
  lg?: string,
  xl?: string
): string => {
  const classes = [];
  if (sm) classes.push(sm);
  if (md) classes.push(`md:${md}`);
  if (lg) classes.push(`lg:${lg}`);
  if (xl) classes.push(`xl:${xl}`);
  return classes.join(" ");
};

// Professional Motion Presets
export const motionPresets = {
  fadeInUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },
  staggerChildren: {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
} as const;

export default {
  getFloatingCardClasses,
  getGlassClasses,
  getButtonClasses,
  getTextClasses,
  animationClasses,
  layoutClasses,
  formClasses,
  colorUtils,
  spacing,
  borderRadius,
  typography,
  componentVariants,
  cn,
  getResponsiveClasses,
  motionPresets,
};
