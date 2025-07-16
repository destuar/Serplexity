/**
 * @file Input.tsx
 * @description Reusable input component with consistent styling and accessibility features.
 * Provides a standardized input field with proper focus states and styling.
 *
 * @dependencies
 * - react: For component rendering.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - Input: The main input component.
 */
import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-white placeholder:text-white/60 ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 focus-visible:bg-black/8 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          "shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)]",
          "focus-visible:shadow-[inset_0_3px_6px_rgba(0,0,0,0.3),inset_0_-1px_3px_rgba(255,255,255,0.15)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input } 