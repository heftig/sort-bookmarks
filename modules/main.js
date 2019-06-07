import con from "./con.js";
import bookmarksTree from "./bookmarks-tree.js";
import sortConf from "./sort-conf.js";
import sortLock from "./sort-lock.js";
import * as util from "./util.js";

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
            con.log("Found a separator at %d: %o", i, node);
            sortSlice(sliceStart, i);
            sliceStart = i + 1;
        } else if (gap !== 0) {
            // Pre-57, separators leave gaps
            con.log("Found %d separators at %d", gap, i);
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
    con.log("Sorting %s: %o", id, title);

    const {func} = sortConf;
    const subtrees = [];

    for (const {start, items} of sliceAndSort(children, func)) {
        let errors = 0;
        let moved = 0;

        for (const [i, n] of items.entries()) {
            const index = start + i - errors;

            if (index !== n.index + moved) {
                try {
                    await browser.bookmarks.move(n.id, {index});
                    moved += 1;
                } catch (e) {
                    con.log("Failed to move %o: %o", n, e);
                    errors += 1;
                }
            }

            if (n.children) subtrees.push(n);
        }

        if (moved || errors) {
            con.log(
                "Sorted \"%s\", slice %d..%d, %d items moved, %d items failed",
                title || id, start, start + items.length, moved, errors,
            );
        }
    }

    return subtrees;
}

function isSortable(node) {
    if (!node) return false;

    if (node.unmodifiable) {
        con.log("Unmodifiable node: %o", node);
        return false;
    }

    if (!util.isFolder(node)) {
        con.log("Not a folder: %o", node);
        return false;
    }

    return true;
}

async function sortNode(node, options = {}) {
    const {recurse = false} = options;

    if (!isSortable(node)) return;
    const {id} = node;

    while (await sortLock.wait(id)) {
        // Some other task preempted us; if we're not recursive
        // assume we're redundant and bail out early
        if (!recurse) return;
    }

    await sortLock.run(id, async () => {
        const subtrees = await sortNodeInternal(node);
        if (recurse) await Promise.all(subtrees.map(n => sortNode(n, options)));
    });
}

async function startSort(id) {
    await util.timedRun(async () => {
        if (id) {
            const node = await bookmarksTree.getNode(id);
            await sortNode(node);
        } else {
            const node = await bookmarksTree.getRoot();
            await sortNode(node, {recurse: true});
        }
    });
}

async function autoSort(id) {
    const {conf: {autosort}} = sortConf;
    if (autosort) {
        con.log("Autosorting %o", id || "the root");
        await startSort(id);
    } else {
        con.log("Not autosorting %o", id);
    }
}

bookmarksTree.onChanged.add(async id => {
    await autoSort(id);
});

sortConf.onUpdate.add(async () => {
    await autoSort(undefined);
});

sortConf.autoSorts.onUpdate.add(count => {
    bookmarksTree.trackingEnabled = count > 0;
});

util.handleMessages({
    async sort(conf) {
        sortConf.set(conf, {update: false});
        await startSort(undefined);
    },

    popupOpened() {
        sortLock.notify();
        return sortConf.conf;
    },
});
