import ReactDOM from "react-dom/client";
import BlockingOverlay from "./App.tsx";
import "@/assets/tailwind.css";

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",
  runAt: "document_start",

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "lockout-overlay",
      position: "overlay",
      // zIndex: 2147483647,
      anchor: document.documentElement,
      append: "first",
      onMount: (container) => {
        // Create wrapper for React
        const wrapper = document.createElement("div");
        wrapper.id = "lockout-root";
        container.append(wrapper);

        const root = ReactDOM.createRoot(wrapper);
        root.render(<BlockingOverlay />);
        return { root, wrapper };
      },
      onRemove: (elements) => {
        elements?.root.unmount();
        elements?.wrapper.remove();
      },
    });

    ui.mount();
  },
});
