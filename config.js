import {exists, setTracking} from "/bookmarks.js";
import con from "/console.js";
import makeCompareFunction from "/compare.js";
import {objectsEqual} from "/util.js";

const {storage} = browser;

export const onChanged = new Set();

function emitChanged(id) {
    for (const func of onChanged) func(id);
}

const PREFIX = "sortConf";

const confs = new Map();
const funcs = new Map();
const autos = new Set();

export function get(id, fallback = null) {
    return confs.get(id) || confs.get(fallback);
}

export function getfunc(id, fallback = null) {
    return funcs.get(id) || funcs.get(fallback);
}

export function remove(id, options = {}) {
    if (!id) throw new Error("Global config not removable");

    const {toStorage = true, update = true} = options;

    if (!confs.has(id)) return false;

    con.log("Removing conf:", id);
    confs.delete(id);
    funcs.delete(id);
    autos.delete(id);

    if (toStorage) storage.sync.remove([PREFIX + (id || "")]);
    if (update) emitChanged(id);
    setTracking(autos.size > 0);

    return true;
}

export function set(id, conf, options = {}) {
    if (!conf) return remove(id, options);

    const {toStorage = true, update = true} = options;

    const oldConf = confs.get(id);
    if (oldConf && objectsEqual(oldConf, conf)) return false;

    con.log("Setting conf:", id, conf);
    confs.set(id, conf);
    funcs.set(id, makeCompareFunction(conf));
    if (conf.autosort) autos.add(id);
    else autos.delete(id);

    if (toStorage) storage.sync.set({[PREFIX + (id || "")]: conf});
    if (update) emitChanged(id);
    setTracking(autos.size > 0);

    return true;
}

storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    con.log("Storage changed:", changes);

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
            con.log("Removing superfluous conf:", id);
            await storage.sync.remove(key);
        }
    }));

    if (conf !== undefined) {
        set(null, conf);
        return;
    }

    // Migrate 0.2 settings
    const storKey = k => `popupForm-${k}`;
    const oldKeys = ["by", "folders", "reversed"].filter(k => storKey(k) in rest);
    if (oldKeys.length > 0) {
        con.log("Migrating old conf");
        set(null, Object.fromEntries(oldKeys.map(k => [k, rest[storKey(k)]])));
        await storage.sync.remove(oldKeys.map(storKey));
        return;
    }

    con.log("Initializing new conf");
    set(null, {});
}
