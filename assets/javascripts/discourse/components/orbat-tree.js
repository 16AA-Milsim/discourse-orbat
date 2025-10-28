import Component from "@glimmer/component";
import { action } from "@ember/object";
import { htmlSafe } from "@ember/template";
import { getURLWithCDN } from "discourse/lib/get-url";

/**
 * @component orbat-tree
 * @param {Object} tree - Resolved ORBAT tree payload
 */
export default class OrbatTree extends Component {
  get tree() {
    return this.args.tree || {};
  }

  get nodes() {
    return this.tree.nodes || [];
  }

  get rootNodes() {
    return this._buildHierarchy();
  }

  get hasNodes() {
    return this.rootNodes.length > 0;
  }

  get mastheadLogo() {
    return this.resolveImage("16th_air_assault.svg");
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

  get rootLayoutClass() {
    const layout = (this.display.rootLayout || "column").toLowerCase();
    return layout === "row"
      ? "orbat-tree__list--row"
      : "orbat-tree__list--column";
  }

  resolveImage(filename) {
    if (!filename) {
      return null;
    }

    const sanitized = filename.replace(/^\/+/g, "");
    let path = sanitized;

    if (!path.includes("/")) {
      path = `images/common/${path}`;
    } else if (!path.startsWith("images/")) {
      path = `images/${path}`;
    }

    return getURLWithCDN(`/plugins/discourse-orbat/${path}`);
  }

  _buildHierarchy() {
    const clones = this.nodes.map((node) => this._cloneNode(node));
    const byCode = new Map();

    const register = (node) => {
      byCode.set(node.code, node);
      (node.children || []).forEach(register);
    };

    clones.forEach(register);

    const roots = [];

    const attachToParent = (node) => {
      const parentCode = node.parentCode || this._deriveParentCode(node.code);
      if (parentCode && byCode.has(parentCode) && byCode.get(parentCode) !== node) {
        const parent = byCode.get(parentCode);
        parent.children = parent.children || [];
        if (!parent.children.some((child) => child.code === node.code)) {
          parent.children.push(node);
        }
        return true;
      }

      return false;
    };

    clones.forEach((node) => {
      if (!attachToParent(node)) {
        roots.push(node);
      }
    });

    return roots;
  }

  _cloneNode(node) {
    return {
      ...node,
      children: (node.children || []).map((child) => this._cloneNode(child)),
    };
  }

  _deriveParentCode(code) {
    if (!code) {
      return null;
    }

    const parts = code.toString().split(".");
    if (parts.length < 2) {
      return null;
    }

    parts.pop();
    return parts.join(".");
  }
}
