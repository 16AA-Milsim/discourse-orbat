import { tracked } from "@glimmer/tracking";
import Controller from "@ember/controller";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { scheduleOnce } from "@ember/runloop";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";
import { service } from "@ember/service";

/**
 * @class AdminPluginsOrbatController
 */
export default class AdminPluginsOrbatController extends Controller {
  @service siteSettings;

  @tracked data = { configuration: "" };
  @tracked tree = null;
  @tracked notice = null;
  @tracked previewState = "idle";
  @tracked disallow = false;
  @tracked isLoaded = false;
  @tracked orbatEnabled = false;
  @tracked orbatAdminOnly = false;
  @tracked orbatExclusiveGroups = "";
  @tracked orbatExclusiveGroupsPassthrough = "";
  @tracked updatingEnabled = false;
  @tracked updatingAdminOnly = false;
  @tracked updatingExclusiveGroups = false;
  @tracked updatingExclusiveGroupsPassthrough = false;
  @tracked validationWarnings = [];

  formApi = null;
  _pendingFormSync = false;
  _exclusiveGroupsSaved = "";
  _exclusiveGroupsPassthroughSaved = "";

  setup(model) {
    if (model?.disallow) {
      this.disallow = true;
      this.isLoaded = false;
      return;
    }

    this.disallow = false;
    this.isLoaded = false;
    this.orbatEnabled = !!this.siteSettings?.orbat_enabled;
    this.orbatAdminOnly = !!this.siteSettings?.orbat_admin_only;
    const exclusiveGroupsSetting = this.#normalizeExclusiveGroupsSetting(
      this.siteSettings?.orbat_exclusive_groups
    );
    const exclusiveGroupsDisplay = this.#formatExclusiveGroupsDisplay(
      exclusiveGroupsSetting
    );
    this.orbatExclusiveGroups = exclusiveGroupsDisplay;
    this._exclusiveGroupsSaved = exclusiveGroupsSetting;
    const exclusiveGroupsPassthroughSetting =
      this.#normalizeExclusiveGroupsSetting(
        this.siteSettings?.orbat_exclusive_groups_passthrough
      );
    const exclusiveGroupsPassthroughDisplay = this.#formatExclusiveGroupsDisplay(
      exclusiveGroupsPassthroughSetting
    );
    this.orbatExclusiveGroupsPassthrough = exclusiveGroupsPassthroughDisplay;
    this._exclusiveGroupsPassthroughSaved = exclusiveGroupsPassthroughSetting;

    let configuration = this.#prepareConfiguration(model?.configuration);

    if (!configuration && this.siteSettings?.orbat_json) {
      configuration = this.#prepareConfiguration(this.siteSettings.orbat_json);
    }

    this.data = {
      configuration,
    };
    this.tree = model?.tree || null;
    this.notice = null;
    this.previewState = "idle";
    this.isLoaded = true;
    this.#updateValidationWarnings(configuration);
    this._queueFormSync();
    this.#loadInitialPreview(configuration, this.tree);
  }

  get previewErrors() {
    return this.tree?.errors || [];
  }

  get allWarnings() {
    const warnings = new Set();
    (this.validationWarnings || []).forEach((warning) => {
      if (warning) {
        warnings.add(warning);
      }
    });
    (this.previewErrors || []).forEach((warning) => {
      if (warning) {
        warnings.add(warning);
      }
    });
    return Array.from(warnings);
  }

  get previewTree() {
    if (!this.tree) {
      return null;
    }

    if (!this.tree.errors || this.tree.errors.length === 0) {
      return this.tree;
    }

    return {
      ...this.tree,
      errors: [],
    };
  }

  get adminOnlyDisabled() {
    return !this.orbatEnabled || this.updatingAdminOnly;
  }

  get exclusiveGroupsSaveDisabled() {
    return (
      this.updatingExclusiveGroups ||
      this.#normalizeExclusiveGroupsSetting(this.orbatExclusiveGroups) ===
        this._exclusiveGroupsSaved
    );
  }

  get exclusiveGroupsPassthroughSaveDisabled() {
    return (
      this.updatingExclusiveGroupsPassthrough ||
      this.#normalizeExclusiveGroupsSetting(
        this.orbatExclusiveGroupsPassthrough
      ) === this._exclusiveGroupsPassthroughSaved
    );
  }

  @action
  registerFormApi(api) {
    this.formApi = api;
    this._queueFormSync();
  }

  @action
  validateDraft(draftData, helpers) {
    helpers.removeError("configuration");

    const raw = draftData?.configuration;
    if (!raw || raw.trim().length === 0) {
      this.validationWarnings = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.validationWarnings = this.#buildValidationWarnings(parsed);
    } catch (error) {
      this.validationWarnings = [];
      helpers.addError("configuration", {
        title: i18n("orbat_admin.editor.heading"),
        message: error.message,
      });
    }
  }

  @action
  async save(draftData) {
    const configuration = draftData?.configuration ?? "";

    if (!this.ensureConfigurationValid(configuration)) {
      return;
    }

    try {
      await ajax("/admin/site_settings/orbat_json", {
        type: "PUT",
        data: { orbat_json: configuration },
      });

      const tree = await ajax("/admin/plugins/orbat/preview", {
        type: "POST",
        data: { configuration },
      });

      this.data = { configuration };
      this.tree = tree;
      this.notice = i18n("orbat_admin.notices.saved");
      this.previewState = "idle";
      this._queueFormSync();
    } catch (error) {
      popupAjaxError(error);
    }
  }

  @action
  async updateOrbatEnabled(event) {
    if (this.updatingEnabled) {
      return;
    }

    const checked = event?.target?.checked;
    if (checked === undefined || checked === this.orbatEnabled) {
      return;
    }

    this.updatingEnabled = true;
    const previousValue = this.orbatEnabled;
    this.orbatEnabled = checked;

    try {
      await this.#updateBooleanSetting("orbat_enabled", checked);
      if (this.siteSettings) {
        this.siteSettings.orbat_enabled = checked;
      }
    } catch (error) {
      this.orbatEnabled = previousValue;
      if (this.siteSettings) {
        this.siteSettings.orbat_enabled = previousValue;
      }
      popupAjaxError(error);
    } finally {
      this.updatingEnabled = false;
    }
  }

  @action
  async updateOrbatAdminOnly(event) {
    if (this.updatingAdminOnly) {
      return;
    }

    const checked = event?.target?.checked;
    if (checked === undefined || checked === this.orbatAdminOnly) {
      return;
    }

    this.updatingAdminOnly = true;
    const previousValue = this.orbatAdminOnly;
    this.orbatAdminOnly = checked;

    try {
      await this.#updateBooleanSetting("orbat_admin_only", checked);
      if (this.siteSettings) {
        this.siteSettings.orbat_admin_only = checked;
      }
    } catch (error) {
      this.orbatAdminOnly = previousValue;
      if (this.siteSettings) {
        this.siteSettings.orbat_admin_only = previousValue;
      }
      popupAjaxError(error);
    } finally {
      this.updatingAdminOnly = false;
    }
  }

  @action
  updateExclusiveGroupsInput(event) {
    this.orbatExclusiveGroups = event?.target?.value ?? "";
  }

  @action
  async saveExclusiveGroups(event) {
    event?.preventDefault();
    if (this.exclusiveGroupsSaveDisabled) {
      return;
    }

    this.updatingExclusiveGroups = true;
    const normalizedSetting = this.#normalizeExclusiveGroupsSetting(
      this.orbatExclusiveGroups
    );
    const normalizedDisplay = this.#formatExclusiveGroupsDisplay(
      this.orbatExclusiveGroups
    );

    try {
      await this.#updateTextSetting(
        "orbat_exclusive_groups",
        normalizedSetting
      );
      this.orbatExclusiveGroups = normalizedDisplay;
      this._exclusiveGroupsSaved = normalizedSetting;
      if (this.siteSettings) {
        this.siteSettings.orbat_exclusive_groups = normalizedSetting;
      }
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.updatingExclusiveGroups = false;
    }
  }

  @action
  updateExclusiveGroupsPassthroughInput(event) {
    this.orbatExclusiveGroupsPassthrough = event?.target?.value ?? "";
  }

  @action
  async saveExclusiveGroupsPassthrough(event) {
    event?.preventDefault();
    if (this.exclusiveGroupsPassthroughSaveDisabled) {
      return;
    }

    this.updatingExclusiveGroupsPassthrough = true;
    const normalizedSetting = this.#normalizeExclusiveGroupsSetting(
      this.orbatExclusiveGroupsPassthrough
    );
    const normalizedDisplay = this.#formatExclusiveGroupsDisplay(
      this.orbatExclusiveGroupsPassthrough
    );

    try {
      await this.#updateTextSetting(
        "orbat_exclusive_groups_passthrough",
        normalizedSetting
      );
      this.orbatExclusiveGroupsPassthrough = normalizedDisplay;
      this._exclusiveGroupsPassthroughSaved = normalizedSetting;
      if (this.siteSettings) {
        this.siteSettings.orbat_exclusive_groups_passthrough =
          normalizedSetting;
      }
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.updatingExclusiveGroupsPassthrough = false;
    }
  }

  @action
  async generatePreview(event) {
    event?.preventDefault();

    if (!this.formApi) {
      return;
    }

    const configuration = this.formApi.get("configuration") ?? "";
    if (!this.ensureConfigurationValid(configuration)) {
      return;
    }

    await this.#fetchPreview(configuration, {
      setPreviewState: true,
      notifyOnError: true,
    });
  }

  @action
  async restoreDefault(event) {
    event?.preventDefault();

    try {
      const model = await ajax("/admin/plugins/orbat/restore", {
        type: "POST",
      });

      this.setup(model);
      this.notice = i18n("orbat_admin.notices.restored");
    } catch (error) {
      popupAjaxError(error);
    }
  }

  @action
  ensureConfigurationValid(configuration) {
    if (!this.formApi) {
      return true;
    }

    this.formApi.removeError("configuration");

    const trimmed = configuration?.trim();
    if (!trimmed || trimmed.length === 0) {
      return true;
    }

    try {
      JSON.parse(configuration);
      return true;
    } catch (error) {
      this.formApi.addError("configuration", {
        title: i18n("orbat_admin.editor.heading"),
        message: error.message,
      });
      return false;
    }
  }

  _queueFormSync() {
    if (!this.formApi || !this.data) {
      return;
    }

    if (this._pendingFormSync) {
      return;
    }

    this._pendingFormSync = true;
    scheduleOnce("afterRender", this, this._flushFormSync);
  }

  _flushFormSync() {
    this._pendingFormSync = false;
    if (!this.formApi || !this.data) {
      return;
    }

    const payload = { ...this.data };
    this.formApi.setProperties?.(payload);
  }

  async #updateBooleanSetting(setting, value) {
    await ajax(`/admin/site_settings/${setting}`, {
      type: "PUT",
      data: {
        [setting]: value ? "true" : "false",
      },
    });
  }

  async #updateTextSetting(setting, value) {
    await ajax(`/admin/site_settings/${setting}`, {
      type: "PUT",
      data: {
        [setting]: value,
      },
    });
  }

  async #loadInitialPreview(configuration, existingTree) {
    const trimmed = configuration?.trim();
    if (!trimmed) {
      return;
    }

    if (existingTree?.errors?.length) {
      return;
    }

    await this.#fetchPreview(configuration, {
      setPreviewState: false,
      notifyOnError: false,
    });
  }

  async #fetchPreview(
    configuration,
    { setPreviewState = false, notifyOnError = true } = {}
  ) {
    if (setPreviewState) {
      this.previewState = "loading";
      this.notice = null;
    }

    try {
      this.tree = await ajax("/admin/plugins/orbat/preview", {
        type: "POST",
        data: { configuration },
      });
    } catch (error) {
      if (setPreviewState) {
        this.previewState = "error";
      }
      if (notifyOnError) {
        popupAjaxError(error);
      }
      return;
    } finally {
      if (setPreviewState && this.previewState === "loading") {
        this.previewState = "idle";
      }
    }
  }

  #prepareConfiguration(raw) {
    if (!raw) {
      return "";
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return "";
      }

      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch (error) {
        return raw;
      }
    }

    try {
      return JSON.stringify(raw, null, 2);
    } catch (error) {
      return "";
    }
  }

  #normalizeExclusiveGroupList(raw) {
    if (!raw) {
      return [];
    }

    let list = [];

    if (Array.isArray(raw)) {
      list = raw;
    } else if (typeof raw === "string") {
      list = raw.split(/[|\n,]/);
    } else {
      return [];
    }

    return list.map((value) => `${value}`.trim()).filter(Boolean);
  }

  #normalizeExclusiveGroupsSetting(raw) {
    return this.#normalizeExclusiveGroupList(raw).join("|");
  }

  #formatExclusiveGroupsDisplay(raw) {
    return this.#normalizeExclusiveGroupList(raw).join(", ");
  }

  #updateValidationWarnings(raw) {
    if (!raw) {
      this.validationWarnings = [];
      return;
    }

    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      this.validationWarnings = this.#buildValidationWarnings(parsed);
    } catch (error) {
      this.validationWarnings = [];
    }
  }

  #buildValidationWarnings(config) {
    const warnings = [];
    if (!config || typeof config !== "object") {
      return warnings;
    }

    const nodes = config.nodes;
    const codeSet = new Set();
    const idSet = new Set();

    if (!Array.isArray(nodes)) {
      warnings.push(i18n("orbat_admin.validation.missing_nodes"));
    } else {
      nodes.forEach((node) =>
        this.#scanNode(node, warnings, codeSet, idSet)
      );
    }

    const rankPriority = Array.isArray(config.rankPriority)
      ? config.rankPriority
      : [];
    const rankDuplicates = this.#findDuplicates(rankPriority);
    if (rankDuplicates.length) {
      warnings.push(
        i18n("orbat_admin.validation.rank_priority_duplicates", {
          values: rankDuplicates.join(", "),
        })
      );
    }

    const rootSections = config.display?.rootSections;
    if (Array.isArray(rootSections)) {
      rootSections.forEach((section) => {
        const prefixes = []
          .concat(section?.prefixes || [])
          .concat(section?.prefix || [])
          .concat(section?.codes || [])
          .map((value) => `${value}`.trim())
          .filter(Boolean);

        if (!prefixes.length) {
          warnings.push(i18n("orbat_admin.validation.empty_root_section"));
        }
      });
    }

    return warnings;
  }

  #scanNode(node, warnings, codeSet, idSet) {
    if (!node || typeof node !== "object") {
      return;
    }

    const label = `${node.label || ""}`.trim();
    const code = `${node.code || ""}`.trim();
    const id = `${node.id || ""}`.trim();
    const labelForWarning =
      label || code || id || i18n("orbat_admin.validation.unnamed_node");

    if (!label) {
      warnings.push(
        i18n("orbat_admin.validation.missing_label", {
          code: code || id || labelForWarning,
        })
      );
    }

    if (code) {
      if (codeSet.has(code)) {
        warnings.push(
          i18n("orbat_admin.validation.duplicate_code", { code })
        );
      }
      codeSet.add(code);
    }

    if (id) {
      if (idSet.has(id)) {
        warnings.push(i18n("orbat_admin.validation.duplicate_id", { id }));
      }
      idSet.add(id);
    }

    const select = node.select || {};
    if (select && typeof select === "object") {
      const entries = []
        .concat(select.any || [])
        .concat(select.all || []);
      const hasEmpty = entries.some((value) => !`${value}`.trim());
      if (hasEmpty) {
        warnings.push(
          i18n("orbat_admin.validation.empty_select", {
            label: labelForWarning,
          })
        );
      }

      const sortValue = `${select.sort || ""}`.trim();
      if (sortValue) {
        warnings.push(
          i18n("orbat_admin.validation.sort_ignored", {
            label: labelForWarning,
            value: sortValue,
          })
        );
      }
    }

    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child) =>
      this.#scanNode(child, warnings, codeSet, idSet)
    );
  }

  #findDuplicates(list) {
    const seen = new Set();
    const duplicates = new Set();

    list
      .map((value) => `${value}`.trim())
      .filter(Boolean)
      .forEach((value) => {
        if (seen.has(value)) {
          duplicates.add(value);
        } else {
          seen.add(value);
        }
      });

    return Array.from(duplicates);
  }
}
