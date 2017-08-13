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

async function sortRoot(spec) {
  let root = (await browser.bookmarks.getTree())[0];
  let func = makeCompareFunction(spec);
  await sortNode(root, func);
  console.log("Success!");
}

browser.runtime.onMessage.addListener((e) => {
  console.log("Received message: %o", e);

  switch (e.type) {
    case "sortRoot":
      sortRoot(e.spec);
      break;
  }
});

console.log("Loaded main.js");
