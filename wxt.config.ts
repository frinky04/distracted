import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox";

    // Base permissions shared between browsers
    const basePermissions = ["storage", "tabs", "activeTab", "webNavigation", "alarms"];

    // MV3 Chrome uses declarativeNetRequest + webNavigation for redirect
    // MV2 Firefox uses webRequest blocking (needs host permissions)
    const permissions = isFirefox
      ? [...basePermissions, "webRequest", "webRequestBlocking"]
      : [...basePermissions, "declarativeNetRequest"];

    // Only Firefox MV2 needs host permissions for webRequest
    const hostPermissions = isFirefox ? ["<all_urls>"] : [];

    return {
      name: "distacted",
      description:
        "Block distracting websites with customizable unlock challenges",
      permissions,
      host_permissions: hostPermissions,
      // DNR requires declaring the rule resources for static rules (we use dynamic only)
      // But we need to declare the permission properly
      ...(isFirefox
        ? {}
        : {
            // Chrome MV3: allow modifying headers for debugging if needed
            declarative_net_request: {
              rule_resources: [],
            },
          }),
    };
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }),
});
