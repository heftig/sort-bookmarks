const {management} = browser;

export let debugMode = false;
export let consoleProxy = new Proxy({}, {
    get(_target, _property, _receiver) {
        return Function.prototype;
    },
});
export {consoleProxy as default};

export async function init() {
    const {installType} = await management.getSelf();
    if (installType !== "development") return;

    debugMode = true;
    consoleProxy = console;
    consoleProxy.log("Initialized debug logging");
}
