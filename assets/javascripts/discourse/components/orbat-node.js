import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { registerDestructor } from "@ember/destroyable";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import getURL, { getURLWithCDN } from "discourse/lib/get-url";
import DiscourseURL from "discourse/lib/url";
import { formatUsername } from "discourse/lib/utilities";
import { i18n } from "discourse-i18n";

const ADDITIONAL_QUALIFICATIONS_ORDER = Object.freeze([
  "CIC Phase 1",
  "CIC Phase 2",
  "Basic AT",
  "Machine Gunner",
  "Navigation",
  "3rd Class Marksman",
  "2nd Class Marksman",
  "1st Class Marksman",
  "Sharpshooter",
  "Sniper",
  "Basic Signals",
  "Advanced Signaller",
  "CTM",
  "CTM Bronze",
  "CTM Silver",
  "CTM Gold",
  "CMT",
  "Mortar Operator",
  "Mortar Line Commander",
  "Advanced AT",
  "Heavy Weapons Operator",
  "Forward Observer",
  "JTAC",
  "Paratrooper",
  "Freefaller",
  "Parachute Jump Instructor",
  "Pathfinder",
  "Junior Pilot",
  "Senior Pilot",
  "Apache Pilot Qualification",
  "FTCC",
  "CC",
  "SCBC",
  "PSBC",
  "PCBC",
  "ITC Instructor",
]);
const ADDITIONAL_QUALIFICATIONS_ORDER_MAP = new Map(
  ADDITIONAL_QUALIFICATIONS_ORDER.map((name, index) => [name.toLowerCase(), index])
);
const ADDITIONAL_QUALIFICATIONS_IMAGE_MAP = Object.freeze({
  "cic phase 1": "cicp1__v2.png",
  "cic phase 2": "cicp2__v2.png",
  "basic at": "basicat__v2.jpg",
  "machine gunner": "machinegunner__v2.png",
  navigation: "navigation__v2.jpg",
  "3rd class marksman": "3rdclassmarksman__v2.jpg",
  "2nd class marksman": "2ndclassmarksman__v2.jpg",
  "1st class marksman": "1stclassmarksman__v2.jpg",
  "basic signals": "basicsignals__v2.jpg",
  "advanced signaller": "advancedsignals__v2.jpg",
  "mortar operator": "mortaroperator__v2.jpg",
  "mortar line commander": "mortarlinecommander__v2.jpg",
  "advanced at": "advancedat__v2.jpg",
  "heavy weapons operator": "heavyweaponsoperator__v2.png",
  "forward observer": "forwardobserver__v2.jpg",
  jtac: "jtac__v2.jpg",
  freefaller: "freefaller__v2.jpg",
  "parachute jump instructor": "parachutejumpinstructor__v2.jpg",
  pathfinder: "pathfinder__v2.png",
  "apache pilot qualification": "apachepilotqual__v2.png",
});
const PROJECT_UNIFORM_UNIFORM_DATA_MODULE_ID =
  "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

/**
 * @component orbat-node
 * @param {Object} node - Node data from the ORBAT service
 * @param {Object} display - Display preferences inherited from root
 */
export default class OrbatNode extends Component {
  static UNAVAILABLE_PREVIEW_RECHECK_MS = 30_000;
  static UNIFORM_PREVIEW_MARGIN_PX = 8;
  static UNIFORM_PREVIEW_GAP_PX = 8;
  static UNIFORM_PREVIEW_PREFETCH_IDLE_TIMEOUT_MS = 1_200;
  static UNIFORM_PREVIEW_PREFETCH_CONCURRENCY = 2;
  static UNIFORM_PREVIEW_FOCUS_SUPPRESS_MS = 500;
  static UNIFORM_PREVIEW_QUAL_ITEM_WIDTH_PX = 44;
  static UNIFORM_PREVIEW_QUAL_DEFAULT_GAP_PX = 12;
  static UNIFORM_PREVIEW_DEFAULT_WIDTH_PX = 260;
  static UNIFORM_PREVIEW_DEFAULT_HORIZONTAL_PADDING_PX = 16;

  @service siteSettings;
  @service orbatUniformPreviewCache;

  @tracked labelMeasuredWidth = null;
  @tracked forceSingleLineLabel = false;
  @tracked hoveredUniformPreviewKey = null;
  @tracked uniformPreviewLayoutCache = Object.create(null);

  _labelTextElement = null;
  _measureFrame = null;
  _resizeObserver = null;
  _measureCanvas = null;
  _measureContext = null;
  _singleLineLabelAdjustment = false;
  _uniformPreviewLayoutFrames = new Map();
  _uniformPreviewElements = new Map();
  _uniformPreviewResizeObservers = new Map();
  _uniformPreviewSuppressFocusUntilByKey = new Map();
  _uniformPreviewViewportListening = false;
  _boundHandleUniformPreviewViewportChange = null;
  _usersContainerElement = null;
  _uniformPreviewPrefetchIdleId = null;
  _uniformPreviewPrefetchTimeoutId = null;
  _uniformPreviewPrefetchToken = 0;

  constructor(owner, args) {
    super(owner, args);
    this._boundHandleUniformPreviewViewportChange = () => {
      this.#handleUniformPreviewViewportChange();
    };
    registerDestructor(this, () => {
      this._uniformPreviewPrefetchToken += 1;
      this.#cancelUniformPreviewPrefetch();
      this.#clearUniformPreviewLayoutCache();
      this.#cancelAllUniformPreviewLayoutFrames();
      this.#disconnectAllUniformPreviewResizeObservers();
      this._uniformPreviewSuppressFocusUntilByKey.clear();
      this.#teardownUniformPreviewViewportListeners();
    });
  }

  get node() {
    return this.args.node || {};
  }

  get display() {
    return this.args.display || {};
  }

  get tintExclusionList() {
    return this.#normalizeExclusionList(
      this.display.tintExcludeSvgs ?? this.display.tint_exclude_svgs
    );
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

    if (this.hasActiveUniformPreview) {
      classes.push("orbat-node--uniform-preview-active");
    }

