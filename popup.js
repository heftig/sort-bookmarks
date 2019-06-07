import {handle, send} from "/message.js";
import con from "/console.js";

const submitButtons = document.querySelectorAll("button");
let savedNode;

document.getElementById("sort-form").addEventListener("submit", e => {
    e.preventDefault();

    const data = new FormData(e.target);
    const conf = {};
    for (const [key, value] of data.entries()) conf[key] = value;

    for (const b of submitButtons) b.disabled = true;
    send("sort", {node: savedNode, conf});
});

document.getElementById("reset-form").addEventListener("submit", e => {
    e.preventDefault();
    send("sort", {node: savedNode});
});

handle({
    sortInProgress(value) {
        for (const b of submitButtons) b.disabled = value;
    },
});

(async () => {
    const {node, conf} = await send("popupOpened");
    con.log("Loading:", conf, node);

    if (node) {
        const context = document.getElementById("context");
        context.textContent = `Sorting "${node.title || node.id}"`;

        for (const elem of document.getElementsByClassName("node-specific")) {
            elem.style.display = "block";
        }

        savedNode = node;
    }

    for (const [key, value] of Object.entries(conf)) {
        const elems = document.querySelectorAll(`[name="${key}"]`);
        if (elems.length === 0) {
            con.warn("No matching elements:", key);
            continue;
        }

        for (const elem of elems) {
            if ("checked" in elem) elem.checked = elem.value === value;
            else elem.value = value;
        }
    }
})();
