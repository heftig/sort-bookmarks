import * as bookmarks from "/bookmarks.js";
import * as config from "/config.js";
import * as lock from "/lock.js";
import * as util from "/util.js";
import con, {init as initCon} from "/console.js";
import {handle} from "/message.js";

const {browserAction} = browser;

function sliceAndSort(arr, func) {
    let sliceStart = arr.findIndex(node => !util.isSeparator(node));
    if (sliceStart < 0) return [];

    const sorted = [];
    const sortSlice = (start, end) => {
        if (start < end) {
            sorted.push({
                start: arr[start].index,
                items: arr.slice(start, end).sort(func),
            });
        }
    };

    const {length: len} = arr;
    for (let i = sliceStart + 1; i < len; i += 1) {
        const {[i - 1]: prev, [i]: node} = arr;
        const gap = node.index - prev.index - 1;

        if (util.isSeparator(node)) {
            // Firefox 57+
            sortSlice(sliceStart, i);
            sliceStart = i + 1;
        } else if (gap !== 0) {
            // Pre-57, separators leave gaps
            sortSlice(sliceStart, i);
            sliceStart = i;
        }
    }

    // Sort last slice
    sortSlice(sliceStart, len);

    return sorted;
}

async function sortNodeInternal(node) {
    const {id, title, children} = node;
    const func = config.getfunc(id);
    const subtrees = [];

    for (const {start, items} of sliceAndSort(children, func)) {
        let errors = 0;
        let moved = 0;

        for (const [i, n] of items.entries()) {
            const index = start + i - errors;

            if (index !== n.index + moved) {
                try {
                    await bookmarks.move(n.id, {index});
                    moved += 1;
                } catch (e) {
                    con.error("Failed to move:", n, e);
                    errors += 1;
                }
            }

            if (n.children) subtrees.push(n);
        }

        if (moved || errors) {
            con.log(
                "Sorted \"%s\", slice %d..%d, %d items moved, %d items failed",
                title || id,
                start,
                start + items.length,
                moved,
                errors,
            );
        }
    }

    return subtrees;
}

async function sortNode(node, options = {}) {
    const {recurse = false} = options;

    if (!util.isSortable(node)) return;
    const {id} = node;

    while (await lock.wait(id)) {
        // Some other task preempted us; if we're not recursive
        // assume we're redundant and bail out early
        if (!recurse) return;
    }

    await lock.run(id, async () => {
        const subtrees = await sortNodeInternal(node);
        if (recurse) await Promise.all(subtrees.map(n => sortNode(n, options)));
    });
}

async function startSort(id) {
    await util.timedRun(async () => {
        if (id) {
            const node = await bookmarks.getNode(id);
            await sortNode(node);
        } else {
            const node = await bookmarks.getAll();
            await sortNode(node, {recurse: true});
        }
    });
}

async function autoSort(id) {
    const {autosort} = config.get(id);
    if (autosort) {
        con.log("Autosorting %s", id || "the root");
        await startSort(id);
    } else {
        con.log("Not autosorting %s", id || "the root");
    }
}

bookmarks.onChanged.add(autoSort);
config.onChanged.add(autoSort);

const CONTEXT_TIMEOUT = 5000;
let menuContext = null;

handle({
    async sort(id, conf) {
        config.set(id, conf, {update: false});
        await startSort(id);
    },

    async popupOpened() {
        let node = null;

        if (menuContext) {
            const {info, stamp} = menuContext;
            menuContext = null;

            if (!stamp || Date.now() - stamp < CONTEXT_TIMEOUT) {
                const {bookmarkId} = info;
                node = await bookmarks.findAncestor(bookmarkId, util.isSortable);
            } else {
                con.warn("Menu context timeout!");
            }
        }

        lock.notify();
        return {node, conf: config.get(node && node.id)};
    },
});

util.createMenuItem({
    contexts: ["bookmark"],
    title:    "Sort this folder…",

    onclick(info, tab) {
        con.log("Opening popup:", info, tab);
        menuContext = {info, stamp: Date.now()};
        browserAction.openPopup();
    },
});

(async () => {
    await initCon();
    await config.load();
})();
