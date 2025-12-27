import React from "react";
import {
  IconClock,
  IconHandStop,
  IconKeyboard,
} from "@tabler/icons-react";
import type { UnlockMethod } from "./storage";

// Storage constants
export const DEFAULT_AUTO_RELOCK = 3; // 3 minutes default

export const STORAGE_KEYS = {
  BLOCKED_SITES: "blockedSites",
  STATS: "siteStats",
  SETTINGS: "settings",
} as const;

// Blocker constants
export const RULE_ID_BASE = 1000;
export const MAX_RULES_PER_SITE = 100; // Max patterns per site
export const UNLOCK_PREFIX = "unlock_";
export const ALARM_PREFIX = "relock_";

// Challenge metadata - using React.createElement to avoid JSX in .ts file
export const UNLOCK_METHOD_INFO: Record<
  UnlockMethod,
  { label: string; icon: React.ReactNode; description: string }
> = {
  timer: {
    label: "Wait Timer",
    icon: React.createElement(IconClock, { className: "size-4" }),
    description: "Wait for a countdown to finish",
  },
  hold: {
    label: "Hold Button",
    icon: React.createElement(IconHandStop, { className: "size-4" }),
    description: "Hold a button continuously",
  },
  type: {
    label: "Type Text",
    icon: React.createElement(IconKeyboard, { className: "size-4" }),
    description: "Type a random UUID (no copy/paste)",
  },
};

// Browser scheme mappings
export const BROWSER_SCHEMES = {
  chrome: "chrome://",
  chromium: "chrome://",
  brave: "brave://",
  edge: "edge://",
  firefox: "about:",
  safari: "safari-extension://",
} as const;

export const EXTENSION_SCHEMES = {
  chrome: "chrome-extension://",
  chromium: "chrome-extension://",
  brave: "chrome-extension://",
  edge: "chrome-extension://",
  firefox: "moz-extension://",
  safari: "safari-extension://",
} as const;
