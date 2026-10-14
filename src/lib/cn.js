import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with tailwind-merge to resolve conflicts.
 * 
 * @param {...(string|undefined|null|false)} inputs - Class names or conditional objects
 * @returns {string} - Merged class string
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
