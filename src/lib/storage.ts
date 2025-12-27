import type {
  UnlockMethod,
  ChallengeSettingsMap,
} from "@/components/challenges";

export type { UnlockMethod, ChallengeSettingsMap };

export interface PatternRule {
  pattern: string; // URL pattern (e.g., "twitter.com", "*.reddit.com", "x.com/messages")
  allow: boolean; // true = allow (whitelist), false = block
}

export interface BlockedSite {
  id: string;
  name: string; // Display name for the rule set
  rules: PatternRule[]; // Multiple patterns with allow/deny
  unlockMethod: UnlockMethod;
  challengeSettings: ChallengeSettingsMap[UnlockMethod]; // Settings for the challenge
  autoRelockAfter: number | null; // minutes before re-locking, null = no auto-relock
  enabled: boolean;
  createdAt: number;
}

export interface SiteStats {
  siteId: string;
  visitCount: number;
  passedCount: number;
  timeSpentMs: number; // time spent on site after unlocking
  lastVisit: number;
}

export interface Settings {
  statsEnabled: boolean;
}

import { DEFAULT_AUTO_RELOCK, STORAGE_KEYS } from "./consts";

export const defaultSettings: Settings = {
  statsEnabled: true,
};

export async function getBlockedSites(): Promise<BlockedSite[]> {
  const result = (await browser.storage.local.get(
    STORAGE_KEYS.BLOCKED_SITES
  )) as Record<string, BlockedSite[] | undefined>;
  return result[STORAGE_KEYS.BLOCKED_SITES] ?? [];
}

export async function saveBlockedSites(sites: BlockedSite[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites });
}

export async function addBlockedSite(
  site: Omit<BlockedSite, "id" | "createdAt">
): Promise<BlockedSite> {
  const sites = await getBlockedSites();
  const newSite: BlockedSite = {
    ...site,
    id: Math.random().toString(36).substring(2, 10),
    createdAt: Date.now(),
  };
  sites.push(newSite);
  await saveBlockedSites(sites);
  return newSite;
}

export async function updateBlockedSite(
  id: string,
  updates: Partial<BlockedSite>
): Promise<void> {
  const sites = await getBlockedSites();
  const index = sites.findIndex((s) => s.id === id);
  if (index !== -1) {
    sites[index] = { ...sites[index], ...updates };
    await saveBlockedSites(sites);
  }
}



export async function getStats(): Promise<SiteStats[]> {
  const result = (await browser.storage.local.get(
    STORAGE_KEYS.STATS
  )) as Record<string, SiteStats[] | undefined>;
  return result[STORAGE_KEYS.STATS] ?? [];
}

export async function getSettings(): Promise<Settings> {
  const result = (await browser.storage.local.get(
    STORAGE_KEYS.SETTINGS
  )) as Record<string, Settings | undefined>;
  return { ...defaultSettings, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) };
}



export function urlMatchesPattern(url: string, pattern: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    let normalizedPattern = pattern.toLowerCase().trim();
    normalizedPattern = normalizedPattern
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "");

    if (normalizedPattern.includes("/")) {
      const [patternHost, ...pathParts] = normalizedPattern.split("/");
      const patternPath = "/" + pathParts.join("/");

      let hostMatches = false;
      if (patternHost.startsWith("*.")) {
        const domain = patternHost.slice(2);
        hostMatches = hostname === domain || hostname.endsWith("." + domain);
      } else {
        hostMatches =
          hostname === patternHost ||
          hostname === "www." + patternHost ||
          hostname.replace(/^www\./, "") === patternHost;
      }

      if (!hostMatches) return false;

      return (
        pathname.startsWith(patternPath) ||
        pathname === patternPath.replace(/\/$/, "")
      );
    }

    if (normalizedPattern.startsWith("*.")) {
      const domain = normalizedPattern.slice(2);
      return hostname === domain || hostname.endsWith("." + domain);
    }

    return (
      hostname === normalizedPattern ||
      hostname === "www." + normalizedPattern ||
      hostname.replace(/^www\./, "") === normalizedPattern
    );
  } catch {
    return false;
  }
}

export function urlMatchesSiteRules(url: string, site: BlockedSite): boolean {
  if (!site.enabled) return false;

  let isBlocked = false;

  // Process rules in order - allow rules can override block rules
  for (const rule of site.rules) {
    if (urlMatchesPattern(url, rule.pattern)) {
      if (rule.allow) {
        return false;
      } else {
        isBlocked = true;
      }
    }
  }

  return isBlocked;
}

export async function findMatchingBlockedSite(
  url: string
): Promise<BlockedSite | null> {
  const sites = await getBlockedSites();
  return sites.find((site) => urlMatchesSiteRules(url, site)) || null;
}
