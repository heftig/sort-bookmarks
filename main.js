"use strict";

async function sortNode(node, compareFunction) {
  if (node.unmodifiable) {
    console.log("Unmodifiable node: %o", node);
    return;
  }

  let sorted = node.children.slice().sort(compareFunction);
  let moved = 0, len = sorted.length, subtrees = [];

  for (let i = 0; i < len; i++) {
    let n = sorted[i];

    if (i !== n.index + moved) {
      await browser.bookmarks.move(n.id, { "index": i });
      moved++;
    }

    if (n.children) subtrees.push(n);
  }

  if (moved) console.log("Sorted \"%s\", %d items moved", node.title || node.id, moved);

  await Promise.all(subtrees.map((n) => sortNode(n, compareFunction)));
}

var sortInProgress = false;

function setSortInProgress(value=sortInProgress) {
  console.log("Sort in progress: %o", value);
  sortInProgress = value;
  browser.runtime.sendMessage({ type: "sortInProgress", value: value });
}

async function sortRoot(spec) {
  let root = (await browser.bookmarks.getTree())[0];
  let func = makeCompareFunction(spec);

  try {
    setSortInProgress(true);
    await sortNode(root, func);
  } finally {
    setSortInProgress(false);
  }

  console.log("Success!");
}

browser.runtime.onMessage.addListener((e) => {
  console.log("Received message: %o", e);

  switch (e.type) {
    case "sortRoot":
      if (sortInProgress) throw "Sort already in progress!";
      sortRoot(e.spec);
      break;
    case "querySortInProgress":
      setSortInProgress();
      break;
  }
});

console.log("Loaded main.js");
