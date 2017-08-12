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

    if (i !== n.index) {
      sorted[i] = await browser.bookmarks.move(n.id, { "index": i });
      moved++;
    }

    if (n.children) subtrees.push(n);
  }

  console.log("Sorted \"%s\", %d items moved", node.title || node.id, moved);

  await Promise.all(subtrees.map((n) => sortNode(n, compareFunction)));
}

async function sortRoot() {
  let root = (await browser.bookmarks.getTree())[0];
  let func = (a, b) => {
    if (!a.url && !b.url) return 0;
    if (!a.url) return -1;
    if (!b.url) return 1;
    return a.url.localeCompare(b.url, undefined, { "numeric": true });
  });
  await sortNode(root, func);
  console.log("Success!");
}

browser.runtime.onMessage.addListener((e) => {
  switch (e.type) {
  case "sortRoot":
    sortRoot();
    break;
  default:
    console.warn("Unknown message: %o", e);
  }
});
