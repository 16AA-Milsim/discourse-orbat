import Component from "@glimmer/component";
import { action } from "@ember/object";
import userPrioritizedName from "discourse/helpers/user-prioritized-name";
import DiscourseURL from "discourse/lib/url";
import { formatUsername } from "discourse/lib/utilities";
import { i18n } from "discourse-i18n";
import { getURLWithCDN } from "discourse/lib/get-url";

/**
 * @component orbat-node
 * @param {Object} node - Node data from the ORBAT service
 * @param {Object} display - Display preferences inherited from root
 */
export default class OrbatNode extends Component {
  get node() {
    return this.args.node || {};
  }

  get display() {
    return this.args.display || {};
  }

  get users() {
    return this.node.users || [];
  }

  get showLabel() {
    return this.args.showLabel !== false;
  }

  get shouldShowHeader() {
    return this.showLabel;
  }

  get hasUsers() {
    return this.users.length > 0;
  }

  get showPlaceholder() {
    return !this.hasUsers && !!this.placeholderText;
  }

  get placeholderText() {
    return (
      this.node.placeholder ||
      this.display.emptyLabel ||
      i18n("orbat.node.empty")
    );
  }

  get wrapperClass() {
    return [
      "orbat-node",
      `orbat-node--theme-${this.node.theme || "neutral"}`,
    ].join(" ");
  }

  get icon() {
    return this.resolveIcon(this.node.icon);
  }

  get hasIcon() {
    return !!this.icon;
  }

  get userColumns() {
    if (!this.hasUsers) {
      return [];
    }

    const size = parseInt(this.display.maxPerColumn, 10);
    if (!size || size <= 0) {
      return [this.users];
    }

    const columns = [];
    for (let index = 0; index < this.users.length; index += size) {
      columns.push(this.users.slice(index, index + size));
    }

    return columns;
  }

  get displayNameFallback() {
    return this.display?.emptyLabel || "-";
  }

  get showAvatars() {
    return !!this.display.showAvatars;
  }

  resolveIcon(value) {
    if (!value) {
      return null;
    }

    const raw = `${value}`.trim();
    if (!raw) {
      return null;
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    if (raw.startsWith("/")) {
      return getURLWithCDN(raw);
    }

    const sanitized = raw.replace(/^\/+/g, "");
    let path = sanitized;

    if (!path.includes("/")) {
      path = `images/common/${path}`;
    } else if (!path.startsWith("images/")) {
      path = `images/${path}`;
    }

    return getURLWithCDN(`/plugins/discourse-orbat/${path}`);
  }

  formatDisplayName(user) {
    if (!user) {
      return this.displayNameFallback;
    }

    const prefix = user.rankPrefix || user.rank_prefix;

    let baseName = user.name?.trim();

    if (!baseName) {
      const prioritized = userPrioritizedName(user)?.trim();
      if (prioritized) {
        baseName = prioritized;
      }
    }

    if (!baseName) {
      baseName = formatUsername(user.username)?.trim();
    }

    if (!baseName) {
      baseName = user.username || this.displayNameFallback;
    }

    if (prefix && baseName && !baseName.startsWith(prefix)) {
      return `${prefix} ${baseName}`.trim();
    }

    return baseName || this.displayNameFallback;
  }

  @action
  openSummary(user, event) {
    const destination =
      user?.summaryPath || user?.profilePath || user?.path || `/u/${user?.username}/summary`;

    if (!destination) {
      return;
    }

    if (
      event?.defaultPrevented ||
      event?.button > 0 ||
      event?.metaKey ||
      event?.ctrlKey ||
      event?.shiftKey ||
      event?.altKey
    ) {
      return;
    }

    event.preventDefault();
    DiscourseURL.routeTo(destination);
  }
}
