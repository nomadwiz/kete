// Joins class names and lets a later Tailwind utility beat an earlier one.
// Usage: cn("p-4 bg-accent", props.className) -- a caller's class wins, which
// is what makes a variant overridable without every component taking a prop
// for it. clsx handles the conditionals, tailwind-merge resolves the conflicts.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
