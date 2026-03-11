import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export default class OrbatUniformPreviewCacheService extends Service {
  @tracked revision = 0;

  _stateByKey = new Map();
  _inflightByKey = new Map();

  getState(key) {
    if (!key) {
      return null;
    }

    return this._stateByKey.get(key) || null;
  }

  setState(key, state) {
    if (!key) {
      return;
    }

    const previous = this._stateByKey.get(key);
    this.#revokeObjectUrlIfNeeded(previous?.url, state?.url);

    this._stateByKey.set(key, state);
    this.revision += 1;
  }

  getInflight(key) {
    if (!key) {
      return null;
    }

    return this._inflightByKey.get(key) || null;
  }

  setInflight(key, promise) {
    if (!key || !promise) {
      return;
    }

    this._inflightByKey.set(key, promise);
  }

  clearInflight(key, promise = null) {
    if (!key) {
      return;
    }

    if (!this._inflightByKey.has(key)) {
      return;
    }

    if (promise && this._inflightByKey.get(key) !== promise) {
      return;
    }

    this._inflightByKey.delete(key);
  }

  willDestroy() {
    super.willDestroy(...arguments);

    this._stateByKey.forEach((state) => {
      this.#revokeObjectUrlIfNeeded(state?.url);
    });
    this._stateByKey.clear();
    this._inflightByKey.clear();
  }

  #revokeObjectUrlIfNeeded(currentUrl, nextUrl = null) {
    if (!currentUrl || currentUrl === nextUrl || !currentUrl.startsWith("blob:")) {
      return;
    }

    try {
      URL.revokeObjectURL(currentUrl);
    } catch {
      // noop
    }
  }
}
