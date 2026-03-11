import { ajax } from "discourse/lib/ajax";
import DiscourseRoute from "discourse/routes/discourse";

/**
 * @class AdminPluginsOrbatRoute
 */
export default class AdminPluginsOrbatRoute extends DiscourseRoute {
  async model() {
    if (!this.currentUser?.staff) {
      return { disallow: true };
    }

    return ajax("/admin/plugins/orbat/config.json");
  }

  setupController(controller, model) {
    controller.setup(model);
  }
}
