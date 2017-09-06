"use strict";

const timedRun = async (func) => {
  if (!debugMode) return await func();
  let t = performance.now();
  const res = await func();
  t = performance.now() - t;
  con.log("Completed in %.3fs", t / 1000);
  return res;
}

const sliceAndSort = arr => {
  let sliceStart = arr.findIndex(node => !isSeparator(node));
  if (sliceStart < 0) return [];

  const sorted = [], sortSlice = (start, end) => {
    if (start < end) sorted.push({
      start: arr[start].index,
      items: arr.slice(start, end).sort(sortConf.func)
    });
  };

  const len = arr.length;
  for (let i = sliceStart + 1; i < len; i++) {
    const node = arr[i];

    if (isSeparator(node)) {
      // Nightly 57
      con.log("Found a separator at %d: %o", i, node);
      sortSlice(sliceStart, i);
      sliceStart = i + 1;
    } else if (arr[i - 1].index + 1 != node.index) {
      // Pre-57, separators leave gaps
      con.log("Found a separator before %d", i);
      sortSlice(sliceStart, i);
      sliceStart = i;
    }
  }

  // Sort last slice
  sortSlice(sliceStart, len);

  return sorted;
}

const sortNode = async (node, options = {}) => {
  const {recurse = false} = options;

  if (node.unmodifiable) {
    con.log("Unmodifiable node: %o", node);
    return;
  }

  if (!isFolder(node)) {
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
    const subtrees = [];

    for (const {start, items} of sliceAndSort(node.children)) {
      let moved = 0;

      for (const [i, n] of items.entries()) {
        const index = start + i;

        if (index !== n.index + moved) {
          await browser.bookmarks.move(n.id, { index });
          moved++;
        }

        if (n.children) subtrees.push(n);
      }

      if (moved) {
        con.log("Sorted \"%s\", slice %d..%d, %d items moved",
          node.title || node.id, start, start + items.length, moved);
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

bookmarksTree.onChanged.add(async id => await timedRun(async () => await autoSort(await bookmarksTree.getNode(id))));

sortConf.onUpdate.add(async () => {
  bookmarksTree.trackingEnabled = !!sortConf.conf.autosort;

  await timedRun(async () => await autoSort(await bookmarksTree.getRoot(), { recurse: true }));
});

browser.runtime.onMessage.addListener(async e => {
  con.log("Received message: %o", e);

  switch (e.type) {
    case "sort":
      if (!sortConf.set(e.conf) || !sortConf.conf.autosort) {
        await timedRun(async () => await sortNode(await bookmarksTree.getRoot(), { recurse: true }));
      }
      return;

    case "popupOpened":
      sortLock.notify();
      return sortConf.conf;
  }
});
