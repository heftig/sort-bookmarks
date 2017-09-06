"use strict";

var debugMode = false;
var con = new Proxy({}, {
  get(target, property, receiver) {
    return Function.prototype;
  }
});

(async () => {
  const self = await browser.management.getSelf();

  if (self.installType == "development") {
    debugMode = true;
    con = console;
    con.log("Initialized debug logging");
  }
})();
