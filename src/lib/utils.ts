import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BROWSER_SCHEMES, EXTENSION_SCHEMES } from "./consts"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format time duration
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Get the browser's extension scheme (e.g., chrome-extension://, moz-extension://)
 */
export function getExtensionScheme(): string {
  // Use WXT env if available
  if (typeof import.meta !== "undefined" && import.meta.env?.BROWSER) {
    const browser = import.meta.env.BROWSER.toLowerCase();
    return EXTENSION_SCHEMES[browser as keyof typeof EXTENSION_SCHEMES] || EXTENSION_SCHEMES.chrome;
  }

  // Fallback: detect from runtime
  if (typeof browser !== "undefined" && browser.runtime) {
    const url = browser.runtime.getURL("");
    const match = url.match(/^([a-z-]+:\/\/)/);
    if (match) {
      return match[1];
    }
  }

  // Default fallback
  return EXTENSION_SCHEMES.chrome;
}

/**
 * Get the browser's internal scheme (e.g., chrome://, brave://, about:)
 */
export function getBrowserScheme(): string {
  // Use WXT env if available
  if (typeof import.meta !== "undefined" && import.meta.env?.BROWSER) {
    const browser = import.meta.env.BROWSER.toLowerCase();
    return BROWSER_SCHEMES[browser as keyof typeof BROWSER_SCHEMES] || BROWSER_SCHEMES.chrome;
  }

  // Fallback: try to detect from user agent or other methods
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("firefox")) return BROWSER_SCHEMES.firefox;
    if (ua.includes("edg")) return BROWSER_SCHEMES.edge;
    if (ua.includes("brave")) return BROWSER_SCHEMES.brave;
    if (ua.includes("safari") && !ua.includes("chrome")) return BROWSER_SCHEMES.safari;
  }

  // Default fallback
  return BROWSER_SCHEMES.chrome;
}

/**
 * Check if a URL is an internal/extension page that should be skipped
 */
export function isInternalUrl(url: string): boolean {
  if (!url) return false;

  const extensionScheme = getExtensionScheme();
  const browserScheme = getBrowserScheme();

  // Check extension URLs
  if (url.startsWith(extensionScheme)) return true;
  
  // Check browser internal URLs
  if (url.startsWith(browserScheme)) return true;
  
  // Check about: URLs (Firefox)
  if (url.startsWith("about:")) return true;

  return false;
}
