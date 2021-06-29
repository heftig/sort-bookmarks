import con from "/console.js";

const {bookmarks} = browser;

export async function getAll() {
    const [node] = await bookmarks.getTree();
    return node;
}

export async function getNode(id) {
    const [node] = await bookmarks.get(id);
    if (!node.children) node.children = await bookmarks.getChildren(id);
    return node;
}

export async function findAncestor(id, predicate) {
    while (id) {
        const [node] = await bookmarks.get(id);
        if (predicate(node)) return node;
        ({parentId: id} = node);
    }
    return undefined;
}

export async function exists(id) {
    try {
        const [_node] = await bookmarks.get(id);
        return true;
    } catch (_e) {
        return false;
    }
}

export function move(id, destination) {
    return bookmarks.move(id, destination);
}

export const onChanged = new Set();

function emitChanged(id) {
    for (const func of onChanged) func(id);
}

const bookmarksListeners = new Map([
    [
        bookmarks.onCreated,
        (_id, node) => {
            con.log("Node created:", node);
            emitChanged(node.parentId);
        },
    ],

    [
        bookmarks.onRemoved,
        (_id, node) => {
            con.log("Node removed:", node);
            emitChanged(node.parentId);
        },
    ],

    [
        bookmarks.onChanged,
        async (id, _changeInfo) => {
            const [node] = await bookmarks.get(id);
            if (!node) return;

            con.log("Node changed:", node);
            emitChanged(node.parentId);
        },
    ],

    [
        bookmarks.onMoved,
        (id, info) => {
            // FIXME: This gets fired when we move bookmarks.
            // I don't think it's guaranteed that we see the event before we "exit" the node,
            // so reacting to moves within a folder may lead to infinite looping.
            if (info.parentId === info.oldParentId) return;

            con.log("Node moved:", id);
            emitChanged(info.parentId);
        },
    ],
]);

let tracking = false;

export async function setTracking(value) {
    if (tracking === value) return;
    value = !!value;

    if (value) for (const [ev, l] of bookmarksListeners.entries()) ev.addListener(l);
    else for (const [ev, l] of bookmarksListeners.entries()) ev.removeListener(l);

    con.log("Bookmarks tracking %s", value ? "enabled" : "disabled");
    tracking = value;
}
