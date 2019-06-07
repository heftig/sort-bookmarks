import con from "./con.js";
import makeCompareFunction from "./compare.js";
import * as util from "./util.js";

function nodeId(node) {
    switch (typeof node) {
        case "undefined":
            return "";
        case "string":
            return node;
        case "object":
            if ("id" in node) return node.id;
            break;
        default:
            break;
    }

    con.log("Invalid node: %o", node);
    throw new Error("Invalid node");
}

const sortConf = {
    conf: {
        "": {},
    },
    func: {
        "": makeCompareFunction({}),
    },
    onUpdate: new Set(),

    autoSorts: {
        count:    0,
        onUpdate: new Set(),

        update(oldValue, newValue) {
            if (!oldValue && newValue) {
                this.count += 1;
            } else if (oldValue && !newValue) {
                this.count -= 1;
            } else {
                return;
            }

            const {count, onUpdate} = this;
            con.log("AutoSorts count now %o", count);
            for (const func of onUpdate) func(count);
        },
    },

    get(node) {
        const {conf: {[nodeId(node)]: conf}} = this;
        if (!conf) return this.conf[""];
        return conf;
    },

    getfunc(node) {
        const {func: {[nodeId(node)]: func}} = this;
        if (!func) return this.func[""];
        return func;
    },

    set(node, conf, options = {}) {
        if (!conf) return this.remove(node, options);
        const {toStorage = true, update = true} = options;
        const id = nodeId(node);
        const {conf: {[id]: oldConf = {}}, onUpdate} = this;
        if (util.objectsEqual(oldConf, conf)) return false;

        con.log("Setting conf for '%s' to %o", id, conf);
        this.autoSorts.update(oldConf.autosort, conf.autosort);
        this.conf[id] = conf;
        this.func[id] = makeCompareFunction(conf);

        if (toStorage) browser.storage.sync.set({[`sortConf${id}`]: conf});
        if (update) for (const func of onUpdate) func(id);
        return true;
    },

    remove(node, options = {}) {
        const {toStorage = true, update = true} = options;
        const id = nodeId(node);
        const {conf: {[id]: oldConf}, onUpdate} = this;
        if (!oldConf) return false;

        if (id === "") throw new Error("Global config not removable");

        con.log("Removing conf for '%s'", id);
        this.autoSorts.update(oldConf.autosort, false);
        delete this.conf[id];
        delete this.func[id];

        if (toStorage) browser.storage.sync.remove([`sortConf${id}`]);
        if (update) for (const func of onUpdate) func(id);
        return true;
    },
};

browser.storage.onChanged.addListener((changes, area) => {
    con.log("Storage %s changed: %o", area, changes);
    if (area !== "sync") return;
    for (const [key, {newValue}] of Object.entries(changes)) {
        if (key.startsWith("sortConf")) {
            sortConf.set(key.slice(8), newValue, {toStorage: false});
        } else {
            con.log("Unknown storage key '%s'", key);
        }
    }
});

(async () => {
    const {sortConf: conf, ...rest} = await browser.storage.sync.get();

    await Promise.all(Object.entries(rest).map(async ([key, value]) => {
        if (!key.startsWith("sortConf")) {
            con.log("Unknown storage key '%s'", key);
            return;
        }

        const id = key.slice(8);

        try {
            await browser.bookmarks.get(id);
        } catch (_e) {
            con.log("Nonexistent ID '%s'", id);
            await browser.storage.sync.remove(key);
            return;
        }

        sortConf.set(id, value, {toStorage: false, update: false});
    }));

    if (conf) {
        sortConf.set("", conf);
    } else {
        // Migrate 0.2 settings
        const keys = ["by", "folders", "reversed"];
        const storKey = k => `popupForm-${k}`;
        sortConf.set("", Object.fromEntries(keys.map(k => [k, rest[storKey(k)]])));
        await browser.storage.sync.remove(keys.map(storKey));
    }
})();

export default sortConf;
