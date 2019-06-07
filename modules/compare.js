import * as util from "./util.js";

const stringCompare = (a, b) => a.localeCompare(b, undefined, {numeric: true});

const reverse = func => (a, b) => -func(a, b);
const compose = (func, fallback) => (a, b) => func(a, b) || fallback(a, b);

// Node comparison functions
const byIndex = (a, b) => a.index - b.index;
const byTitle = (a, b) => stringCompare(a.title, b.title);
const byURL = (a, b) => a.url && b.url ? stringCompare(a.url, b.url) : 0;
const byDateAdded = (a, b) => a.dateAdded && b.dateAdded ? a.dateAdded - b.dateAdded : 0;

const foldersFirst = (a, b) => util.isFolder(b) - util.isFolder(a);
const foldersLast = reverse(foldersFirst);

export default function makeCompareFunction(spec) {
    // Be stable as the base case
    let func = byIndex;

    let {[spec.by]: byFunc} = {
        nothing:      undefined,
        title:        byTitle,
        url:          byURL,
        "date-added": byDateAdded,
    };

    if (byFunc) {
        if (spec.reversed) byFunc = reverse(byFunc);
        func = compose(byFunc, func);
    }

    const {[spec.folders]: foldersFunc} = {
        first: foldersFirst,
        last:  foldersLast,
    };

    if (foldersFunc) func = compose(foldersFunc, func);

    return func;
}
