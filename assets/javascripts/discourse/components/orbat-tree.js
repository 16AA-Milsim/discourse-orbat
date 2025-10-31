import Component from "@glimmer/component";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { scheduleOnce } from "@ember/runloop";
import { htmlSafe } from "@ember/template";
import { getURLWithCDN } from "discourse/lib/get-url";

const GAP_TOKEN_MAP = {
  xs: "12px",
  sm: "20px",
  md: "28px",
  lg: "36px",
  xl: "48px",
};

/**
 * @component orbat-tree
 * @param {Object} tree - Resolved ORBAT tree payload
 */
export default class OrbatTree extends Component {
  @tracked isReady = false;
  _readyScheduled = false;
  _readyCount = 0;
  _expectedNodes = 0;
  _rootElement = null;
  _readyTimeout = null;

  get tree() {
    return this.args.tree || {};
  }

  get nodes() {
    return this.tree.nodes || [];
  }

  get rootNodes() {
    return this._buildHierarchy();
  }

  get sections() {
    return this._buildSections();
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

  get errors() {
    return this.tree.errors || [];
  }

  get hasErrors() {
    return this.errors.length > 0;
  }

  get banner() {
    return this.tree.banner || {};
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

  _buildSections() {
    const rootNodes = this.rootNodes;
    if (!rootNodes.length) {
      return [];
    }

    const configSections = this._normalizeSectionConfig(this.display.rootSections);
    const claimedCodes = new Set();
    const sections = [];

    const assignNodes = (prefixes) => {
      if (!prefixes.length) {
        return [];
      }

      const matches = [];
      rootNodes.forEach((node) => {
        if (claimedCodes.has(node.code)) {
          return;
        }

        if (this._matchesSection(node, prefixes)) {
          claimedCodes.add(node.code);
          matches.push(node);
        }
      });

      return matches;
    };

    if (configSections.length) {
      configSections.forEach((section) => {
        const nodes = assignNodes(section.prefixes);
        if (!nodes.length && !section.showEmpty) {
          return;
        }

        sections.push(this._decorateSection(section, nodes, sections.length));
      });
    }

    const leftovers = rootNodes.filter((node) => !claimedCodes.has(node.code));

    if (!sections.length) {
      return this._autoSections(rootNodes);
    }

    if (leftovers.length) {
      sections.push(
        this._decorateSection(
          {
            id: "orbat-section-remaining",
            prefixes: [],
            layout: {},
            title: null,
            subtitle: null,
            description: null,
            showEmpty: false,
          },
          leftovers,
          sections.length
        )
      );
    }

    return sections;
  }

  _autoSections(rootNodes) {
    const byPrefix = new Map();
    const ordered = [];

    rootNodes.forEach((node) => {
      const prefix = this._rootPrefix(node.code) || "misc";
      if (!byPrefix.has(prefix)) {
        const id = `auto-${prefix}`;
        const descriptor = {
          id,
          prefixes: prefix === "misc" ? [] : [prefix],
          layout: {},
          title: null,
          subtitle: null,
          description: null,
          showEmpty: false,
        };
        byPrefix.set(prefix, descriptor);
        ordered.push(descriptor);
      }

      const group = byPrefix.get(prefix);
      group.nodes = group.nodes || [];
      group.nodes.push(node);
    });

    return ordered.map((section, index) =>
      this._decorateSection(section, section.nodes || [], index)
    );
  }

  _decorateSection(section, nodes, index) {
    const layout = section.layout || {};
    const layoutType =
      (layout.type || layout.mode || this.display.rootLayout || "column")
        .toString()
        .toLowerCase();
    const layoutClass = this._sectionLayoutClass(layoutType);
    const columns =
      layout.columns ??
      layout.cols ??
      this.display.rootColumns ??
      null;
    const gap = layout.gap;
    const style = this._sectionStyle(columns, gap);

    const id = section.id || `orbat-section-${index + 1}`;

    return {
      id,
      nodes,
      layoutClass,
      listStyle: style,
      title: section.title,
      subtitle: section.subtitle,
      description: section.description,
      hasHeading: Boolean(
        section.title || section.subtitle || section.description
      ),
      showEmpty: section.showEmpty,
      emptyLabel: section.emptyLabel || this.display.emptyLabel,
    };
  }

  _normalizeSectionConfig(rawSections) {
    if (!Array.isArray(rawSections)) {
      return [];
    }

    return rawSections
      .map((section, index) => this._normalizeSectionEntry(section, index))
      .filter(Boolean);
  }

  _normalizeSectionEntry(section, index) {
    if (section === null || section === undefined) {
      return null;
    }

    if (typeof section === "string" || typeof section === "number") {
      return {
        id: `config-section-${index + 1}`,
        prefixes: [section.toString()],
        layout: {},
        title: null,
        subtitle: null,
        description: null,
        showEmpty: false,
      };
    }

    if (typeof section !== "object") {
      return null;
    }

    const prefixes = this._normalizePrefixes(section);

    return {
      id: section.id,
      prefixes,
      layout: section.layout || {},
      title: section.title,
      subtitle: section.subtitle,
      description: section.description,
      showEmpty: section.showEmpty ? true : false,
      emptyLabel: section.emptyLabel || section.placeholder,
    };
  }

  _normalizePrefixes(section) {
    const sources = [];
    if (Array.isArray(section.prefixes)) {
      sources.push(...section.prefixes);
    }
    if (Array.isArray(section.codes)) {
      sources.push(...section.codes);
    }
    if (section.prefix) {
      sources.push(section.prefix);
    }
    if (section.code) {
      sources.push(section.code);
    }
    if (section.match) {
      sources.push(section.match);
    }

    return sources
      .map((value) => (value === null || value === undefined ? "" : value))
      .map((value) => value.toString().trim())
      .filter((value) => value.length > 0);
  }

  _matchesSection(node, prefixes) {
    if (!prefixes.length) {
      return false;
    }

    const code = node?.code?.toString() || "";
    const rootPrefix = this._rootPrefix(code);

    return prefixes.some((prefix) => {
      const normalized = prefix.toString().trim();
      if (!normalized.length) {
        return false;
      }

      if (normalized.includes(".")) {
        return code === normalized || code.startsWith(`${normalized}.`);
      }

      return rootPrefix === normalized;
    });
  }

  _rootPrefix(code) {
    if (!code && code !== 0) {
      return null;
    }

    const parts = code.toString().split(".");
    return parts[0] || null;
  }

  _sectionLayoutClass(type) {
    return type === "row" ? "orbat-tree__list--row" : "orbat-tree__list--column";
  }

  _sectionStyle(columns, gap) {
    const styles = [];
    if (columns !== null && columns !== undefined) {
      const value =
        typeof columns === "number" || /^\d+$/.test(columns)
          ? `${columns}`
          : columns.toString();
      styles.push(`--orbat-root-columns:${value};`);
    }

    const gapValue = this._resolveGap(gap);
    if (gapValue) {
      styles.push(`--orbat-node-gap:${gapValue};`);
    }

    return styles.length ? htmlSafe(styles.join("")) : null;
  }

  _resolveGap(rawGap) {
    if (!rawGap && rawGap !== 0) {
      return null;
    }

    if (typeof rawGap === "number") {
      return `${rawGap}px`;
    }

    const value = rawGap.toString().trim();
    if (!value.length) {
      return null;
    }

    if (/^\d+$/.test(value)) {
      return `${value}px`;
    }

    const token = value.toLowerCase();
    return GAP_TOKEN_MAP[token] || value;
  }

  @action
  registerRoot(element) {
    this._rootElement = element;
    this.isReady = false;
    this._readyCount = 0;
    this._expectedNodes = this.#expectedNodeCount();
    this.#scheduleReady();
  }

  @action
  resetReady() {
    this.isReady = false;
    this._readyCount = 0;
    this._expectedNodes = this.#expectedNodeCount();
    this.#scheduleReady();
  }

  #scheduleReady() {
    if (this._readyScheduled || this.isReady) {
      return;
    }

    this._readyScheduled = true;
    scheduleOnce("afterRender", this, this.#waitForDomReady);

    if (this._readyTimeout) {
      clearTimeout(this._readyTimeout);
    }

    this._readyTimeout = setTimeout(() => {
      if (!this.isReady) {
        this.#finalizeReady();
      }
    }, 1200);
  }

  #waitForDomReady() {
    this._readyScheduled = false;
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    const expected = this.#expectedNodeCount();
    this._expectedNodes = expected;
    if (!expected) {
      this.#finalizeReady();
      return;
    }

    const rootElement = this._rootElement;
    if (!rootElement) {
      this.#finalizeReady();
      return;
    }

    const check = () => {
      if (this.isDestroying || this.isDestroyed) {
        return;
      }

      if (this._readyCount >= expected) {
        this.#finalizeReady();
      } else {
        requestAnimationFrame(check);
      }
    };

    requestAnimationFrame(check);
  }

  #expectedNodeCount() {
    return this.#countNodes(this.rootNodes);
  }

  #countNodes(nodes) {
    if (!nodes || !nodes.length) {
      return 0;
    }

    return nodes.reduce((total, node) => {
      return total + 1 + this.#countNodes(node.children || []);
    }, 0);
  }

  #finalizeReady() {
    if (this._readyTimeout) {
      clearTimeout(this._readyTimeout);
      this._readyTimeout = null;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.isDestroying || this.isDestroyed) {
            return;
          }
          this.isReady = true;
        });
      });
    });
  }

  @action
  handleBranchReady() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    const expected = this._expectedNodes || this.#expectedNodeCount();
    if (!expected) {
      this.#finalizeReady();
      return;
    }

    this._readyCount += 1;
    if (this._readyCount >= expected) {
      this.#finalizeReady();
    }
  }

  willDestroy() {
    super.willDestroy?.(...arguments);
    if (this._readyTimeout) {
      clearTimeout(this._readyTimeout);
      this._readyTimeout = null;
    }
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