    return classes.join(" ");
  }

  get icon() {
    return this.resolveIcon(this.node.icon);
  }

  get hasIcon() {
    return !!this.icon;
  }

  get iconIsSvg() {
    return this.#isSvgAsset(this.node.icon);
  }

  get iconTintEnabled() {
    return this.#normalizeToggle(this.node.iconTint ?? this.node.icon_tint, true);
  }

  get shouldTintIcon() {
    return (
      this.iconIsSvg &&
      this.iconTintEnabled &&
      !this.#isTintExcluded(this.node.icon, this.tintExclusionList)
    );
  }

  get iconFilterEnabled() {
    if (this.#isPngAsset(this.node.icon)) {
      return false;
    }

    const value = this.node.iconFilter ?? this.node.icon_filter;
    if (value === undefined || value === null) {
      return false;
    }

    return !!value;
  }

  get iconClass() {
    const classes = ["orbat-node__icon"];
    if (this.iconFilterEnabled) {
      classes.push("orbat-node__icon--filtered");
    }
    return classes.join(" ");
  }

  get iconSourceClass() {
    return "orbat-node__icon orbat-node__icon--source";
  }

  get badge() {
    return this.resolveIcon(this.node.badge);
  }

  get hasBadge() {
    return !!this.badge;
  }

  get badgeIsSvg() {
    return this.#isSvgAsset(this.node.badge);
  }

  get badgeTintEnabled() {
    return this.#normalizeToggle(this.node.badgeTint ?? this.node.badge_tint, true);
  }

  get shouldTintBadge() {
    return (
      this.badgeIsSvg &&
      this.badgeTintEnabled &&
      !this.#isTintExcluded(this.node.badge, this.tintExclusionList)
    );
  }

  get badgeFilterEnabled() {
    if (this.#isPngAsset(this.node.badge)) {
      return false;
    }

    const value = this.node.badgeFilter ?? this.node.badge_filter;
    if (value === undefined || value === null) {
      return false;
    }

    return !!value;
  }

  get badgeClass() {
    const classes = ["orbat-node__badge"];
    if (this.badgeFilterEnabled) {
      classes.push("orbat-node__badge--filtered");
    }
    return classes.join(" ");
  }

  get badgeSourceClass() {
    return "orbat-node__badge orbat-node__badge--source";
  }

  get hideNode() {
    return !!(this.node.hideNode ?? this.node.meta?.hideNode);
  }

  get isNodeHidden() {
    return !!this.hideNode;
  }

  get maxLabelWidth() {
    return this.hasIcon ? 80 : 96;
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

  get badgeMaskStyle() {
    return this.#maskStyle(this.badge, "--orbat-badge-mask");
  }

  get labelFontSize() {
    const raw = this.node.labelFontSize ?? this.node.label_font_size;
    const size = parseInt(raw, 10);
    return Number.isFinite(size) && size > 0 ? size : null;
  }

  get iconMaskStyle() {
    return this.#maskStyle(this.icon, "--orbat-icon-mask");
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

    if (this.forceSingleLineLabel) {
      declarations.push("white-space: nowrap");
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

  get uniformHoverPreviewEnabled() {
    if (!this.siteSettings?.orbat_uniform_hover_preview_enabled) {
      return false;
    }

    const uniformPluginEnabled = this.siteSettings?.discourse_project_uniform_enabled;
    const uniformPluginPublicEnabled =
      this.siteSettings?.discourse_project_uniform_public_enabled;

    return !!(uniformPluginEnabled && uniformPluginPublicEnabled);
  }

  get hasActiveUniformPreview() {
    const key = this.hoveredUniformPreviewKey;
    if (!key) {
      return false;
    }

    const status = this.#uniformPreviewStateForKey(key)?.status;
    return status === "loading" || status === "available";
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

  @action
  formatDisplayName(user) {
    if (!user) {
      return this.displayNameFallback;
    }

    const prefix = user.rankPrefix || user.rank_prefix;
    const username = user.username?.trim();

    let baseName = username;

    if (!baseName) {
      baseName = formatUsername(user.username)?.trim();
    }

    if (!baseName) {
      baseName = this.displayNameFallback;
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
  handleUserPointerDown(user) {
    this.#handleUserPressStart(user);
  }

  @action
  handleUserMouseDown(user) {
    this.#handleUserPressStart(user);
  }

  #handleUserPressStart(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key) {
      return;
    }

    this.#suppressFocusUniformPreviewForKey(key);
  }

  @action
  async handleUserHoverEnter(user, event) {
    if (!this.uniformHoverPreviewEnabled) {
      return;
    }

    const key = this.#uniformPreviewKeyForUser(user);
    if (!key) {
      return;
    }

    if (event?.type === "focusin" && this.#isUniformPreviewFocusSuppressedForKey(key)) {
      return;
    }

    this.hoveredUniformPreviewKey = key;
    await this.#ensureUniformPreviewLoaded(user, key);
  }

  @action
  handleUserHoverLeave(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key) {
      return;
    }

    this.#deactivateUniformPreviewKey(key);
  }

  @action
  isUniformPreviewVisible(user) {
    if (!this.uniformHoverPreviewEnabled) {
      return false;
    }

    const key = this.#uniformPreviewKeyForUser(user);
    if (!key || this.hoveredUniformPreviewKey !== key) {
      return false;
    }

    const status = this.#uniformPreviewStateForKey(key)?.status;
    return status === "loading" || status === "available";
  }

  @action
  isUniformPreviewLoaded(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key || this.hoveredUniformPreviewKey !== key) {
      return false;
    }

    return this.#uniformPreviewStateForKey(key)?.status === "available";
  }

  @action
  isUniformPreviewActive(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key || this.hoveredUniformPreviewKey !== key) {
      return false;
    }

    const status = this.#uniformPreviewStateForKey(key)?.status;
    return status === "loading" || status === "available";
  }

  @action
  uniformPreviewUrl(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key) {
      return null;
    }

    return this.#uniformPreviewStateForKey(key)?.url || null;
  }

  @action
  uniformPreviewDisplayName(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    const cachedDisplayName = this.#uniformPreviewStateForKey(key)?.displayName;
    if (cachedDisplayName) {
      return cachedDisplayName;
    }

    return this.formatDisplayName(user);
  }

  @action
  uniformPreviewAdditionalQualifications(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    const qualifications = this.#uniformPreviewStateForKey(key)?.additionalQualifications;
    return Array.isArray(qualifications) ? qualifications : [];
  }

  @action
  uniformPreviewAdditionalQualificationRows(user) {
    return this.#balancedUniformPreviewQualificationRows(
      user,
      this.uniformPreviewAdditionalQualifications(user)
    );
  }

  @action
  uniformPreviewHasAdditionalQualifications(user) {
    return this.uniformPreviewAdditionalQualifications(user).length > 0;
  }

  @action
  uniformPreviewQualificationsTitle(user) {
    return i18n(
      this.#isRecruitUser(user)
        ? "orbat.node.qualifications"
        : "orbat.node.additional_qualifications"
    );
  }

  @action
  uniformPreviewAlt(user) {
    return i18n("orbat.node.uniform_preview_alt", {
      username: this.uniformPreviewDisplayName(user),
    });
  }

  @action
  uniformPreviewClass(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    const placeAbove = !!this.#uniformPreviewLayoutForKey(key)?.placeAbove;
    const classes = ["orbat-node__uniform-preview"];
    if (placeAbove) {
      classes.push("orbat-node__uniform-preview--above");
    }
    return classes.join(" ");
  }

  @action
  uniformPreviewStyle(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    const layout = this.#uniformPreviewLayoutForKey(key);
    if (!layout) {
      return htmlSafe("visibility: hidden; opacity: 0;");
    }

    return htmlSafe(
      `--orbat-uniform-preview-left: ${Math.round(layout.left || 0)}px; --orbat-uniform-preview-top: ${Math.round(layout.top || 0)}px; --orbat-uniform-preview-arrow-left: ${Math.round(layout.arrowLeft || 0)}px; visibility: visible; opacity: 1;`
    );
  }

  @action
  uniformPreviewKey(user) {
    return this.#uniformPreviewKeyForUser(user);
  }

  @action
  registerUsersContainer(element) {
    this._usersContainerElement = element;
    this.#scheduleUniformPreviewPrefetch();
  }

  @action
  refreshUsersContainer(element) {
    if (element) {
      this._usersContainerElement = element;
    }
    this.#scheduleUniformPreviewPrefetch();
  }

  @action
  unregisterUsersContainer(element) {
    if (this._usersContainerElement === element) {
      this._usersContainerElement = null;
    }
    this._uniformPreviewPrefetchToken += 1;
    this.#cancelUniformPreviewPrefetch();
  }

  @action
  registerUniformPreviewElement(element, [user]) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key || !element) {
      return;
    }

    this._uniformPreviewElements.set(key, element);
    this.#connectUniformPreviewResizeObserver(key, element);
    this.#ensureUniformPreviewViewportListeners();
    this.#repositionUniformPreview(key, element);
    this.#scheduleUniformPreviewLayout(key, element);
  }

  @action
  updateUniformPreviewElement(element, [user]) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key || !element) {
      return;
    }

    this._uniformPreviewElements.set(key, element);
    this.#connectUniformPreviewResizeObserver(key, element);
    this.#ensureUniformPreviewViewportListeners();
    this.#repositionUniformPreview(key, element);
    this.#scheduleUniformPreviewLayout(key, element);
  }

  @action
  unregisterUniformPreviewElement(_element, [user]) {
    const key = this.#uniformPreviewKeyForUser(user);
    if (!key) {
      return;
    }

    this._uniformPreviewElements.delete(key);
    this.#disconnectUniformPreviewResizeObserver(key);
    this.#cancelUniformPreviewLayoutFrame(key);
    this.#clearUniformPreviewLayoutForKey(key);
    this.#teardownUniformPreviewViewportListeners();
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
    this.forceSingleLineLabel = false;
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
      if (this.forceSingleLineLabel) {
        this.forceSingleLineLabel = false;
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
      if (this.forceSingleLineLabel) {
        this.forceSingleLineLabel = false;
      }
      this._singleLineLabelAdjustment = false;
      return;
    }

    const fullWidth = this._measureTextWidth(content, computed);
    const fitsSingleLine = !!fullWidth && fullWidth <= this.maxLabelWidth + 2;
    if (this.forceSingleLineLabel !== fitsSingleLine) {
      this.forceSingleLineLabel = fitsSingleLine;
    }

    if (fitsSingleLine) {
      if (this.labelMeasuredWidth) {
        this.labelMeasuredWidth = null;
      }
      this._singleLineLabelAdjustment = true;
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

  _measureTextWidth(text, computedStyle) {
    const ctx = this._getMeasureContext();
    if (!ctx || !text) {
      return 0;
    }

    const transformed = this._applyTextTransform(text, computedStyle.textTransform);
    if (!transformed) {
      return 0;
    }

    ctx.font = computedStyle.font || `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    const letterSpacing = this._parseLetterSpacing(computedStyle.letterSpacing);
    const metrics = ctx.measureText(transformed);
    const baseWidth = metrics?.width || 0;
    const spacingWidth = letterSpacing * Math.max(transformed.length - 1, 0);
    return baseWidth + spacingWidth;
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

  #normalizeToggle(value, defaultValue) {
    if (value === undefined || value === null) {
      return defaultValue;
    }

    if (typeof value === "string") {
      const normalized = value.toLowerCase().trim();
      if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
      }
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return true;
      }
    }

    return !!value;
  }

  #maskStyle(source, variableName) {
    if (!source) {
      return null;
    }

    return htmlSafe(`${variableName}: url("${source}");`);
  }

  #isSvgAsset(value) {
    if (!value) {
      return false;
    }

    const raw = `${value}`.trim();
    if (!raw) {
      return false;
    }

    return /\.svg(\?.*)?(#.*)?$/i.test(raw);
  }

  #isPngAsset(value) {
    if (!value) {
      return false;
    }

    const raw = `${value}`.trim();
    if (!raw) {
      return false;
    }

    return /\.png(\?.*)?(#.*)?$/i.test(raw);
  }

  #normalizeExclusionList(value) {
    if (value === undefined) {
      return ["16th_air_assault.svg"];
    }

    if (value === null) {
      return [];
    }

    let list = [];

    if (Array.isArray(value)) {
      list = value;
    } else if (typeof value === "string") {
      list = value.split(/[,\n|]/);
    } else {
      return [];
    }

    return list
      .map((entry) => `${entry}`.trim())
      .filter(Boolean)
      .map((entry) => {
        const [path] = entry.split(/[?#]/, 1);
        const filename = path.split("/").pop();
        return filename ? filename.toLowerCase() : "";
      })
      .filter(Boolean);
  }

  #isTintExcluded(value, exclusions) {
    if (!value) {
      return false;
    }

    const raw = `${value}`.trim();
    if (!raw) {
      return false;
    }

    const [path] = raw.split(/[?#]/, 1);
    const filename = path.split("/").pop()?.toLowerCase();
    if (!filename) {
      return false;
    }

    const list = Array.isArray(exclusions) ? exclusions : [];
    return list.includes(filename);
  }

  #isRecruitUser(user) {
    const explicitValue = user?.isRecruit ?? user?.is_recruit;
    if (explicitValue !== undefined && explicitValue !== null) {
      return !!explicitValue;
    }

    const groups = Array.isArray(user?.groups) ? user.groups : [];
    return groups
      .map((groupName) =>
        `${groupName || ""}`
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      )
      .includes("recruit");
  }

  #deactivateUniformPreviewKey(key) {
    if (!key) {
      return;
    }

    if (this.hoveredUniformPreviewKey === key) {
      this.hoveredUniformPreviewKey = null;
    }

    this._uniformPreviewElements.delete(key);
    this.#disconnectUniformPreviewResizeObserver(key);
    this.#clearUniformPreviewLayoutForKey(key);
    this.#cancelUniformPreviewLayoutFrame(key);
    this.#teardownUniformPreviewViewportListeners();
  }

  #suppressFocusUniformPreviewForKey(key) {
    if (!key) {
      return;
    }

    this._uniformPreviewSuppressFocusUntilByKey.set(
      key,
      Date.now() + this.constructor.UNIFORM_PREVIEW_FOCUS_SUPPRESS_MS
    );
  }

  #isUniformPreviewFocusSuppressedForKey(key) {
    if (!key) {
      return false;
    }

    const suppressUntil = this._uniformPreviewSuppressFocusUntilByKey.get(key);
    if (!Number.isFinite(suppressUntil)) {
      return false;
    }

    if (Date.now() <= suppressUntil) {
      return true;
    }

    this._uniformPreviewSuppressFocusUntilByKey.delete(key);
    return false;
  }

  #uniformPreviewKeyForUser(user) {
    return `${user?.id ?? user?.username ?? user?.name ?? ""}`.trim();
  }

  #uniformPreviewStateForKey(key) {
    if (!key) {
      return null;
    }

    // Track service changes so tooltip state updates reactively.
    this.orbatUniformPreviewCache.revision;

    return this.orbatUniformPreviewCache.getState(key);
  }

  #uniformPreviewLayoutForKey(key) {
    if (!key) {
      return null;
    }

    return this.uniformPreviewLayoutCache[key] || null;
  }

  #setUniformPreviewState(key, state) {
    this.orbatUniformPreviewCache.setState(key, state);
  }

  #setUniformPreviewLayout(key, layout) {
    const previous = this.uniformPreviewLayoutCache[key];
    if (
      previous?.placeAbove === layout?.placeAbove &&
      previous?.left === layout?.left &&
      previous?.top === layout?.top &&
      previous?.arrowLeft === layout?.arrowLeft
    ) {
      return;
    }

    this.uniformPreviewLayoutCache = {
      ...this.uniformPreviewLayoutCache,
      [key]: layout,
    };
  }

  #clearUniformPreviewLayoutForKey(key) {
    if (!this.uniformPreviewLayoutCache[key]) {
      return;
    }

    const next = { ...this.uniformPreviewLayoutCache };
    delete next[key];
    this.uniformPreviewLayoutCache = next;
  }

  #clearUniformPreviewLayoutCache() {
    this.uniformPreviewLayoutCache = Object.create(null);
  }

  #cancelUniformPreviewLayoutFrame(key) {
    const frameId = this._uniformPreviewLayoutFrames.get(key);
    if (!frameId || typeof window === "undefined") {
      return;
    }

    window.cancelAnimationFrame?.(frameId);
    this._uniformPreviewLayoutFrames.delete(key);
  }

  #cancelAllUniformPreviewLayoutFrames() {
    if (typeof window === "undefined") {
      this._uniformPreviewLayoutFrames.clear();
      return;
    }

    this._uniformPreviewLayoutFrames.forEach((frameId) => {
      window.cancelAnimationFrame?.(frameId);
    });
    this._uniformPreviewLayoutFrames.clear();
  }

  #connectUniformPreviewResizeObserver(key, element) {
    if (typeof window === "undefined" || !window.ResizeObserver || !element) {
      return;
    }

    this.#disconnectUniformPreviewResizeObserver(key);

    const observer = new ResizeObserver(() => {
      this.#scheduleUniformPreviewLayout(key, element);
    });
    observer.observe(element);
    this._uniformPreviewResizeObservers.set(key, observer);
  }

  #disconnectUniformPreviewResizeObserver(key) {
    const observer = this._uniformPreviewResizeObservers.get(key);
    if (!observer) {
      return;
    }

    observer.disconnect();
    this._uniformPreviewResizeObservers.delete(key);
  }

  #disconnectAllUniformPreviewResizeObservers() {
    this._uniformPreviewResizeObservers.forEach((observer) => {
      observer.disconnect();
    });
    this._uniformPreviewResizeObservers.clear();
  }

  #scheduleUniformPreviewPrefetch() {
    if (!this.uniformHoverPreviewEnabled || typeof window === "undefined") {
      return;
    }

    this.#cancelUniformPreviewPrefetch();

    const token = ++this._uniformPreviewPrefetchToken;
    const run = () => {
      this._uniformPreviewPrefetchIdleId = null;
      this._uniformPreviewPrefetchTimeoutId = null;
      void this.#runUniformPreviewPrefetch(token);
    };

    if (typeof window.requestIdleCallback === "function") {
      this._uniformPreviewPrefetchIdleId = window.requestIdleCallback(run, {
        timeout: this.constructor.UNIFORM_PREVIEW_PREFETCH_IDLE_TIMEOUT_MS,
      });
    } else {
      this._uniformPreviewPrefetchTimeoutId = window.setTimeout(run, 120);
    }
  }

  #cancelUniformPreviewPrefetch() {
    if (typeof window === "undefined") {
      return;
    }

    if (
      this._uniformPreviewPrefetchIdleId !== null &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(this._uniformPreviewPrefetchIdleId);
    }

    if (this._uniformPreviewPrefetchTimeoutId !== null) {
      window.clearTimeout(this._uniformPreviewPrefetchTimeoutId);
    }

    this._uniformPreviewPrefetchIdleId = null;
    this._uniformPreviewPrefetchTimeoutId = null;
  }

  async #runUniformPreviewPrefetch(token) {
    if (token !== this._uniformPreviewPrefetchToken) {
      return;
    }

    const users = this.#prefetchCandidateUsers();
    if (!users.length) {
      return;
    }

    const queue = users
      .map((user) => {
        const key = this.#uniformPreviewKeyForUser(user);
        return key ? { user, key } : null;
      })
      .filter(Boolean);

    if (!queue.length) {
      return;
    }

    const workerCount = Math.min(
      this.constructor.UNIFORM_PREVIEW_PREFETCH_CONCURRENCY,
      queue.length
    );

    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length && token === this._uniformPreviewPrefetchToken) {
        const next = queue.shift();
        if (!next?.key) {
          continue;
        }

        await this.#ensureUniformPreviewLoaded(next.user, next.key);
      }
    });

    await Promise.all(workers);
  }

  #prefetchCandidateUsers() {
    const usersByKey = new Map();
    this.users.forEach((user) => {
      const key = this.#uniformPreviewKeyForUser(user);
      if (key && !usersByKey.has(key)) {
        usersByKey.set(key, user);
      }
    });

    if (!usersByKey.size) {
      return [];
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const visibleKeys = new Set();
    this._usersContainerElement
      ?.querySelectorAll?.(".orbat-node__user[data-uniform-preview-key]")
      ?.forEach((element) => {
        const key = element.dataset?.uniformPreviewKey;
        if (!key || !usersByKey.has(key)) {
          return;
        }

        const rect = element.getBoundingClientRect?.();
        if (!rect || !rect.width || !rect.height) {
          return;
        }

        const intersectsViewport =
          rect.bottom >= 0 &&
          rect.right >= 0 &&
          rect.top <= viewportHeight &&
          rect.left <= viewportWidth;

        if (intersectsViewport) {
          visibleKeys.add(key);
        }
      });

    const candidateKeys = visibleKeys.size
      ? Array.from(visibleKeys)
      : Array.from(usersByKey.keys());

    return candidateKeys
      .map((key) => {
        const cached = this.#uniformPreviewStateForKey(key);
        if (cached?.status === "available" || cached?.status === "loading") {
          return null;
        }

        if (
          cached?.status === "unavailable" &&
          Date.now() - (cached.checkedAt || 0) <
          this.constructor.UNAVAILABLE_PREVIEW_RECHECK_MS
        ) {
          return null;
        }

        return usersByKey.get(key) || null;
      })
      .filter(Boolean);
  }

  #ensureUniformPreviewViewportListeners() {
    if (typeof window === "undefined" || this._uniformPreviewViewportListening) {
      return;
    }

    window.addEventListener("resize", this._boundHandleUniformPreviewViewportChange);
    window.addEventListener(
      "scroll",
      this._boundHandleUniformPreviewViewportChange,
      true
    );
    this._uniformPreviewViewportListening = true;
  }

  #teardownUniformPreviewViewportListeners() {
    if (
      typeof window === "undefined" ||
      !this._uniformPreviewViewportListening ||
      this._uniformPreviewElements.size > 0
    ) {
      return;
    }

    window.removeEventListener(
      "resize",
      this._boundHandleUniformPreviewViewportChange
    );
    window.removeEventListener(
      "scroll",
      this._boundHandleUniformPreviewViewportChange,
      true
    );
    this._uniformPreviewViewportListening = false;
  }

  #handleUniformPreviewViewportChange() {
    this._uniformPreviewElements.forEach((element, key) => {
      this.#scheduleUniformPreviewLayout(key, element);
    });
  }

  #scheduleUniformPreviewLayout(key, element) {
    if (typeof window === "undefined") {
      return;
    }

    this.#cancelUniformPreviewLayoutFrame(key);

    const frameId = window.requestAnimationFrame?.(() => {
      this._uniformPreviewLayoutFrames.delete(key);
      this.#repositionUniformPreview(key, element);
    });

    if (frameId) {
      this._uniformPreviewLayoutFrames.set(key, frameId);
    } else {
      this.#repositionUniformPreview(key, element);
    }
  }

  #repositionUniformPreview(key, element) {
    if (!element?.isConnected || this.hoveredUniformPreviewKey !== key) {
      return;
    }

    const layout = this.#calculateUniformPreviewLayout(element);
    if (layout) {
      this.#setUniformPreviewLayout(key, layout);
    }
  }

  #calculateUniformPreviewLayout(element) {
    if (typeof window === "undefined" || !element?.isConnected) {
      return null;
    }

    const anchor = element.parentElement;
    const anchorRect = anchor?.getBoundingClientRect?.();
    const rect = element.getBoundingClientRect?.();
    if (!anchorRect || !rect || !rect.width || !rect.height) {
      return null;
    }

    const margin = this.constructor.UNIFORM_PREVIEW_MARGIN_PX;
    const gap = this.constructor.UNIFORM_PREVIEW_GAP_PX;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const defaultLeft = anchorCenterX - rect.width / 2;

    const belowTopByAnchor = anchorRect.bottom + gap;
    const defaultTopBelow = belowTopByAnchor;

    const aboveTopByAnchor = anchorRect.top - gap - rect.height;
    const defaultTopAbove = aboveTopByAnchor;

    const maxTop = Math.max(margin, viewportHeight - margin - rect.height);
    const overflowBelow = Math.max(
      0,
      defaultTopBelow + rect.height - (viewportHeight - margin)
    );
    const overflowAbove = Math.max(0, margin - defaultTopAbove);

    let placeAbove = false;
    if (overflowBelow === 0) {
      placeAbove = false;
    } else if (overflowAbove === 0) {
      placeAbove = true;
    } else {
      placeAbove = overflowAbove < overflowBelow;
    }

    const defaultTop = placeAbove ? defaultTopAbove : defaultTopBelow;

    const minLeft = margin;
    const maxLeft = Math.max(margin, viewportWidth - margin - rect.width);
    const minTop = margin;

    const targetLeft = Math.min(Math.max(defaultLeft, minLeft), maxLeft);
    const targetTop = Math.min(Math.max(defaultTop, minTop), maxTop);
    const arrowLeft = Math.min(
      Math.max(anchorCenterX - targetLeft, 12),
      Math.max(12, rect.width - 12)
    );

    return {
      placeAbove,
      left: targetLeft,
      top: targetTop,
      arrowLeft,
    };
  }

  #balancedUniformPreviewQualificationRows(user, qualifications) {
    const items = Array.isArray(qualifications) ? qualifications : [];
    const total = items.length;
    if (!total) {
      return [];
    }

    if (total === 1) {
      return [items];
    }

    const itemWidth = this.#uniformPreviewQualificationItemWidthPx(user);
    const columnGap = this.#uniformPreviewQualificationColumnGapPx(user);
    const availableWidth = this.#uniformPreviewQualificationAvailableWidthPx(user);
    const maxColumns = Math.max(
      1,
      Math.floor((availableWidth + columnGap) / (itemWidth + columnGap))
    );
    const rows = Math.max(1, Math.ceil(total / maxColumns));
    if (rows === 1) {
      return [items];
    }

    const baseCount = Math.floor(total / rows);
    const remainder = total % rows;
    const result = [];

    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      const count = baseCount + (row < remainder ? 1 : 0);
      result.push(items.slice(index, index + count));
      index += count;
    }

    return result;
  }

  #uniformPreviewQualificationItemWidthPx(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    const listElement = key
      ? this._uniformPreviewElements
          .get(key)
          ?.querySelector?.(".orbat-node__uniform-preview-quals")
      : null;

    if (typeof window !== "undefined" && listElement) {
      const styles = window.getComputedStyle(listElement);
      const cssValue = Number.parseFloat(
        styles.getPropertyValue("--orbat-uniform-preview-qual-item-width")
      );
      if (Number.isFinite(cssValue) && cssValue > 0) {
        return cssValue;
      }
    }

    return this.constructor.UNIFORM_PREVIEW_QUAL_ITEM_WIDTH_PX;
  }

  #uniformPreviewQualificationColumnGapPx(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    const listElement = key
      ? this._uniformPreviewElements
          .get(key)
          ?.querySelector?.(".orbat-node__uniform-preview-quals")
      : null;

    if (typeof window !== "undefined" && listElement) {
      const styles = window.getComputedStyle(listElement);
      const cssVariable = Number.parseFloat(
        styles.getPropertyValue("--orbat-uniform-preview-qual-gap")
      );
      if (Number.isFinite(cssVariable) && cssVariable >= 0) {
        return cssVariable;
      }

      const firstRow = listElement.querySelector?.(".orbat-node__uniform-preview-quals-row");
      if (firstRow) {
        const rowGap = Number.parseFloat(window.getComputedStyle(firstRow).columnGap);
        if (Number.isFinite(rowGap) && rowGap >= 0) {
          return rowGap;
        }
      }
    }

    return this.constructor.UNIFORM_PREVIEW_QUAL_DEFAULT_GAP_PX;
  }

  #uniformPreviewQualificationAvailableWidthPx(user) {
    const key = this.#uniformPreviewKeyForUser(user);
    const previewElement = key ? this._uniformPreviewElements.get(key) : null;
    const listElement = previewElement?.querySelector?.(".orbat-node__uniform-preview-quals");
    const measuredWidth = listElement?.clientWidth || previewElement?.clientWidth;
    if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
      return measuredWidth;
    }

    if (typeof window !== "undefined") {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      if (viewportWidth > 0) {
        const estimated =
          Math.min(
            this.constructor.UNIFORM_PREVIEW_DEFAULT_WIDTH_PX,
            viewportWidth * 0.6
          ) - this.constructor.UNIFORM_PREVIEW_DEFAULT_HORIZONTAL_PADDING_PX;

        if (estimated > 0) {
          return estimated;
        }
      }
    }

    return this.constructor.UNIFORM_PREVIEW_QUAL_ITEM_WIDTH_PX;
  }

  #uniformCacheKeyForUser(user) {
    const raw = user?.uniformCacheKey ?? user?.uniform_cache_key;
    const value = `${raw || ""}`.trim();
    return value || null;
  }

  #uniformPngUrlForUser(user) {
    const normalized = `${user?.username || ""}`.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const baseUrl = getURL(`/uniform/${encodeURIComponent(normalized)}.png`);
    const cacheKey = this.#uniformCacheKeyForUser(user);
    if (!cacheKey) {
      return baseUrl;
    }

    return `${baseUrl}?v=${encodeURIComponent(cacheKey)}`;
  }

  #userBadgesUrlForUser(user) {
    const normalized = `${user?.username || ""}`.trim();
    if (!normalized) {
      return null;
    }

    const baseUrl = getURL(`/user-badges/${encodeURIComponent(normalized)}.json`);
    const cacheKey = this.#uniformCacheKeyForUser(user);
    if (!cacheKey) {
      return baseUrl;
    }

    return `${baseUrl}?orbat_uniform_key=${encodeURIComponent(cacheKey)}`;
  }

  async #ensureUniformPreviewLoaded(user, key) {
    const cached = this.#uniformPreviewStateForKey(key);
    if (cached?.status === "available") {
      return;
    }

    if (
      cached?.status === "unavailable" &&
      Date.now() - (cached.checkedAt || 0) < this.constructor.UNAVAILABLE_PREVIEW_RECHECK_MS
    ) {
      return;
    }

    const inflight = this.orbatUniformPreviewCache.getInflight(key);
    if (inflight) {
      await inflight;
      return;
    }

    const loadPromise = this.#loadUniformPreview(user, key);
    this.orbatUniformPreviewCache.setInflight(key, loadPromise);
    try {
      await loadPromise;
    } finally {
      this.orbatUniformPreviewCache.clearInflight(key, loadPromise);
    }
  }

  async #loadUniformPreview(user, key) {
    const displayName = this.formatDisplayName(user);
    this.#setUniformPreviewState(key, {
      status: "loading",
      url: null,
      displayName,
      additionalQualifications: [],
      checkedAt: Date.now(),
    });

    const username = user?.username?.trim();
    if (!username) {
      this.#setUniformPreviewState(key, {
        status: "unavailable",
        url: null,
        displayName,
        additionalQualifications: [],
        checkedAt: Date.now(),
      });
      return;
    }

    const uniformUrl = this.#uniformPngUrlForUser(user);
    if (!uniformUrl) {
      this.#setUniformPreviewState(key, {
        status: "unavailable",
        url: null,
        displayName,
        additionalQualifications: [],
        checkedAt: Date.now(),
      });
      return;
    }

    const [uniformPreview, additionalQualifications] = await Promise.all([
      this.#fetchUniformPng(uniformUrl),
      this.#fetchAdditionalQualifications(user),
    ]);

    if (!uniformPreview?.available || !uniformPreview.url) {
      this.#setUniformPreviewState(key, {
        status: "unavailable",
        url: null,
        displayName,
        additionalQualifications: [],
        checkedAt: Date.now(),
      });
      return;
    }

    await Promise.all([
      this.#preloadImageUrl(uniformPreview.url),
      this.#preloadAdditionalQualificationImages(additionalQualifications),
    ]);

    this.#setUniformPreviewState(key, {
      status: "available",
      url: uniformPreview.url,
      displayName,
      additionalQualifications,
      checkedAt: Date.now(),
    });
  }

  async #fetchUniformPng(url) {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "image/png" },
      });

      if (!response.ok) {
        return { available: false, url: null };
      }

      const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
      const disposition = `${response.headers.get("content-disposition") || ""}`.toLowerCase();
      if (disposition.includes("uniform-missing-")) {
        return { available: false, url: null };
      }

      if (!contentType.includes("image/png") && !disposition.includes(".png")) {
        return { available: false, url: null };
      }

      const blob = await response.blob();
      if (!blob || blob.size <= 0) {
        return { available: false, url: null };
      }

      return {
        available: true,
        url: URL.createObjectURL(blob),
      };
    } catch {
      return { available: false, url: null };
    }
  }

  #projectUniformDataModule() {
    if (
      Object.prototype.hasOwnProperty.call(
        this.constructor,
        "_projectUniformDataModule"
      )
    ) {
      return this.constructor._projectUniformDataModule;
    }

    let module = null;
    if (typeof globalThis !== "undefined") {
      const loader = globalThis.requirejs || globalThis.require;
      if (typeof loader === "function") {
        try {
          module = loader(PROJECT_UNIFORM_UNIFORM_DATA_MODULE_ID);
        } catch {
          module = null;
        }
      }
    }

    this.constructor._projectUniformDataModule = module || null;
    return this.constructor._projectUniformDataModule;
  }

  #resolveAdditionalQualificationsFromProjectUniform(user, userBadges, idToBadge) {
    try {
      const uniformData = this.#projectUniformDataModule();
      const qualificationsByNameLC = uniformData?.qualificationsByNameLC;
      const ranks = Array.isArray(uniformData?.ranks) ? uniformData.ranks : [];
      if (!qualificationsByNameLC || !ranks.length) {
        return null;
      }

      const toLC = (value) => `${value || ""}`.toLowerCase();
      const highestIn = (order, have) => {
        for (let index = order.length - 1; index >= 0; index -= 1) {
          const candidate = order[index];
          if (have.has(candidate)) {
            return candidate;
          }
        }

        return null;
      };

      const leadershipAliasMapLC = Object.fromEntries(
        Object.entries(uniformData?.leadershipQualificationAliases || {}).map(
          ([alias, canonical]) => [toLC(alias), toLC(canonical)]
        )
      );
      const canonicalLeadershipName = (value) => leadershipAliasMapLC[value] || value;
      const leadershipOrderLC = Array.from(
        new Set(
          (uniformData?.leadershipQualificationsOrder || [])
            .map((name) => canonicalLeadershipName(toLC(name)))
            .filter(Boolean)
        )
      );
      const marksmanshipOrderLC = (uniformData?.marksmanshipQualificationsOrder || []).map(
        toLC
      );
      const pilotOrderLC = (uniformData?.pilotQualificationsOrder || []).map(toLC);
      const ctmOrderLC = (uniformData?.ctmQualificationsOrder || []).map(toLC);

      const leadershipOrderSetLC = new Set(leadershipOrderLC);
      const marksmanshipOrderSetLC = new Set(marksmanshipOrderLC);
      const pilotOrderSetLC = new Set(pilotOrderLC);
      const ctmOrderSetLC = new Set(ctmOrderLC);

      const groupNameSetLC = new Set(
        (Array.isArray(user?.groups) ? user.groups : [])
          .map((groupName) => toLC(`${groupName || ""}`.trim()))
          .filter(Boolean)
      );
      const is16CSMR = ["16csmr", "16csmr_ic", "16csmr_2ic"].some((name) =>
        groupNameSetLC.has(name)
      );
      const highestRank =
        ranks.find((rank) => groupNameSetLC.has(toLC(rank?.name))) || null;

      const allQualifications = [];
      const seenQualifications = new Set();
      (Array.isArray(userBadges) ? userBadges : []).forEach((entry) => {
        const badge = idToBadge.get(entry?.badge_id);
        if (!badge?.name) {
          return;
        }

        const qualification = qualificationsByNameLC[toLC(badge.name)];
        if (!qualification || seenQualifications.has(qualification.name)) {
          return;
        }

        seenQualifications.add(qualification.name);
        allQualifications.push({ qual: qualification, label: badge.name });
      });

      if (toLC(highestRank?.name) === "recruit") {
        return allQualifications.map((entry) => ({
          name: entry?.label || entry?.qual?.name || "",
          imageUrl: entry?.qual?.tooltipImage || entry?.qual?.imageKey || null,
        }));
      }

      const badgeNames = (Array.isArray(userBadges) ? userBadges : [])
        .map((entry) => idToBadge.get(entry?.badge_id)?.name)
        .filter(Boolean);
      const badgeNameSetLC = new Set(badgeNames.map(toLC));
      const leadershipBadgeNameSetLC = new Set(
        [...badgeNameSetLC].map((name) => canonicalLeadershipName(name))
      );

      const highestLeadershipLC = highestIn(leadershipOrderLC, leadershipBadgeNameSetLC);
      const highestMarksmanshipLC = highestIn(marksmanshipOrderLC, badgeNameSetLC);
      const highestPilotLC = highestIn(pilotOrderLC, badgeNameSetLC);
      const highestCtmLC = highestIn(ctmOrderLC, badgeNameSetLC);
      const highestRankLC = toLC(highestRank?.name);
      const cmtKeyLC = toLC("CMT");
      const hasLegacyCmt = badgeNameSetLC.has(cmtKeyLC);

      const qualsToRender = [];
      (Array.isArray(userBadges) ? userBadges : []).forEach((entry) => {
        const badge = idToBadge.get(entry?.badge_id);
        if (!badge?.name) {
          return;
        }

        const nameLC = toLC(badge.name);
        const canonicalNameLC = canonicalLeadershipName(nameLC);
        if (is16CSMR && marksmanshipOrderSetLC.has(nameLC)) {
          return;
        }

        const qualification = qualificationsByNameLC[nameLC];
        const isLeader = leadershipOrderSetLC.has(canonicalNameLC);
        const isMarks = marksmanshipOrderSetLC.has(nameLC);
        const isPilot = pilotOrderSetLC.has(nameLC);
        const isCtm = ctmOrderSetLC.has(nameLC);

        if (isLeader && highestRank?.service === "RAF") {
          return;
        }
        if (isCtm && hasLegacyCmt) {
          return;
        }

        if (
          (isLeader && canonicalNameLC !== highestLeadershipLC) ||
          (isMarks && nameLC !== highestMarksmanshipLC) ||
          (isPilot && nameLC !== highestPilotLC) ||
          (isCtm && nameLC !== highestCtmLC)
        ) {
          return;
        }

        const restrictedRankSetLC = new Set(
          (qualification?.restrictedRanks || []).map(toLC)
        );
        if (qualification?.imageKey && !restrictedRankSetLC.has(highestRankLC)) {
          if (nameLC === cmtKeyLC && !is16CSMR) {
            return;
          }
          qualsToRender.push(qualification);
        }
      });

      const renderedQualNames = new Set(
        qualsToRender.map((qualification) => qualification?.name).filter(Boolean)
      );
      const marksmanshipNames = allQualifications
        .map((entry) => toLC(entry?.qual?.name))
        .filter((name) => name && marksmanshipOrderSetLC.has(name));
      const highestMarksmanshipAdditionalLC = marksmanshipNames.length
        ? highestIn(marksmanshipOrderLC, new Set(marksmanshipNames))
        : null;

      const filterAdditionalQualificationOverrides = (entries) => {
        if (!entries.length) {
          return [];
        }

        const byName = new Map(entries.map((entry) => [entry?.qual?.name, entry]));
        if (byName.has("Advanced AT")) {
          byName.delete("Basic AT");
        }
        if (byName.has("Advanced Signaller")) {
          byName.delete("Basic Signals");
        }

        const filtered = Array.from(byName.values());
        const commandNames = filtered
          .map((entry) => canonicalLeadershipName(toLC(entry?.qual?.name)))
          .filter((name) => name && leadershipOrderSetLC.has(name));
        const highestCommandLC = commandNames.length
          ? highestIn(leadershipOrderLC, new Set(commandNames))
          : null;

        if (!highestCommandLC) {
          return filtered;
        }

        return filtered.filter((entry) => {
          const nameLC = canonicalLeadershipName(toLC(entry?.qual?.name));
          if (!leadershipOrderSetLC.has(nameLC)) {
            return true;
          }
          return nameLC === highestCommandLC;
        });
      };

      return filterAdditionalQualificationOverrides(
        allQualifications
          .filter((entry) => !renderedQualNames.has(entry?.qual?.name))
          .filter((entry) => {
            const nameLC = toLC(entry?.qual?.name);
            if (!nameLC || !marksmanshipOrderSetLC.has(nameLC)) {
              return true;
            }
            return highestMarksmanshipAdditionalLC
              ? nameLC === highestMarksmanshipAdditionalLC
              : true;
          })
      ).map((entry) => ({
        name: entry?.label || entry?.qual?.name || "",
        imageUrl: entry?.qual?.tooltipImage || entry?.qual?.imageKey || null,
      }));
    } catch {
      return null;
    }
  }

  #fallbackAdditionalQualifications(userBadges, idToBadge) {
    const matched = [];

    (Array.isArray(userBadges) ? userBadges : []).forEach((entry) => {
      const badge = idToBadge.get(entry?.badge_id);
      const name = `${badge?.name || ""}`.trim();
      if (!name) {
        return;
      }

      const order = ADDITIONAL_QUALIFICATIONS_ORDER_MAP.get(name.toLowerCase());
      if (!Number.isFinite(order)) {
        return;
      }

      matched.push({
        name,
        order,
        imageUrl: null,
      });
    });

    return matched;
  }

  #formatAdditionalQualificationEntries(entries) {
    const matched = [];
    const seen = new Set();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const rawName = `${entry?.name || ""}`.trim();
      if (!rawName) {
        return;
      }

      const lowerName = rawName.toLowerCase();
      if (seen.has(lowerName)) {
        return;
      }
      seen.add(lowerName);

      const mapOrder = ADDITIONAL_QUALIFICATIONS_ORDER_MAP.get(lowerName);
      const order =
        Number.isFinite(entry?.order) && entry.order >= 0
          ? entry.order
          : Number.isFinite(mapOrder)
            ? mapOrder
            : Number.MAX_SAFE_INTEGER;
      const name = Number.isFinite(mapOrder)
        ? ADDITIONAL_QUALIFICATIONS_ORDER[mapOrder] || rawName
        : rawName;

      let imageUrl = `${entry?.imageUrl || ""}`.trim();
      if (!imageUrl) {
        const imageFile = ADDITIONAL_QUALIFICATIONS_IMAGE_MAP[lowerName] || null;
        imageUrl = imageFile
          ? getURLWithCDN(
            `/plugins/discourse-project-uniform/images/tooltip_qualificationimages/${imageFile}`
          )
          : "";
      }

      matched.push({
        name,
        order,
        imageUrl: imageUrl || null,
      });
    });

    matched.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return matched.map((entry) => ({
      name: entry.name,
      imageUrl: entry.imageUrl,
    }));
  }

  async #fetchAdditionalQualifications(user) {
    const requestUrl = this.#userBadgesUrlForUser(user);
    if (!requestUrl) {
      return [];
    }

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      const badges = Array.isArray(payload?.badges) ? payload.badges : [];
      const userBadges = Array.isArray(payload?.user_badges) ? payload.user_badges : [];
      if (!badges.length || !userBadges.length) {
        return [];
      }

      const idToBadge = new Map(
        badges
          .filter((badge) => badge?.id && badge?.name)
          .map((badge) => [badge.id, badge])
      );

      const projectUniformEntries =
        this.#resolveAdditionalQualificationsFromProjectUniform(
          user,
          userBadges,
          idToBadge
        );
      if (projectUniformEntries !== null) {
        return this.#formatAdditionalQualificationEntries(projectUniformEntries);
      }

      return this.#formatAdditionalQualificationEntries(
        this.#fallbackAdditionalQualifications(userBadges, idToBadge)
      );
    } catch {
      return [];
    }
  }

  async #preloadAdditionalQualificationImages(qualifications) {
    const urls = (Array.isArray(qualifications) ? qualifications : [])
      .map((qualification) => qualification?.imageUrl)
      .filter(Boolean);

    if (!urls.length) {
      return;
    }

    await Promise.all(urls.map((url) => this.#preloadImageUrl(url)));
  }

  async #preloadImageUrl(url) {
    if (!url || typeof Image === "undefined") {
      return;
    }

    await new Promise((resolve) => {
      const image = new Image();
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        image.onload = null;
        image.onerror = null;
        resolve();
      };

      image.onload = finish;
      image.onerror = finish;
      image.src = url;

      // Avoid hanging forever on stalled image requests.
      window.setTimeout(finish, 5000);
    });
  }
}
