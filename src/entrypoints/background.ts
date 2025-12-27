import {
  findMatchingBlockedSite,
  getBlockedSites,
  updateStats,
  getSettings,
  getCurrentTabUrl,
  extractDomain,
} from "@/lib/storage";
import {
  initializeBlocker,
  syncRules,
  grantAccess,
  isSiteUnlocked,
  getUnlockState,
  handleRelockAlarm,
  isMV3,
} from "@/lib/blocker";
import { isInternalUrl } from "@/lib/utils";

export default defineBackground(() => {
  console.log("[distacted] Background script initialized");

  // Initialize the blocker (DNR for MV3, webRequest for MV2)
  initializeBlocker().catch((err) => {
    console.error("[distacted] Failed to initialize blocker:", err);
  });

  // Re-sync rules when storage changes (blocked sites updated)
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.blockedSites) {
      console.log("[distacted] Blocked sites changed, syncing rules");
      syncRules().catch((err) => {
        console.error("[distacted] Failed to sync rules:", err);
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
        console.log(`[distacted] Could not redirect tab ${tabId}:`, err);
      }
    }

    // Broadcast relock event to any blocked pages
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
  // Used by webNavigation listeners for soft navigation detection
  async function checkAndBlockUrl(tabId: number, url: string, source: string) {
    // Skip extension pages and internal URLs
    if (isInternalUrl(url)) return;

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

  // WebNavigation listeners for catching navigations
  // For MV3: Primary blocking mechanism (DNR just blocks as fallback)
  // For MV2: Catches soft navigations that webRequest misses
  browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;
    // For MV2, webRequest handles hard navigations, but we still want this
    // for the redirect (webRequest can only block, this actually redirects)
    // Actually for MV2 webRequest does redirect. But this catches things faster.
    if (!isMV3) return; // Let webRequest handle it for MV2
    await checkAndBlockUrl(details.tabId, details.url, "onBeforeNavigate");
  });

  // Soft navigation detection (History API)
  browser.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await checkAndBlockUrl(details.tabId, details.url, "onHistoryStateUpdated");
  });

  // Fallback: tabs.onUpdated catches URL changes
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
    if (!changeInfo.url) return;
    // For MV2, webRequest handles hard navigations, skip those
    // But still catch soft navigations
    await checkAndBlockUrl(tabId, changeInfo.url, "tabs.onUpdated");
  });

  // Handle messages from popup and blocked page
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
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
              const unlockState = await getUnlockState(site.id);
              if (unlockState) {
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

          case "CHECK_UNLOCK_STATE": {
            const { siteId } = message as { siteId: string };
            const unlockState = await getUnlockState(siteId);
            sendResponse({
              unlocked: !!unlockState,
              expiresAt: unlockState?.expiresAt ?? null,
            });
            break;
          }

          case "UNLOCK_SITE": {
            const { siteId, durationMinutes } = message as {
              siteId: string;
              durationMinutes: number | null;
            };

            const { expiresAt } = await grantAccess(siteId, durationMinutes);

            // Broadcast to all blocked pages for this site
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

          case "GET_SETTINGS": {
            const settings = await getSettings();
            sendResponse({ settings });
            break;
          }

          case "GET_CURRENT_TAB_URL": {
            const url = await getCurrentTabUrl();
            const domain = url ? extractDomain(url) : "";
            sendResponse({ url, domain });
            break;
          }

          case "SYNC_RULES": {
            await syncRules();
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

    return true;
  });
});
