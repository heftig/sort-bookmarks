import con, {debugMode} from "./con.js";

export function isFolder({type, url}) {
    // "type" property added in Firefox 57
    switch (type) {
        case "folder":
            return true;
        case undefined:
            return url === undefined;
        default:
            return false;
    }
}

export function isSeparator({type}) {
    return type === "separator";
}

export async function timedRun(func) {
    if (!debugMode) return func();
    let t = performance.now();
    const res = await func();
    t = performance.now() - t;
    con.log("Completed in %.3fs", t / 1000);
    return res;
}

export function sendMessage(type, value = undefined) {
    return browser.runtime.sendMessage({type, value});
}

export function handleMessages(handler) {
    browser.runtime.onMessage.addListener(async ({type, value}, {url}) => {
        con.log("Received message %s(%o) from %s", type, value, url);

        const {[type]: func} = handler;
        return func ? func(value) : undefined;
    });
}

export function objectsEqual(obj1, obj2) {
    if (obj1 === obj2) return true;

    const names1 = Object.getOwnPropertyNames(obj1);
    const names2 = Object.getOwnPropertyNames(obj2);

    if (names1.length !== names2.length) return false;
    for (const name of names1) if (obj1[name] !== obj2[name]) return false;

    return true;
}
