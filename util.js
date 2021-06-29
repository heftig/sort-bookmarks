import con, {debugMode} from "/console.js";

const {menus, runtime} = browser;

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

export function isSortable(node) {
    if (!node) return false;

    if (node.unmodifiable) {
        con.log("Unmodifiable node:", node);
        return false;
    }

    if (!isFolder(node)) {
        con.log("Not a folder:", node);
        return false;
    }

    return true;
}

const MSEC_PER_SEC = 1000;

export async function timedRun(func) {
    if (!debugMode) return func();
    let t = performance.now();
    const res = await func();
    t = performance.now() - t;
    con.log("Completed in %.3fs", t / MSEC_PER_SEC);
    return res;
}

export function objectsEqual(obj1, obj2) {
    if (obj1 === obj2) return true;

    const names1 = Object.getOwnPropertyNames(obj1);
    const names2 = Object.getOwnPropertyNames(obj2);

    if (names1.length !== names2.length) return false;
    for (const n of names1) if (obj1[n] !== obj2[n]) return false;

    return true;
}

export function merge(...objs) {
    return objs.reduce(Object.assign, {});
}

export function createMenuItem(properties) {
    return new Promise((resolve, reject) => {
        const id = menus.create(properties, () => {
            const {lastError: error} = runtime;
            if (error) {
                con.error("Failed to create menu item (%o):", properties, error);
                reject(error);
            } else {
                con.log("Created menu item (%o):", properties, id);
                resolve(id);
            }
        });
    });
}
