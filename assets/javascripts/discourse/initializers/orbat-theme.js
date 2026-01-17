import { withPluginApi } from "discourse/lib/plugin-api";

const DARK_CLASS = "orbat-color-scheme-dark";

function resolveSchemeClass() {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const computed = window.getComputedStyle?.(root);
  const scheme = computed?.getPropertyValue("--scheme-type")?.trim();

  let isDark;
  if (scheme === "dark") {
    isDark = true;
  } else if (scheme === "light") {
    isDark = false;
  } else {
    isDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  }

  root.classList.toggle(DARK_CLASS, !!isDark);
}

export default {
  name: "orbat-theme",

  initialize() {
    withPluginApi("1.8.0", (api) => {
      const update = () => {
        if (typeof window === "undefined") {
          resolveSchemeClass();
          return;
        }

        const raf = window.requestAnimationFrame?.bind(window);
        if (raf) {
          raf(resolveSchemeClass);
        } else {
          resolveSchemeClass();
        }
      };

      update();

      api.onAppEvent?.("interface-color:changed", update);

      if (typeof window !== "undefined" && window.matchMedia) {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => update();

        if (media.addEventListener) {
          media.addEventListener("change", handler);
        } else if (media.addListener) {
          media.addListener(handler);
        }
      }
    });
  },
};
