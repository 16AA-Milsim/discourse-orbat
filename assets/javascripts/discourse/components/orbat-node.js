import Component from "@glimmer/component";
import { action } from "@ember/object";
import userPrioritizedName from "discourse/helpers/user-prioritized-name";
import DiscourseURL from "discourse/lib/url";
import { formatUsername } from "discourse/lib/utilities";
import { i18n } from "discourse-i18n";
import { getURLWithCDN } from "discourse/lib/get-url";
import { tracked } from "@glimmer/tracking";
import { htmlSafe } from "@ember/template";

/**
 * @component orbat-node
 * @param {Object} node - Node data from the ORBAT service
 * @param {Object} display - Display preferences inherited from root
 */
export default class OrbatNode extends Component {
  @tracked labelMeasuredWidth = null;

  _labelTextElement = null;
  _measureFrame = null;
  _resizeObserver = null;
  _measureCanvas = null;
  _measureContext = null;
  _singleLineLabelAdjustment = false;

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
    const classes = [
      "orbat-node",
      `orbat-node--theme-${this.node.theme || "neutral"}`,
    ];

    if (this.isNodeHidden) {
      classes.push("orbat-node--hidden");
    }

    return classes.join(" ");
  }

  get icon() {
    return this.resolveIcon(this.node.icon);
  }

  get hasIcon() {
    return !!this.icon;
  }

  get badge() {
    return this.resolveIcon(this.node.badge);
  }

  get hasBadge() {
    return !!this.badge;
  }

  get hideNode() {
    return !!(this.node.hideNode ?? this.node.meta?.hideNode);
  }

  get isNodeHidden() {
    return !!this.hideNode;
  }

  get maxLabelWidth() {
    return this.hasIcon ? 72 : 96;
  }

  get badgeWidth() {
    const raw = this.node.badgeWidth ?? this.node.badge_width;
    const width = parseInt(raw, 10);
    return Number.isFinite(width) && width > 0 ? width : null;
  }

  get badgeStyle() {
    if (!this.badgeWidth) {
      return null;
    }

    return htmlSafe(
      [
        `width: ${this.badgeWidth}px`,
        `--orbat-node-badge-width: ${this.badgeWidth}px`,
      ].join("; ")
    );
  }

  get labelFontSize() {
    const raw = this.node.labelFontSize ?? this.node.label_font_size;
    const size = parseInt(raw, 10);
    return Number.isFinite(size) && size > 0 ? size : null;
  }

  get labelContainerStyle() {
    if (!this.labelFontSize) {
      return null;
    }

    return htmlSafe(`font-size: ${this.labelFontSize}px;`);
  }

  get labelTextStyle() {
    const declarations = [];

    if (this.labelFontSize) {
      declarations.push(`font-size: ${this.labelFontSize}px`);
    }

    if (this.labelMeasuredWidth) {
      declarations.push(`width: ${this.labelMeasuredWidth}px`);
    }

    if (this._singleLineLabelAdjustment) {
      declarations.push("transform: translateY(1px)");
    }

    if (!declarations.length) {
      return null;
    }

    return htmlSafe(`${declarations.join("; ")};`);
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

  @action
  registerLabelText(element) {
    this._labelTextElement = element;
    this._observeLabelElement(element);
    this._scheduleLabelMeasure();

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => this._scheduleLabelMeasure());
    }
  }

  @action
  refreshLabelText(element) {
    if (element) {
      this._labelTextElement = element;
      this._observeLabelElement(element);
    }
    this._scheduleLabelMeasure();
  }

  @action
  unregisterLabelText(element) {
    if (this._labelTextElement === element) {
      this._labelTextElement = null;
    }
    this.labelMeasuredWidth = null;
    this._singleLineLabelAdjustment = false;
    if (this._measureFrame && typeof window !== "undefined") {
      window.cancelAnimationFrame?.(this._measureFrame);
      this._measureFrame = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  _scheduleLabelMeasure() {
    if (!this._labelTextElement || typeof window === "undefined") {
      return;
    }

    if (this._measureFrame) {
      window.cancelAnimationFrame?.(this._measureFrame);
    }

    this._measureFrame = window.requestAnimationFrame?.(() => {
      this._measureFrame = null;
      this._measureAndStoreWidth();
    });

    if (!this._measureFrame) {
      this._measureAndStoreWidth();
    }
  }

  _measureAndStoreWidth() {
    const element = this._labelTextElement;

    if (!element?.isConnected) {
      if (this.labelMeasuredWidth) {
        this.labelMeasuredWidth = null;
      }
      this._singleLineLabelAdjustment = false;
      return;
    }

    let maxLineWidth = 0;
    const computed = window.getComputedStyle?.(element);
    const content = element.textContent?.trim() || "";

    if (!computed || !content) {
      if (this.labelMeasuredWidth) {
        this.labelMeasuredWidth = null;
      }
      this._singleLineLabelAdjustment = false;
      return;
    }

    const lineCount = this._estimateLineCount(element, computed);
    this._singleLineLabelAdjustment = !!lineCount && lineCount <= 1;

    if (this._singleLineLabelAdjustment) {
      if (this.labelMeasuredWidth) {
        this.labelMeasuredWidth = null;
      }
      return;
    }

    maxLineWidth = this._calculateWrappedWidth(content, computed, this.maxLabelWidth);

    if (!maxLineWidth) {
      if (this.labelMeasuredWidth) {
        this.labelMeasuredWidth = null;
      }
      this._singleLineLabelAdjustment = false;
      return;
    }

    const nextWidth = Math.min(Math.ceil(maxLineWidth), this.maxLabelWidth);

    if (!nextWidth) {
      if (this.labelMeasuredWidth) {
        this.labelMeasuredWidth = null;
      }
      this._singleLineLabelAdjustment = false;
      return;
    }

    if (this.labelMeasuredWidth !== nextWidth) {
      this.labelMeasuredWidth = nextWidth;
    }
  }

  _observeLabelElement(element) {
    if (typeof ResizeObserver !== "function" || !element) {
      return;
    }

    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(() => {
        this._scheduleLabelMeasure();
      });
    }

    this._resizeObserver.disconnect();
    this._resizeObserver.observe(element);
  }

  _calculateWrappedWidth(text, computedStyle, maxWidth) {
    const ctx = this._getMeasureContext();
    if (!ctx || !text) {
      return 0;
    }

    const transformed = this._applyTextTransform(text, computedStyle.textTransform);
    const words = transformed.split(/\s+/).filter(Boolean);

    if (!words.length) {
      return 0;
    }

    ctx.font = computedStyle.font || `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

    const letterSpacing = this._parseLetterSpacing(computedStyle.letterSpacing);

    const measureString = (value) => {
      if (!value) {
        return 0;
      }
      const metrics = ctx.measureText(value);
      const baseWidth = metrics?.width || 0;
      const spacingWidth = letterSpacing * Math.max(value.length - 1, 0);
      return baseWidth + spacingWidth;
    };

    let currentLine = "";
    let currentWidth = 0;
    let widestLine = 0;

    for (let index = 0; index < words.length; index++) {
      const word = words[index];
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      let candidateWidth = measureString(candidate);

      if (candidateWidth <= maxWidth || !currentLine) {
        currentLine = candidate;
        currentWidth = Math.min(candidateWidth, maxWidth);
      } else {
        widestLine = Math.max(widestLine, currentWidth);
        currentLine = word;
        candidateWidth = measureString(word);
        currentWidth = Math.min(candidateWidth, maxWidth);
      }
    }

    widestLine = Math.max(widestLine, currentWidth);
    return widestLine;
  }

  _applyTextTransform(text, transform) {
    if (!text) {
      return "";
    }

    switch ((transform || "").toLowerCase()) {
      case "uppercase":
        return text.toUpperCase();
      case "lowercase":
        return text.toLowerCase();
      case "capitalize":
        return text
          .split(" ")
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
          .join(" ");
      default:
        return text;
    }
  }

  _parseLetterSpacing(value) {
    if (!value || value === "normal") {
      return 0;
    }

    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  _getMeasureContext() {
    if (typeof document === "undefined") {
      return null;
    }

    if (!this._measureContext) {
      this._measureCanvas = document.createElement("canvas");
      this._measureContext = this._measureCanvas.getContext("2d");
    }

    return this._measureContext;
  }

  _estimateLineCount(element, computedStyle) {
    if (!element || !computedStyle) {
      return null;
    }

    const height = element.offsetHeight || element.scrollHeight || 0;
    if (!height) {
      return null;
    }

    const lineHeight = this._parseLineHeight(
      computedStyle.lineHeight,
      computedStyle.fontSize
    );

    if (!lineHeight) {
      return null;
    }

    const rawCount = height / lineHeight;

    if (!rawCount || !Number.isFinite(rawCount)) {
      return null;
    }

    return Math.max(1, Math.round(rawCount));
  }

  _parseLineHeight(value, fontSizeValue) {
    if (!value) {
      return null;
    }

    if (value === "normal") {
      const fontSize = parseFloat(fontSizeValue);
      return Number.isFinite(fontSize) ? fontSize * 1.2 : null;
    }

    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }

    if (value.endsWith("px")) {
      return numeric;
    }

    const fontSize = parseFloat(fontSizeValue);
    if (!Number.isFinite(fontSize) || fontSize <= 0) {
      return null;
    }

    return numeric * fontSize;
  }
}
