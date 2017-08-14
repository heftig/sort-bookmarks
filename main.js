"use strict";

// XXX: Separators currently exist as invisible nodes that result in index jumps.
// This logic here will break horribly if separators ever become actual nodes.
function sliceAndSort(arr, compareFunction) {
  let sorted = [], sortSlice = (start, end) => sorted.push({
    start: arr[start].index,
    items: arr.slice(start, end).sort(compareFunction)
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

async function sortNode(node, compareFunction) {
  if (node.unmodifiable) {
    con.log("Unmodifiable node: %o", node);
    return;
  }

  if (node.url) {
    con.log("Not a folder: %o", node);
    return;
  }

  let children = node.children || await browser.bookmarks.getChildren(node.id);
  let subtrees = [];

  for (let {start, items} of sliceAndSort(children, compareFunction)) {
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

  await Promise.all(subtrees.map((n) => sortNode(n, compareFunction)));
}

var sortInProgress = false;

function setSortInProgress(value=sortInProgress) {
  con.log("Sort in progress: %o", value);
  sortInProgress = value;
  browser.runtime.sendMessage({ type: "sortInProgress", value: value });
}

async function sortRoot(conf) {
  let root = (await browser.bookmarks.getTree())[0];
  let func = makeCompareFunction(conf);

  try {
    setSortInProgress(true);
    await sortNode(root, func);
  } finally {
    setSortInProgress(false);
  }

  con.log("Success!");
}

browser.runtime.onMessage.addListener((e) => {
  con.log("Received message: %o", e);

  switch (e.type) {
    case "sort":
      if (sortInProgress) throw "Sort already in progress!";
      sortRoot(e.conf);
      return;

    case "popupOpened":
      setSortInProgress();
      return;
  }
});
