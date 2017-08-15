"use strict";

// XXX: Separators currently exist as invisible nodes that result in index jumps.
// This logic here will break horribly if separators ever become actual nodes.
function sliceAndSort(arr) {
  let sorted = [], sortSlice = (start, end) => sorted.push({
    start: arr[start].index,
    items: arr.slice(start, end).sort(sortConf.func)
  });

  let len = arr.length;
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

async function sortNode(node, options = {}) {
  let {recurse = false} = options;

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
    let children = node.children || await browser.bookmarks.getChildren(node.id);
    let subtrees = [];

    for (let {start, items} of sliceAndSort(children)) {
      let moved = 0, len = items.length;

      for (let i = 0; i < len; i++) {
        let n = items[i], index = start + i;

        if (index !== n.index + moved) {
          await browser.bookmarks.move(n.id, { index: index });
          moved++;
        }

        if (!("url" in n)) subtrees.push(n);
      }

      if (moved) {
        con.log("Sorted \"%s\", slice %d..%d, %d items moved",
          node.title || node.id, start, start + len, moved);
      }
    }

    if (recurse) await Promise.all(subtrees.map((n) => sortNode(n, options)));
  });
}

async function getRoot() {
  return (await browser.bookmarks.getTree())[0];
}

browser.runtime.onMessage.addListener(async (e) => {
  con.log("Received message: %o", e);

  switch (e.type) {
    case "sort":
      sortConf.set(e.conf);
      await sortNode(await getRoot(), { recurse: true });
      con.log("Success!");
      return;

    case "popupOpened":
      sortLock.notify();
      return sortConf.conf;
  }
});
