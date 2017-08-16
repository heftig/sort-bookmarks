"use strict";

var con = new Proxy({}, {
  get(target, property, receiver) {
    return Function.prototype;
  }
});

(async () => {
  const self = await browser.management.getSelf();

  if (self.installType == "development") {
    con = console;
    con.log("Initialized debug logging");
  }
})();
