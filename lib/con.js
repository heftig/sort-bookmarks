"use strict";

var con = new Proxy({}, {
  get: function(target, property, receiver) {
    return Function.prototype;
  }
});

(async function() {
  let self = await browser.management.getSelf();

  if (self.installType == "development") {
    con = console;
    con.log("Initialized debug logging");
  }
})();
