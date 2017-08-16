"use strict";

const sortLock = {
  sorts: new Map(),

  async notify() {
    try {
      await browser.runtime.sendMessage({
        type: "sortInProgress",
        value: this.sorts.size > 0
      });
    } catch (e) {
      // FIXME: Ignore; popup frame might not exist
    }
  },

  // Wait for a previous sort to complete
  async wait(id) {
    let promise = this.sorts.get(id);

    if (promise) {
      con.log("Waiting on %o: %o", id, promise);
      await promise;
      promise = this.sorts.get(id);
    }

    return promise;
  },

  async run(id, asyncFunc) {
    if (this.sorts.has(id)) throw `Already sorting ${id}`;

    // XXX: Safety valve
    if (this.sorts.size >= 10000) throw "Too many concurrent sorts";

    const promise = asyncFunc();
    this.sorts.set(id, promise);

    try {
      con.log("Sorts %d", this.sorts.size);
      if (this.sorts.size == 1) this.notify();
      await promise;
    } finally {
      this.sorts.delete(id);
      con.log("Sorts %d", this.sorts.size);
      if (this.sorts.size == 0) this.notify();
    }
  }
};
