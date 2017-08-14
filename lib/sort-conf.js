"use strict";

var sortConf = {
  conf: {},
  func: makeCompareFunction({}),
  onUpdate: new Set(),

  has: function(conf) {
    if (this.conf === conf) return true;

    let names1 = Object.getOwnPropertyNames(this.conf);
    let names2 = Object.getOwnPropertyNames(conf);

    if (names1.length != names2.length) return false;
    for (let name of names1) if (this.conf[name] !== conf[name]) return false;

    return true;
  },

  set: function(conf) {
    if (!conf) throw "Invalid conf";
    if (this.has(conf)) return false;

    con.log("Setting conf to %o", conf);

    this.conf = conf;
    this.func = makeCompareFunction(conf);

    browser.storage.sync.set({ sortConf: conf });
    for (let func of this.onUpdate) func();
    return true;
  }
};

browser.storage.onChanged.addListener((changes, area) => {
  con.log("Storage %s changed: %o", area, changes);
  if (area == "sync" && changes.sortConf && changes.sortConf.newValue) {
    sortConf.set(changes.sortConf.newValue);
  }
});

(async function() {
  let values = await browser.storage.sync.get(["sortConf"]);
  sortConf.set(values.sortConf || {});
})();
