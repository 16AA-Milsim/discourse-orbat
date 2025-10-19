import Component from "@glimmer/component";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import getURL, { getURLWithCDN } from "discourse/lib/get-url";
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

  get primaryNode() {
    return this.nodes[0] || null;
  }

  get mastheadLogo() {
    return this.resolveImage("16th_air_assault.svg");
  }

  get hqIcon() {
    return this.resolveImage("hq.png");
  }

  get platoonIcon() {
    return this.resolveImage("red_hq.png");
  }

  get secondaryNodes() {
    if (this.nodes.length <= 1) {
      return [];
    }

    return this.nodes.slice(1);
  }

  get hasPrimaryNode() {
    return !!this.primaryNode;
  }

  get hasSecondaryNodes() {
    return this.secondaryNodes.length > 0;
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

  resolveImage(filename) {
    return getURLWithCDN(`/plugins/discourse-orbat/images/common/${filename}`);
  }
}
