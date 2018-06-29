import con from "./con.js";
import makeCompareFunction from "./compare.js";

const sortConf = {
    conf:     {},
    func:     makeCompareFunction({}),
    onUpdate: new Set(),

    has(conf) {
        if (this.conf === conf) return true;

        const names1 = Object.getOwnPropertyNames(this.conf);
        const names2 = Object.getOwnPropertyNames(conf);

        if (names1.length !== names2.length) return false;
        for (const name of names1) if (this.conf[name] !== conf[name]) return false;

        return true;
    },

    set(conf) {
        if (!conf) throw new Error("Invalid conf");
        if (this.has(conf)) return false;

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
