(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.PlaybackController = api.PlaybackController;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MODES = Object.freeze(["once", "loop", "manual"]);

  class PlaybackController {
    constructor(options = {}) {
      this.mode = MODES.includes(options.mode) ? options.mode : "once";
      this.delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : 300;
      this.restart = typeof options.restart === "function" ? options.restart : function () {};
      this.onFinished = typeof options.onFinished === "function" ? options.onFinished : function () {};
      this.onLoopPending = typeof options.onLoopPending === "function" ? options.onLoopPending : function () {};
      this.schedule = typeof options.setTimeoutFn === "function"
        ? options.setTimeoutFn
        : globalThis.setTimeout.bind(globalThis);
      this.cancel = typeof options.clearTimeoutFn === "function"
        ? options.clearTimeoutFn
        : globalThis.clearTimeout.bind(globalThis);
      this.timer = null;
      this.generation = 0;
    }

    setMode(mode, options = {}) {
      if (!MODES.includes(mode)) {
        throw new TypeError(`Mode pemutaran tidak didukung: ${mode}`);
      }

      this.mode = mode;
      this.cancelPending();

      if (options.isEnded) {
        if (mode === "loop") {
          return this.handleEnded();
        }
        this.onFinished(mode);
        return "finished";
      }

      return "updated";
    }

    handleEnded() {
      this.cancelPending();

      if (this.mode !== "loop") {
        this.onFinished(this.mode);
        return "finished";
      }

      const generation = this.generation;
      this.onLoopPending();
      this.timer = this.schedule(() => {
        if (generation !== this.generation || this.mode !== "loop") return;
        this.timer = null;
        this.restart();
      }, this.delay);
      return "loop-pending";
    }

    cancelPending() {
      this.generation += 1;
      if (this.timer !== null) {
        this.cancel(this.timer);
        this.timer = null;
      }
    }
  }

  PlaybackController.MODES = MODES;
  return { PlaybackController, MODES };
});
