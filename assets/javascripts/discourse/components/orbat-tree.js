import Component from "@glimmer/component";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import getURL from "discourse/lib/get-url";
import DiscourseURL from "discourse/lib/url";

/**
 * @component orbat-tree
 * @param {Object} tree - Resolved ORBAT tree payload
 */
export default class OrbatTree extends Component {
  @service routeHistory;

  get tree() {
    return this.args.tree || {};
  }

  get nodes() {
    return this.tree.nodes || [];
  }

  get display() {
    return this.tree.display || {};
  }

  get errors() {
    return this.tree.errors || [];
  }

  get hasErrors() {
    return this.errors.length > 0;
  }

  get hasNodes() {
    return this.nodes.length > 0;
  }

  get banner() {
    return this.tree.banner || {};
  }

  get hasBanner() {
    return (
      this.banner.title ||
      this.banner.subtitle ||
      this.banner.logo ||
      this.tree.title ||
      this.tree.subtitle
    );
  }

  get rootClassNames() {
    const layout = this.display.rootLayout || "row";
    const gap = this.display.gap || "lg";
    const classes = ["orbat-tree__nodes", `orbat-tree__nodes--${layout}`];
    classes.push(`orbat-tree__nodes--gap-${gap}`);
    return classes.join(" ");
  }

  get rootStyle() {
    const styles = [];
    if (this.display.rootColumns) {
      styles.push(`--orbat-root-columns:${this.display.rootColumns};`);
    }
    return styles.length ? htmlSafe(styles.join("")) : null;
  }

  get backHref() {
    const previous = this.routeHistory?.lastURL;
    if (previous && previous !== "/orbat") {
      return getURL(previous);
    }
    return getURL("/");
  }

  @action
  goBack(event) {
    event?.preventDefault();

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    DiscourseURL.routeTo(this.backHref);
  }
}
