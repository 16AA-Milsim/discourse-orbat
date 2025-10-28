import Component from "@glimmer/component";
import { action } from "@ember/object";
import { scheduleOnce } from "@ember/runloop";
import { registerDestructor } from "@ember/destroyable";

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

  @action
  setupElement(element) {
    this.element = element;
    this.#observeSize(element);
    scheduleOnce("afterRender", this, this.#updateConnectorMetrics);
  }

  @action
  updateElement(element) {
    if (!this.element) {
      this.setupElement(element);
      return;
    }

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

    const width = element.offsetWidth;
    if (!width) {
      return;
    }

    const styles = getComputedStyle(element);
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
  }

  #teardown() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.element = null;
  }
}
