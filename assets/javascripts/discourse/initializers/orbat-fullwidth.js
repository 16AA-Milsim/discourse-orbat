import { withPluginApi } from "discourse/lib/plugin-api";
import DiscourseURL from "discourse/lib/url";

const ORBAT_PATH_PREFIX = "/orbat";
let hasClickHandler = false;

export default {
  name: "orbat-fullwidth",

  initialize() {
    withPluginApi("1.8.0", (api) => {
      const currentUser = api.getCurrentUser?.();
      const siteSettings = api.siteSettings;

      const isTruthy = (value) => {
        if (value === true) {
          return true;
        }

        if (typeof value === "string") {
          const normalized = value.toLowerCase();
          return normalized === "true" || normalized === "t" || normalized === "1";
        }

        return false;
      };

      const enabledSetting = siteSettings?.orbat_enabled;
      const adminOnlySetting = siteSettings?.orbat_admin_only;

      const isEnabled =
        enabledSetting === undefined ? true : isTruthy(enabledSetting);
      const adminOnly =
        adminOnlySetting === undefined ? false : isTruthy(adminOnlySetting);

      if (!isEnabled) {
        return;
      }

      if (adminOnly && !currentUser?.admin) {
        return;
      }

      const isOrbatPath = (path = "") =>
        path === ORBAT_PATH_PREFIX || path.startsWith(`${ORBAT_PATH_PREFIX}/`);

      const toggleLayout = () => {
        const path = window.location?.pathname || "";
        const isOrbat = isOrbatPath(path);
        document.body.classList.toggle("orbat-fullwidth", isOrbat);
      };

      api.onPageChange(toggleLayout);
      toggleLayout();

      if (!hasClickHandler) {
        const interceptOrbatLinks = (event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }

          const link = event.target.closest?.("a");
          if (!link || !link.getAttribute) {
            return;
          }

          const targetAttr = link.getAttribute("target");
          if (targetAttr && targetAttr !== "_self") {
            return;
          }

          const href = link.getAttribute("href");
          if (!href) {
            return;
          }

          let url;
          try {
            url = new URL(href, window.location.origin);
          } catch {
            return;
          }

          if (url.origin !== window.location.origin) {
            return;
          }

          if (!isOrbatPath(url.pathname)) {
            return;
          }

          event.preventDefault();
          const internalPath = `${url.pathname}${url.search}${url.hash}`;
          DiscourseURL.routeTo(internalPath);
        };

        document.addEventListener("click", interceptOrbatLinks);
        hasClickHandler = true;
      }
    });
  },
};
