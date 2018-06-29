import con from "./con.js";
import bookmarksTree from "./bookmarks-tree.js";
import sortConf from "./sort-conf.js";
import sortLock from "./sort-lock.js";
import * as util from "./util.js";

function sliceAndSort(arr) {
    let sliceStart = arr.findIndex(node => !util.isSeparator(node));
    if (sliceStart < 0) return [];

    const sorted = [];
    const sortSlice = (start, end) => {
        if (start < end) {
            sorted.push({
                start: arr[start].index,
                items: arr.slice(start, end).sort(sortConf.func),
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
    const subtrees = [];

    con.log("Sorting %s: %o", node.id, node.title);

    for (const {start, items} of sliceAndSort(node.children)) {
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
                node.title || node.id, start, start + items.length, moved, errors,
            );
        }
    }

    return subtrees;
}

async function sortNode(node, options = {}) {
    const {recurse = false} = options;

    if (node.unmodifiable) {
        con.log("Unmodifiable node: %o", node);
        return;
    }

    if (!util.isFolder(node)) {
        con.log("Not a folder: %o", node);
        return;
    }

    while (await sortLock.wait(node.id)) {
        // Some other task preempted us; if we're not recursive
        // assume we're redundant and bail out early
        if (!recurse) return;
    }

    await sortLock.run(node.id, async () => {
        const subtrees = await sortNodeInternal(node);
        if (recurse) await Promise.all(subtrees.map(n => sortNode(n, options)));
    });
}

async function autoSort(node, options = {}) {
    if (!sortConf.conf.autosort) return;

    con.log("Autosorting %s", node.id);
    await sortNode(node, options);
}

bookmarksTree.onChanged.add(async id => {
    await util.timedRun(async () => {
        const node = await bookmarksTree.getNode(id);
        await autoSort(node);
    });
});

sortConf.onUpdate.add(async () => {
    bookmarksTree.trackingEnabled = !!sortConf.conf.autosort;
    await util.timedRun(async () => {
        const node = await bookmarksTree.getRoot();
        await autoSort(node, {recurse: true});
    });
});

util.handleMessages({
    async sort(conf) {
        if (sortConf.set(conf) && sortConf.conf.autosort) {
            // Configuration change will trigger autosort
        } else {
            await util.timedRun(async () => {
                const node = await bookmarksTree.getRoot();
                await sortNode(node, {recurse: true});
            });
        }
    },

    popupOpened() {
        sortLock.notify();
        return sortConf.conf;
    },
});
