import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines Tailwind classes cleanly and intelligently resolves conflicts.
 * Example: cn("px-4 py-2 bg-purple-500", condition && "bg-red-500")
 * Result: "px-4 py-2 bg-red-500" (It knows to remove the blue!)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
