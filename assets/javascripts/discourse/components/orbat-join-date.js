import Component from "@glimmer/component";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class OrbatJoinDate extends Component {
  @tracked joinDate = "";
  @tracked isSaving = false;

  constructor() {
    super(...arguments);
    this.joinDate = this.currentDate;
  }

  get user() {
    return this.args.user;
  }

  get currentDate() {
    return this.user?.orbat_join_date || "";
  }

  get hasManualDate() {
    return !!this.currentDate;
  }

  get isDirty() {
    return (this.joinDate || "") !== this.currentDate;
  }

  get saveDisabled() {
    return this.isSaving || !this.isDirty;
  }

  @action
  syncJoinDate() {
    this.joinDate = this.currentDate;
  }

  @action
  updateJoinDate(event) {
    this.joinDate = event.target.value;
  }

  @action
  async saveJoinDate() {
    if (!this.user || this.saveDisabled) {
      return;
    }

    this.isSaving = true;
    try {
      const response = await ajax(
        `/admin/users/${this.user.id}/orbat-join-date`,
        {
          type: "PUT",
          data: { join_date: this.joinDate || "" },
        }
      );
      const nextDate = response?.join_date || "";
      this.user.set("orbat_join_date", nextDate);
      this.joinDate = nextDate;
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.isSaving = false;
    }
  }

  @action
  removeJoinDate() {
    this.joinDate = "";
    this.saveJoinDate();
  }
}
