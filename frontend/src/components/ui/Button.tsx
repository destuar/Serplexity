/**
 * @file Button.tsx
 * @description Reusable button component with multiple variants, sizes, and states.
 * Built using Radix UI Slot primitive and class-variance-authority for consistent styling.
 *
 * @dependencies
 * - react: For component rendering.
 * - @radix-ui/react-slot: For slot functionality.
 * - class-variance-authority: For variant management.
 * - ../../lib/utils: For utility functions.
 * - ./buttonVariants: For button style variants.
 *
 * @exports
 * - Button: The main button component.
 */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"
import { buttonVariants } from "./buttonVariants"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button } 