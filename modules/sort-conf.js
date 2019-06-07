import con from "./con.js";
import makeCompareFunction from "./compare.js";
import * as util from "./util.js";

const sortConf = {
    conf:     {},
    func:     makeCompareFunction({}),
    onUpdate: new Set(),

    set(conf) {
        if (!conf) throw new Error("Invalid conf");
        if (util.objectsEqual(this.conf, conf)) return false;

        con.log("Setting conf to %o", conf);

        this.conf = conf;
        this.func = makeCompareFunction(conf);

        browser.storage.sync.set({sortConf: conf});
        for (const func of this.onUpdate) func();
        return true;
    },
};

browser.storage.onChanged.addListener((changes, area) => {
    con.log("Storage %s changed: %o", area, changes);
    if (area === "sync" && changes.sortConf && changes.sortConf.newValue) {
        sortConf.set(changes.sortConf.newValue);
    }
});

(async () => {
    let {sortConf: conf} = await browser.storage.sync.get(["sortConf"]);

    if (!conf) {
        // Migrate 0.2 settings
        const keys = ["by", "folders", "reversed"];
        const storKey = k => `popupForm-${k}`;
        const values = await browser.storage.sync.get(keys.map(storKey));

        conf = {};

        // eslint-disable-next-line prefer-destructuring
        for (const k of keys) conf[k] = values[storKey(k)];

        await browser.storage.sync.remove(keys.map(storKey));
    }

    sortConf.set(conf);
})();

export default sortConf;
