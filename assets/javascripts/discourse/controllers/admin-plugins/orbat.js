import { tracked } from "@glimmer/tracking";
import Controller from "@ember/controller";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { scheduleOnce } from "@ember/runloop";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

/**
 * @class AdminPluginsOrbatController
 */
export default class AdminPluginsOrbatController extends Controller {
  @tracked data = { configuration: "" };
  @tracked tree = null;
  @tracked notice = null;
  @tracked previewState = "idle";
  @tracked disallow = false;

  formApi = null;
  _pendingFormSync = false;

  setup(model) {
    if (model?.disallow) {
      this.disallow = true;
      return;
    }

    this.disallow = false;
    this.data = {
      configuration: model?.configuration || "",
    };
    this.tree = model?.tree || null;
    this.notice = null;
    this.previewState = "idle";
    this._queueFormSync();
  }

  get previewErrors() {
    return this.tree?.errors || [];
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
      return;
    }

    try {
      JSON.parse(raw);
    } catch (error) {
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
  async generatePreview(event) {
    event?.preventDefault();

    if (!this.formApi) {
      return;
    }

    const configuration = this.formApi.get("configuration") ?? "";
    if (!this.ensureConfigurationValid(configuration)) {
      return;
    }

    this.previewState = "loading";
    this.notice = null;

    try {
      this.tree = await ajax("/admin/plugins/orbat/preview", {
        type: "POST",
        data: { configuration },
      });
    } catch (error) {
      this.previewState = "error";
      popupAjaxError(error);
      return;
    } finally {
      if (this.previewState === "loading") {
        this.previewState = "idle";
      }
    }
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
  resetForm(draftData) {
    this.data = { configuration: draftData?.configuration ?? "" };
    this.notice = null;
    this._queueFormSync();
  }

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
}
