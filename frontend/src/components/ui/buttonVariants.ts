import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#7762ff] text-white hover:bg-[#6650e6] shadow-lg hover:shadow-xl",
        secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline:
          "border border-gray-300 bg-transparent text-gray-700 shadow-sm hover:bg-gray-100 hover:text-gray-800",
        ghost: "hover:bg-gray-100 hover:text-gray-800",
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