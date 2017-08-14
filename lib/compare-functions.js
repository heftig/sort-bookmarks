"use strict";

var makeCompareFunction;

(function() {
  function stringCompare(a, b) {
    return a.localeCompare(b, undefined, { "numeric": true });
  }

  function byIndex(a, b) {
    return a.index - b.index;
  }

  function byTitle(a, b) {
    return stringCompare(a.title, b.title);
  }

  function byURL(a, b) {
    if (!a.url || !b.url) return 0;
    return stringCompare(a.url, b.url);
  }

  function byDateAdded(a, b) {
    if (!a.dateAdded || !b.dateAdded) return 0;
    return a.dateAdded - b.dateAdded;
  }

  function foldersFirst(a, b) {
    let aBookmark = "url" in a, bBookmark = "url" in b;
    return aBookmark - bBookmark;
  }

  function reverse(func) {
    return (a, b) => -func(a, b);
  }

  function compose(func, fallback) {
    return (a, b) => {
      let res = func(a, b);
      if (res) return res;
      return fallback(a, b);
    }
  }

  makeCompareFunction = function(spec) {
    // Be stable as the base case
    let func = byIndex;

    // Always sort by title, as it's not optional
    // and e.g. folders have no URL
    if (spec.by != "title") {
      func = compose(byTitle, func);
    }

    let byFunc = {
      "title": byTitle,
      "url": byURL,
      "date-added": byDateAdded
    }[spec.by];

    if (byFunc) {
      if (spec.reversed) byFunc = reverse(byFunc);
      func = compose(byFunc, func);
    }

    switch (spec.folders) {
      case "first":
        func = compose(foldersFirst, func);
        break;

      case "last":
        func = compose(reverse(foldersFirst), func);
        break;
    }

    return func;
  }
})();
