import {exists, setTracking} from "/bookmarks.js";
import con from "/console.js";
import makeCompareFunction from "/compare.js";
import {objectsEqual} from "/util.js";

const {storage} = browser;

export const onChanged = new Set();

function emitChanged(id) {
    for (const func of onChanged) func(id);
}

function nodeId(id) {
    switch (typeof id) {
        case "undefined":
            return "";
        case "string":
            return id;
        case "object":
            return nodeId(id.id);
        default:
            break;
    }

    con.error("Invalid ID:", id);
    throw new Error("Invalid ID");
}

const confs = new Map();
const funcs = new Map();
const autos = new Set();

function getmap(map, id, fallback) {
    return map.get(nodeId(id)) || map.get(nodeId(fallback));
}

export function get(id, fallback = undefined) {
    return getmap(confs, id, fallback);
}

export function getfunc(id, fallback = undefined) {
    return getmap(funcs, id, fallback);
}

export function remove(options = {}) {
    const {toStorage = true, update = true} = options;
    const id = nodeId(options.id);
    const oldConf = confs.get(id);
    if (!oldConf) return false;

    if (id === "") throw new Error("Global config not removable");

    con.log("Removing conf for '%s'", id);
    confs.delete(id);
    funcs.delete(id);
    autos.delete(id);

    if (toStorage) storage.sync.remove([`sortConf${id}`]);
    if (update) emitChanged(id);
    setTracking(autos.size > 0);

    return true;
}

export function set(conf, options = {}) {
    if (!conf) return remove(options);
    const {toStorage = true, update = true} = options;
    const id = nodeId(options.id);
    const oldConf = confs.get(id) || {};
    if (objectsEqual(oldConf, conf)) return false;

    con.log("Setting conf for '%s':", id, conf);
    confs.set(id, conf);
    funcs.set(id, makeCompareFunction(conf));
    if (conf.autosort) autos.add(id);
    else autos.delete(id);

    if (toStorage) storage.sync.set({[`sortConf${id}`]: conf});
    if (update) emitChanged(id);
    setTracking(autos.size > 0);

    return true;
}

storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, {newValue}] of Object.entries(changes)) {
        if (key.startsWith("sortConf")) set(newValue, {id: key.slice(8), toStorage: false});
        else con.warn("Unknown storage key:", key);
    }
});

export async function load() {
    const {sortConf: conf, ...rest} = await storage.sync.get();

    await Promise.all(Object.entries(rest).map(async ([key, value]) => {
        if (!key.startsWith("sortConf")) {
            con.warn("Unknown storage key:", key);
            return;
        }

        const id = key.slice(8);
        if (await exists(id)) {
            set(value, {id, toStorage: false, update: false});
        } else {
            con.log("Nonexistent ID '%s'", id);
            await storage.sync.remove(key);
        }
    }));

    if (conf) {
        set(conf);
    } else {
        // Migrate 0.2 settings
        const keys = ["by", "folders", "reversed"];
        const storKey = k => `popupForm-${k}`;
        set(Object.fromEntries(keys.map(k => [k, rest[storKey(k)]])));
        await storage.sync.remove(keys.map(storKey));
    }
}
