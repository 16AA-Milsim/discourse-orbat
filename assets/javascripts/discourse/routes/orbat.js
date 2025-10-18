import Route from "@ember/routing/route";
import { ajax } from "discourse/lib/ajax";

/**
 * @class OrbatRoute
 */
export default class OrbatRoute extends Route {
  async model() {
    try {
      return await ajax("/orbat.json");
    } catch (error) {
      const serverError = error?.jqXHR?.responseJSON?.error;
      return {
        title: null,
        subtitle: null,
        display: {},
        nodes: [],
        errors: [serverError || error.message],
      };
    }
  }

  activate() {
    super.activate(...arguments);
    document.body.classList.add("orbat-view");
  }

  deactivate() {
    super.deactivate(...arguments);
    document.body.classList.remove("orbat-view");
  }
}
