"use strict";

const bookmarksTree = (() => {
  const bookmarks = browser.bookmarks;
  const history = browser.history;

  let trackingEnabled = false;
  let historyEnabled = false;

  const historyByUrl = new Map();
  const idsByUrl = new Map();
  const urlById = new Map();
  const parentById = new Map();

  const getHistory = async url => {
    // FIXME: getVisits gives us a lot more information than we need,
    // but there is no API to get a HistoryItem for an exact URL
    const visits = await history.getVisits({ url });

    // Fake a HistoryItem
    return {
      id: null,
      url,
      visitCount: visits.length,
      lastVisitTime: visits.length > 0 ? visits[0].visitTime : 0
    };
  };

  const addUrl = async (id, url) => {
    urlById.set(id, url);
    const set = idsByUrl.get(url);
    if (set) {
      set.add(id);
    } else {
      idsByUrl.set(url, new Set([id]));
    }

    if (!historyByUrl.has(url)) {
      historyByUrl.set(url, await getHistory(url));
    }
  };

  const removeUrl = (id, url) => {
    let keep = false;

    urlById.delete(id);

    const set = idsByUrl.get(url);
    if (set) {
      set.delete(id);
      if (set.size > 0) keep = true;
    }

    if (!keep) {
      historyByUrl.delete(url);
      idsByUrl.delete(url);
    }
  };

  const trackNode = async node => {
    const id = node.id;

    parentById.set(id, node.parentId);

    if (historyEnabled) {
      const url = node.url, oldUrl = urlById.get(id);
      if (url !== oldUrl) {
        if (oldUrl) removeUrl(id, oldUrl);
        if (url) await addUrl(id, url);
      }
    }
  };

  const untrackNode = id => {
    parentById.delete(id);

    if (historyEnabled) {
      const url = urlById.get(id);
      if (url) removeUrl(id, url);
    }
  };

  const clearCache = () => {
    historyByUrl.clear();
    idsByUrl.clear();
    urlById.clear();
    parentById.clear();
  };

  const augmentNode = async node => {
    if (trackingEnabled) await trackNode(node);

    if (historyEnabled && node.url) {
      const url = node.url;
      let item = historyByUrl.get(url);
      if (!item) item = await getHistory(url);
      node.visitCount = item.visitCount;
      node.lastVisitTime = item.lastVisitTime;
    }

    if (node.children) {
      await Promise.all(node.children.map(c => augmentNode(c)));
    }
  };

  const onChanged = new Set();
  const emitChanged = id => { for (const func of onChanged) func(id); };

  const bookmarksListeners = new Map([
    [bookmarks.onCreated, async (id, node) => {
      con.log("Node created: %o", node);
      await trackNode(node);
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
      await trackNode(node);
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

  const historyListeners = new Map([
    [history.onVisited, async item => {
      const url = item.url;
      if (!historyByUrl.has(url)) return;

      historyByUrl.set(url, item);

      const ids = idsByUrl.get(url), parents = new Set();
      for (const id of ids) {
        con.log("Node visited: %o", id);
        parents.add(parentById.get(id));
      }

      for (const p of parents) emitChanged(p);
    }],

    [history.onVisitRemoved, info => {
      if (info.allHistory) {
        con.log("All history removed");
        historyByUrl.clear();
      } else {
        const urls = info.urls;
        con.log("Visits removed: %o", urls);
        for (const url of urls) historyByUrl.delete(url);
      }
    }],
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
        if (historyEnabled) addListeners(historyListeners);
      } else {
        removeListeners(bookmarksListeners);
        if (historyEnabled) removeListeners(historyListeners);
      }

      con.log("Bookmarks tracking %s", value ? "enabled" : "disabled");
      trackingEnabled = value;
      clearCache();
    },

    get historyEnabled() { return historyEnabled; },
    set historyEnabled(value) {
      if (historyEnabled == value) return;
      value = !!value;

      if (value) {
        if (trackingEnabled) addListeners(historyListeners);
      } else {
        if (trackingEnabled) removeListeners(historyListeners);
      }

      con.log("History augmentation %s", value ? "enabled" : "disabled");
      historyEnabled = value;
      clearCache();
    }
  };
})();
