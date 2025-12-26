import {
  findMatchingBlockedSite,
  updateStats,
  getSettings,
  getCurrentTabUrl,
  extractDomain,
} from "@/lib/storage";

export default defineBackground(() => {
  console.log("[Lockout] Background script initialized");

  // Handle messages from content scripts and popup
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          case "CHECK_BLOCKED": {
            const url = message.url as string;
            const site = await findMatchingBlockedSite(url);
            if (site) {
              const settings = await getSettings();
              sendResponse({
                blocked: true,
                site,
                statsEnabled: settings.statsEnabled,
              });
            } else {
              sendResponse({ blocked: false, site: null, statsEnabled: false });
            }
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

          default:
            sendResponse({ error: "Unknown message type" });
        }
      } catch (error) {
        console.error("[Lockout] Message handler error:", error);
        sendResponse({ error: String(error) });
      }
    })();

    return true;
  });
});
