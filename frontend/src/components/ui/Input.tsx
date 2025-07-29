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
import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, style, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-black placeholder:text-gray-500 ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation",
        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)]",
        className
      )}
      style={{
        WebkitTapHighlightColor: "transparent",
        WebkitUserSelect: "none",
        userSelect: "none",
        outline: "none",
        border: "none",
        color: "#000000 !important",
        WebkitTextFillColor: "#000000 !important",
        boxShadow:
          "inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(255,255,255,0.1)",
        ...style,
      }}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
