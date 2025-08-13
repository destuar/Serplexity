/**
 * @file buttonVariants.ts
 * @description Button variant configurations using class-variance-authority for consistent styling.
 * Defines different button styles, sizes, and states for the Button component.
 *
 * @dependencies
 * - class-variance-authority: For variant management.
 * - ../../config/colors: Centralized color configuration.
 *
 * @exports
 * - buttonVariants: The button variant configuration function.
 */
import { cva } from "class-variance-authority";
import { buttonClasses } from "../../utils/colorClasses";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: buttonClasses.primary,
        secondary: buttonClasses.secondary,
        destructive: buttonClasses.destructive,
        outline: buttonClasses.outline,
        ghost: buttonClasses.ghost,
        // Pilled buttons (no dark hover, subtle press)
        pill: "px-3 py-2 rounded-lg text-sm bg-white/80 backdrop-blur-sm border border-white/20 shadow text-gray-700 active:shadow-inner active:bg-white/60 active:border-white/30",
        pillActive:
          "px-3 py-2 rounded-lg text-sm bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
