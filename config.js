import {exists, setTracking} from "/bookmarks.js";
import con from "/console.js";
import makeCompareFunction from "/compare.js";
import {objectsEqual} from "/util.js";

const {storage} = browser;

export const onChanged = new Set();

function emitChanged(id) {
    for (const func of onChanged) func(id);
}

function nodeId(nodeOrId) {
    switch (typeof nodeOrId) {
        case "undefined":
            return "";
        case "string":
            return nodeOrId;
        case "object":
            return nodeOrId === null ? "" : nodeOrId.id;
        default:
            break;
    }

    con.error("Invalid node or ID:", nodeOrId);
    throw new Error("Invalid node or ID");
}

const PREFIX = "sortConf";

const confs = new Map();
const funcs = new Map();
const autos = new Set();

function getmap(map, id, fallback) {
    return map.get(nodeId(id)) || map.get(nodeId(fallback));
}

export function get(id, fallback = null) {
    return getmap(confs, id, fallback);
}

export function getfunc(id, fallback = null) {
    return getmap(funcs, id, fallback);
}

export function remove(node, options = {}) {
    const {toStorage = true, update = true} = options;
    const id = nodeId(node);
    const oldConf = confs.get(id);
    if (!oldConf) return false;

    if (id === "") throw new Error("Global config not removable");

    con.log("Removing conf for '%s'", id);
    confs.delete(id);
    funcs.delete(id);
    autos.delete(id);

    if (toStorage) storage.sync.remove([PREFIX + id]);
    if (update) emitChanged(id);
    setTracking(autos.size > 0);

    return true;
}

export function set(node, conf, options = {}) {
    if (!conf) return remove(node, options);

    const {toStorage = true, update = true} = options;
    const id = nodeId(node);
    const oldConf = confs.get(id) || {};
    if (objectsEqual(oldConf, conf)) return false;

    con.log("Setting conf for '%s':", id, conf);
    confs.set(id, conf);
    funcs.set(id, makeCompareFunction(conf));
    if (conf.autosort) autos.add(id);
    else autos.delete(id);

    if (toStorage) storage.sync.set({[PREFIX + id]: conf});
    if (update) emitChanged(id);
    setTracking(autos.size > 0);

    return true;
}

storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    const {[PREFIX]: {newValue: conf} = {}, ...rest} = changes;

    for (const [key, {newValue}] of Object.entries(rest)) {
        if (!key.startsWith(PREFIX)) {
            con.warn("Unknown storage key:", key);
            continue;
        }

        const id = key.slice(PREFIX.length);
        set(id, newValue, {toStorage: false});
    }

    if (conf) set(null, conf, {toStorage: false});
});

export async function load() {
    const {[PREFIX]: conf, ...rest} = await storage.sync.get();

    await Promise.all(Object.entries(rest).map(async ([key, value]) => {
        if (!key.startsWith(PREFIX)) {
            con.warn("Unknown storage key:", key);
            return;
        }

        const id = key.slice(PREFIX.length);
        if (await exists(id)) {
            set(id, value, {toStorage: false, update: false});
        } else {
            con.log("Nonexistent ID '%s'", id);
            await storage.sync.remove(key);
        }
    }));

    if (conf) {
        set(null, conf);
    } else {
        // Migrate 0.2 settings
        const keys = ["by", "folders", "reversed"];
        const storKey = k => `popupForm-${k}`;
        set(null, Object.fromEntries(keys.map(k => [k, rest[storKey(k)]])));
        await storage.sync.remove(keys.map(storKey));
    }
}
