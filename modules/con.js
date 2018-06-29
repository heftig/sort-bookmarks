let debugMode = false;
let con = new Proxy({}, {
    get(_target, _property, _receiver) {
        return Function.prototype;
    },
});

(async () => {
    const self = await browser.management.getSelf();

    if (self.installType === "development") {
        debugMode = true;
        con = console;
        con.log("Initialized debug logging");
    }
})();

export {con as default, debugMode};
