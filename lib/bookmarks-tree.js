"use strict";

const bookmarksTree = (() => {
  const bookmarks = browser.bookmarks;

  let trackingEnabled = false;

  const parentById = new Map();

  const trackNode = node => parentById.set(node.id, node.parentId);
  const untrackNode = id => parentById.delete(id);
  const clearCache = () => parentById.clear();

  const augmentNode = async node => {
    if (trackingEnabled) trackNode(node);
    if (node.children) await Promise.all(node.children.map(c => augmentNode(c)));
  };

  const onChanged = new Set();
  const emitChanged = id => { for (const func of onChanged) func(id); };

  const bookmarksListeners = new Map([
    [bookmarks.onCreated, (id, node) => {
      con.log("Node created: %o", node);
      trackNode(node);
      emitChanged(node.parentId);
    }],

    [bookmarks.onRemoved, (id, node) => {
      con.log("Node removed: %o", node);
      untrackNode(id);
      emitChanged(node.parentId);
    }],

    [bookmarks.onChanged, async (id, changeInfo) => {
      const node = (await bookmarks.get(id))[0];
      if (!node) return;

      con.log("Node changed: %o", node);
      trackNode(node);
      emitChanged(node.parentId);
    }],

    [bookmarks.onMoved, (id, info) => {
      // FIXME: This gets fired when we move bookmarks.
      // I don't think it's guaranteed that we see the event before we "exit" the node,
      // so reacting to moves within a folder may lead to infinite looping.
      if (info.parentId == info.oldParentId) return;

      con.log("Node moved: %o", id);
      parentById.set(id, info.parentId);
      emitChanged(info.parentId);
    }]
  ]);

  const addListeners = map => { for (const [ev, l] of map.entries()) ev.addListener(l); };
  const removeListeners = map => { for (const [ev, l] of map.entries()) ev.removeListener(l); };

  return {
    onChanged,

    async getRoot() {
      const node = (await bookmarks.getTree())[0];
      await augmentNode(node);
      return node;
    },

    async getNode(id) {
      const node = (await bookmarks.get(id))[0];
      if (!node.children) node.children = await bookmarks.getChildren(id);
      await augmentNode(node);
      return node;
    },

    get trackingEnabled() { return trackingEnabled; },
    set trackingEnabled(value) {
      if (trackingEnabled == value) return;
      value = !!value;

      if (value) {
        addListeners(bookmarksListeners);
      } else {
        removeListeners(bookmarksListeners);
      }

      con.log("Bookmarks tracking %s", value ? "enabled" : "disabled");
      trackingEnabled = value;
      clearCache();
    }
  };
})();
