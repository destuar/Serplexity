/**
 * @file utils.ts
 * @description Utility functions for common operations throughout the application.
 * Provides helper functions for class name merging and other utility operations.
 *
 * @dependencies
 * - clsx: For class name merging.
 * - tailwind-merge: For Tailwind CSS class merging.
 *
 * @exports
 * - cn: Function for merging class names.
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
} 