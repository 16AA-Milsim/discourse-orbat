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
  @tracked updatingEnabled = false;
  @tracked updatingAdminOnly = false;

  formApi = null;
  _pendingFormSync = false;

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
    this._queueFormSync();
  }

  get previewErrors() {
    return this.tree?.errors || [];
  }

  get adminOnlyDisabled() {
    return !this.orbatEnabled || this.updatingAdminOnly;
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
}
