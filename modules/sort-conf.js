import con from "./con.js";
import makeCompareFunction from "./compare.js";
import * as util from "./util.js";

const sortConf = {
    conf:     {},
    func:     makeCompareFunction({}),
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

    set(conf, options = {}) {
        if (!conf) throw new Error("Invalid conf");
        const {toStorage = true, update = true} = options;

        const {conf: oldConf, onUpdate} = this;
        if (util.objectsEqual(oldConf, conf)) return false;

        con.log("Setting conf to %o", conf);
        this.autoSorts.update(oldConf.autosort, conf.autosort);
        this.conf = conf;
        this.func = makeCompareFunction(conf);

        if (toStorage) browser.storage.sync.set({sortConf: conf});
        if (update) for (const func of onUpdate) func();
        return true;
    },
};

browser.storage.onChanged.addListener((changes, area) => {
    con.log("Storage %s changed: %o", area, changes);
    if (area === "sync" && changes.sortConf && changes.sortConf.newValue) {
        sortConf.set(changes.sortConf.newValue, {toStorage: false});
    }
});

(async () => {
    const {sortConf: conf, ...rest} = await browser.storage.sync.get();

    if (conf) {
        sortConf.set(conf);
    } else {
        // Migrate 0.2 settings
        const keys = ["by", "folders", "reversed"];
        const storKey = k => `popupForm-${k}`;
        sortConf.set(Object.fromEntries(keys.map(k => [k, rest[storKey(k)]])));
        await browser.storage.sync.remove(keys.map(storKey));
    }
})();

export default sortConf;
