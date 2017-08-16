"use strict";

// XXX: Separators currently exist as invisible nodes that result in index jumps.
// This logic here will break horribly if separators ever become actual nodes.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1293853
const sliceAndSort = arr => {
  const sorted = [], sortSlice = (start, end) => sorted.push({
    start: arr[start].index,
    items: arr.slice(start, end).sort(sortConf.func)
  });

  const len = arr.length;
  if (len > 0) {
    let sliceStart = 0;

    for (let i = 1; i < len; i++) {
      if (arr[i - 1].index + 1 != arr[i].index) {
        sortSlice(sliceStart, i);
        sliceStart = i;
      }
    }

    sortSlice(sliceStart, len);
  }

  return sorted;
}

const sortNode = async (node, options = {}) => {
  const {recurse = false} = options;

  if (node.unmodifiable) {
    con.log("Unmodifiable node: %o", node);
    return;
  }

  if (node.url) {
    con.log("Not a folder: %o", node);
    return;
  }

  let promise;
  while (promise = await sortLock.wait(node.id)) {
    // Some other task preempted us; if we're not recursive
    // assume we're redundant and bail out early
    if (!recurse) return;
  }

  await sortLock.run(node.id, async () => {
    const children = node.children || await browser.bookmarks.getChildren(node.id);
    const subtrees = [];

    for (const {start, items} of sliceAndSort(children)) {
      let moved = 0;

      const len = items.length;
      for (let i = 0; i < len; i++) {
        const n = items[i], index = start + i;

        if (index !== n.index + moved) {
          await browser.bookmarks.move(n.id, { index });
          moved++;
        }

        if (!("url" in n)) subtrees.push(n);
      }

      if (moved) {
        con.log("Sorted \"%s\", slice %d..%d, %d items moved",
          node.title || node.id, start, start + len, moved);
      }
    }

    if (recurse) await Promise.all(subtrees.map(n => sortNode(n, options)));
  });
}

const autoSort = async (node, options={}) => {
  if (!sortConf.conf.autosort) return;

  con.log("Autosorting %s", node.id);
  await sortNode(node, options);
}

const getRoot = async () => (await browser.bookmarks.getTree())[0];
const getNode = async id => (await browser.bookmarks.get(id))[0];

const autoSortId = async id => await autoSort(await getNode(id));

browser.bookmarks.onCreated.addListener((id, node) => {
  con.log("Node created: %o", node);
  autoSortId(node.parentId);
});

browser.bookmarks.onRemoved.addListener((id, info) => {
  con.log("Node removed: %o", info.node);
  autoSortId(info.parentId);
});

browser.bookmarks.onChanged.addListener(async (id, info) => {
  const node = await getNode(id);
  con.log("Node changed: %o", node);
  autoSortId(node.parentId);
});

browser.bookmarks.onMoved.addListener((id, info) => {
  // FIXME: This gets fired when we move bookmarks.
  // I don't think it's guaranteed that we see the event before we "exit" the node,
  // so reacting to moves within a folder may lead to infinite looping.
  if (info.parentId == info.oldParentId) return;

  con.log("Node moved: %s", id);
  autoSortId(info.parentId);
});

sortConf.onUpdate.add(async () => autoSort(await getRoot(), { recurse: true }));

browser.runtime.onMessage.addListener(async e => {
  con.log("Received message: %o", e);

  switch (e.type) {
    case "sort":
      if (!sortConf.set(e.conf) || !sortConf.conf.autosort) {
        await sortNode(await getRoot(), { recurse: true });
        con.log("Success!");
      }
      return;

    case "popupOpened":
      sortLock.notify();
      return sortConf.conf;
  }
});
