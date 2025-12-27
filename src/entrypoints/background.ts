import {
  findMatchingBlockedSite,
  getBlockedSites,
  updateStats,
  getSettings,
  getCurrentTabUrl,
  extractDomain,
} from "@/lib/storage";
import {
  initializeDnr,
  syncDnrRules,
  grantAccess,
  isSiteUnlocked,
  getUnlockState,
  handleRelockAlarm,
} from "@/lib/blocker/dnr";

export default defineBackground(() => {
  console.log("[distacted] Background script initialized");

  // Initialize DNR rules on startup
  initializeDnr().catch((err) => {
    console.error("[distacted] Failed to initialize DNR:", err);
  });

  // Re-sync DNR rules when storage changes (blocked sites updated)
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.blockedSites) {
      console.log("[distacted] Blocked sites changed, syncing DNR rules");
      syncDnrRules().catch((err) => {
        console.error("[distacted] Failed to sync DNR rules:", err);
      });
    }
  });

  // Alarm listener for reliable relocking (survives service worker sleep)
  browser.alarms.onAlarm.addListener(async (alarm) => {
    const result = await handleRelockAlarm(alarm.name);
    if (!result) return;

    const { siteId, tabsToRedirect } = result;

    // Redirect all tabs that are on the blocked site
    for (const tabId of tabsToRedirect) {
      try {
        const tab = await browser.tabs.get(tabId);
        if (!tab.url) continue;

        const blockedPageUrl = browser.runtime.getURL(
          `/blocked.html?url=${encodeURIComponent(tab.url)}&siteId=${encodeURIComponent(siteId)}`
        );
        await browser.tabs.update(tabId, { url: blockedPageUrl });
        console.log(`[distacted] Redirected tab ${tabId} after relock`);
      } catch (err) {
        // Tab might have been closed
        console.log(`[distacted] Could not redirect tab ${tabId}:`, err);
      }
    }

    // Broadcast relock event to any blocked pages that might be showing for this site
    // (they should refresh to show the challenge again)
    try {
      await browser.runtime.sendMessage({
        type: "SITE_RELOCKED",
        siteId,
      });
    } catch {
      // No listeners, that's fine
    }
  });

  // Helper to check URL and redirect if blocked
  async function checkAndBlockUrl(tabId: number, url: string, source: string) {
    // Skip extension pages
    if (url.startsWith("chrome-extension://")) return;
    if (url.startsWith("moz-extension://")) return;
    if (url.startsWith("chrome://")) return;
    if (url.startsWith("about:")) return;

    // Check if this URL is blocked
    const site = await findMatchingBlockedSite(url);
    if (!site) return;

    // Check if currently unlocked
    const unlocked = await isSiteUnlocked(site.id);
    if (unlocked) return;

    console.log(`[distacted] Blocking (${source}): ${url}`);

    // Redirect to blocked page
    const blockedPageUrl = browser.runtime.getURL(
      `/blocked.html?url=${encodeURIComponent(url)}&siteId=${encodeURIComponent(site.id)}`
    );

    try {
      await browser.tabs.update(tabId, { url: blockedPageUrl });
    } catch (err) {
      console.error("[distacted] Failed to redirect to blocked page:", err);
    }
  }

  // WebNavigation: fires BEFORE the request is made (hard navigations)
  browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await checkAndBlockUrl(details.tabId, details.url, "onBeforeNavigate");
  });

  // WebNavigation: fires when page uses History API (soft navigations like YouTube/SPAs)
  browser.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await checkAndBlockUrl(details.tabId, details.url, "onHistoryStateUpdated");
  });

  // Fallback: tabs.onUpdated catches any URL changes we might have missed
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
    // Only check when URL actually changes
    if (!changeInfo.url) return;
    await checkAndBlockUrl(tabId, changeInfo.url, "tabs.onUpdated");
  });

  // Handle messages from content scripts, popup, and blocked page
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          // Legacy: Check if URL is blocked (still used by content script for MV2)
          case "CHECK_BLOCKED": {
            const url = message.url as string;
            const site = await findMatchingBlockedSite(url);
            if (site) {
              const settings = await getSettings();
              const unlocked = await isSiteUnlocked(site.id);
              sendResponse({
                blocked: !unlocked,
                site: unlocked ? null : site,
                statsEnabled: settings.statsEnabled,
              });
            } else {
              sendResponse({ blocked: false, site: null, statsEnabled: false });
            }
            break;
          }

          // Get site info for blocked page
          case "GET_SITE_INFO": {
            const { siteId, url } = message as { siteId?: string; url: string };
            const settings = await getSettings();

            let site = null;

            if (siteId) {
              const sites = await getBlockedSites();
              site = sites.find((s) => s.id === siteId) || null;
            }

            if (!site && url) {
              site = await findMatchingBlockedSite(url);
            }

            if (site) {
              // Check if currently unlocked (might have been unlocked by another tab)
              const unlockState = await getUnlockState(site.id);
              if (unlockState) {
                // Site is unlocked - tell the blocked page it can skip the challenge
                sendResponse({
                  site,
                  statsEnabled: settings.statsEnabled,
                  alreadyUnlocked: true,
                  expiresAt: unlockState.expiresAt,
                });
              } else {
                sendResponse({
                  site,
                  statsEnabled: settings.statsEnabled,
                  alreadyUnlocked: false,
                });
              }
            } else {
              sendResponse({ site: null, statsEnabled: false });
            }
            break;
          }

          // Check if a site is unlocked (for blocked page to poll)
          case "CHECK_UNLOCK_STATE": {
            const { siteId } = message as { siteId: string };
            const unlockState = await getUnlockState(siteId);
            sendResponse({
              unlocked: !!unlockState,
              expiresAt: unlockState?.expiresAt ?? null,
            });
            break;
          }

          // Unlock a site (called from blocked page after challenge)
          case "UNLOCK_SITE": {
            const { siteId, durationMinutes } = message as {
              siteId: string;
              durationMinutes: number | null;
            };

            const { expiresAt } = await grantAccess(siteId, durationMinutes);

            // Broadcast to all blocked pages for this site so they can update UI
            try {
              await browser.runtime.sendMessage({
                type: "SITE_UNLOCKED",
                siteId,
                expiresAt,
              });
            } catch {
              // No listeners, that's fine
            }

            sendResponse({ success: true, expiresAt });
            break;
          }

          // Update stats
          case "UPDATE_STATS": {
            const { siteId, update } = message as {
              siteId: string;
              update: {
                incrementVisit?: boolean;
                incrementPassed?: boolean;
                addTime?: number;
              };
            };
            await updateStats(siteId, update);
            sendResponse({ success: true });
            break;
          }

          // Get settings
          case "GET_SETTINGS": {
            const settings = await getSettings();
            sendResponse({ settings });
            break;
          }

          // Get current tab URL (for popup)
          case "GET_CURRENT_TAB_URL": {
            const url = await getCurrentTabUrl();
            const domain = url ? extractDomain(url) : "";
            sendResponse({ url, domain });
            break;
          }

          // Force re-sync DNR rules
          case "SYNC_DNR_RULES": {
            await syncDnrRules();
            sendResponse({ success: true });
            break;
          }

          default:
            sendResponse({ error: "Unknown message type" });
        }
      } catch (error) {
        console.error("[distacted] Message handler error:", error);
        sendResponse({ error: String(error) });
      }
    })();

    return true; // Keep message channel open for async response
  });
});
