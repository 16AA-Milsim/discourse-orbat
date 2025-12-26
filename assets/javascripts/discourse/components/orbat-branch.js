import Component from "@glimmer/component";
import { action } from "@ember/object";
import { scheduleOnce } from "@ember/runloop";
import { registerDestructor } from "@ember/destroyable";
import { htmlSafe } from "@ember/template";

export default class OrbatBranch extends Component {
  constructor() {
    super(...arguments);
    registerDestructor(this, () => this.#teardown());
  }

  get node() {
    return this.args.node || {};
  }

  get display() {
    return this.args.display || {};
  }

  get children() {
    return this.node.children || [];
  }

  get hasChildren() {
    return this.children.length > 0;
  }

  get hasMultipleChildren() {
    return this.children.length > 1;
  }

  get hasSingleChild() {
    return this.hasChildren && !this.hasMultipleChildren;
  }

  get branchStyle() {
    const declarations = [];
    const marginLeft = this.#normalizeSpacing(
      this.node.marginLeft ?? this.node.margin_left
    );
    const marginRight = this.#normalizeSpacing(
      this.node.marginRight ?? this.node.margin_right
    );

    if (marginLeft) {
      declarations.push(`margin-left: ${marginLeft}`);
    }

    if (marginRight) {
      declarations.push(`margin-right: ${marginRight}`);
    }

    if (!declarations.length) {
      return null;
    }

    return htmlSafe(`${declarations.join("; ")};`);
  }

  @action
  setupElement(element) {
    this.element = element;
    this._readyNotified = false;
    this.#observeSize(element);
    scheduleOnce("afterRender", this, this.#updateConnectorMetrics);
  }

  @action
  updateElement(element) {
    if (!this.element) {
      this.setupElement(element);
      return;
    }

    this._readyNotified = false;
    scheduleOnce("afterRender", this, this.#updateConnectorMetrics);
  }

  #observeSize(element) {
    if (!element || !window.ResizeObserver) {
      return;
    }

    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.#updateConnectorMetrics();
      });
    }

    this.resizeObserver.observe(element);
  }

  #updateConnectorMetrics() {
    const element = this.element;
    if (!element || !element.isConnected) {
      return;
    }

    const prevSibling = element.previousElementSibling;
    const nextSibling = element.nextElementSibling;
    const styles = getComputedStyle(element);
    const horizontalGap = this.#getHorizontalGap(
      element.parentElement,
      styles
    );
    const leftMarginValue = this.#parsePixelValue(styles.marginLeft);
    const rightMarginValue = this.#parsePixelValue(styles.marginRight);
    const leftMargin = Number.isFinite(leftMarginValue) ? leftMarginValue : 0;
    const rightMargin = Number.isFinite(rightMarginValue) ? rightMarginValue : 0;
    const leftGap =
      prevSibling && this.#isSameRow(prevSibling, element)
        ? horizontalGap / 2 + leftMargin
        : 0;
    const rightGap =
      nextSibling && this.#isSameRow(nextSibling, element)
        ? horizontalGap / 2 + rightMargin
        : 0;

    const width = element.offsetWidth;
    if (!width) {
      element.style.setProperty("--orbat-connector-left-gap", `${leftGap}px`);
      element.style.setProperty("--orbat-connector-right-gap", `${rightGap}px`);
      return;
    }

    const connectorWidthValue = parseFloat(
      styles.getPropertyValue("--orbat-connector-width")
    );
    const connectorWidth =
      Number.isFinite(connectorWidthValue) && connectorWidthValue > 0
        ? connectorWidthValue
        : 1;
    const verticalLeft = Math.max(
      0,
      Math.floor((width - connectorWidth) / 2)
    );
    const leftSpan = Math.max(0, verticalLeft);
    const rightSpan = Math.max(0, width - verticalLeft - connectorWidth);

    element.style.setProperty("--orbat-connector-offset", `${verticalLeft}px`);
    element.style.setProperty("--orbat-connector-left-span", `${leftSpan}px`);
    element.style.setProperty("--orbat-connector-right-span", `${rightSpan}px`);
    element.style.setProperty(
      "--orbat-connector-vertical-left",
      `${verticalLeft}px`
    );
    element.style.setProperty("--orbat-connector-left-gap", `${leftGap}px`);
    element.style.setProperty("--orbat-connector-right-gap", `${rightGap}px`);

    this.#notifyReadyOnce();
  }

  #getHorizontalGap(parentElement, elementStyles) {
    if (!parentElement) {
      return 0;
    }

    const parentStyles = getComputedStyle(parentElement);
    const candidates = [
      parentStyles.columnGap,
      parentStyles.gap,
      parentStyles.gridColumnGap,
    ];

    for (const candidate of candidates) {
      const parsed = this.#parsePixelValue(candidate);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    const fallback = this.#parsePixelValue(
      elementStyles?.getPropertyValue("--orbat-node-gap")
    );

    return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
  }

  #parsePixelValue(value) {
    if (value === null || value === undefined) {
      return NaN;
    }

    if (typeof value === "number") {
      return value;
    }

    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  #normalizeSpacing(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "number") {
      return `${value}px`;
    }

    const raw = `${value}`.trim();
    if (!raw) {
      return null;
    }

    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      return `${raw}px`;
    }

    return raw;
  }

  #isSameRow(sibling, element) {
    if (!sibling || !element) {
      return false;
    }

    return Math.abs(sibling.offsetTop - element.offsetTop) < 1;
  }

  #notifyReadyOnce() {
    if (this._readyNotified) {
      return;
    }

    this._readyNotified = true;

    const callback = this.args.notifyReady;
    if (typeof callback === "function") {
      callback();
    }
  }

  #teardown() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.element = null;
  }
}
