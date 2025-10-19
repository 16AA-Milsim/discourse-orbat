import Component from "@glimmer/component";
import { action } from "@ember/object";
import { htmlSafe } from "@ember/template";
import userPrioritizedName from "discourse/helpers/user-prioritized-name";
import DiscourseURL from "discourse/lib/url";
import { formatUsername } from "discourse/lib/utilities";
import { i18n } from "discourse-i18n";

/**
 * @component orbat-node
 * @param {Object} node - Node data from the ORBAT service
 * @param {Object} display - Display preferences inherited from root
 */
export default class OrbatNode extends Component {
  get node() {
    return this.args.node || {};
  }

  get centered() {
    return this.args.centered || false;
  }

  get display() {
    return this.args.display || {};
  }

  get users() {
    return this.node.users || [];
  }

  get level() {
    return Number(this.node.level) || 1;
  }

  get hasParent() {
    return !!this.node.parentCode;
  }

  get children() {
    return this.node.children || [];
  }

  get childCount() {
    return this.children.length;
  }

  get layout() {
    return this.node.layout || {};
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

  get hasChildren() {
    return this.children.length > 0;
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
    const classes = ["orbat-node", `orbat-node--theme-${this.node.theme || "neutral"}`];
    if (this.hasChildren) {
      classes.push("orbat-node--has-children");
    }
    if (!this.hasUsers && !this.hasChildren) {
      classes.push("orbat-node--empty");
    }
    if (this.hasParent) {
      classes.push("orbat-node--has-parent");
    }
    classes.push(`orbat-node--level-${this.level}`);
    if (this.centered) {
      classes.push("orbat-node--centered");
    }
    return classes.join(" ");
  }

  get childrenClass() {
    const type = this.layout.type || "column";
    const classes = ["orbat-node__children", `orbat-node__children--${type}`];
    if (this.childCount === 1) {
      classes.push("orbat-node__children--solo");
    } else if (this.childCount > 1) {
      classes.push("orbat-node__children--multi");
    }
    return classes.join(" ");
  }

  get childrenStyle() {
    const styles = [];
    if (this.layout.columns) {
      styles.push(`--orbat-node-columns:${this.layout.columns};`);
    }
    if (this.layout.gap) {
      styles.push(`--orbat-node-gap:${this.layout.gap};`);
    }
    if (styles.length === 0) {
      return null;
    }
    return htmlSafe(styles.join(""));
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

  get showAvatars() {
    return !!this.display.showAvatars;
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
