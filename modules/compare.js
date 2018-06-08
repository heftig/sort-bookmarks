import * as util from "./util.js";

const stringCompare = (a, b) => a.localeCompare(b, undefined, { "numeric": true });

// Node comparison functions
const byIndex = (a, b) => a.index - b.index;
const byTitle = (a, b) => stringCompare(a.title, b.title);
const byURL = (a, b) => a.url && b.url ? stringCompare(a.url, b.url) : 0;
const byDateAdded = (a, b) => a.dateAdded && b.dateAdded ? a.dateAdded - b.dateAdded : 0;
const foldersFirst = (a, b) => util.isFolder(b) - util.isFolder(a);

const reverse = func => (a, b) => -func(a, b);
const compose = (func, fallback) => (a, b) => func(a, b) || fallback(a, b);

export default function makeCompareFunction(spec) {
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
