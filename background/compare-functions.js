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
    let aFolder = "children" in a, bFolder = "children" in b;
    return bFolder - aFolder;
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

  makeCompareFunction = function() {
    return compose(foldersFirst, compose(byURL, compose(byTitle, byIndex)));
  }
})();

console.log("Loaded compare-functions.js");
