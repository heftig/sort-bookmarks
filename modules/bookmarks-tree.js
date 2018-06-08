import con from "./con.js";

const bookmarks = browser.bookmarks;

let trackingEnabled = false;

const onChanged = new Set();

function emitChanged(id) {
    for (const func of onChanged) func(id);
}

const bookmarksListeners = new Map([
    [bookmarks.onCreated, (id, node) => {
        con.log("Node created: %o", node);
        emitChanged(node.parentId);
    }],

    [bookmarks.onRemoved, (id, node) => {
        con.log("Node removed: %o", node);
        emitChanged(node.parentId);
    }],

    [bookmarks.onChanged, async (id, changeInfo) => {
        const node = (await bookmarks.get(id))[0];
        if (!node) return;

        con.log("Node changed: %o", node);
        emitChanged(node.parentId);
    }],

    [bookmarks.onMoved, (id, info) => {
        // FIXME: This gets fired when we move bookmarks.
        // I don't think it's guaranteed that we see the event before we "exit" the node,
        // so reacting to moves within a folder may lead to infinite looping.
        if (info.parentId == info.oldParentId) return;

        con.log("Node moved: %o", id);
        emitChanged(info.parentId);
    }]
]);

function addListeners(map) {
    for (const [ev, l] of map.entries()) ev.addListener(l);
}

function removeListeners(map) {
    for (const [ev, l] of map.entries()) ev.removeListener(l);
}

const bookmarksTree = {
    onChanged,

    async getRoot() {
        const node = (await bookmarks.getTree())[0];
        return node;
    },

    async getNode(id) {
        const node = (await bookmarks.get(id))[0];
        if (!node.children) node.children = await bookmarks.getChildren(id);
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
    }
};

export default bookmarksTree;
