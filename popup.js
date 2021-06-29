import con, {init as initCon} from "/console.js";
import {handle, remote} from "/message.js";

const submitButtons = document.querySelectorAll("button");
let forId = null;

document.getElementById("sort-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const data = new FormData(e.target);
    const conf = {};
    for (const [key, value] of data.entries()) conf[key] = value;

    for (const b of submitButtons) b.disabled = true;
    remote.sort(forId, conf);
});

document.getElementById("reset-form").addEventListener("submit", (e) => {
    e.preventDefault();
    remote.sort(forId, null);
});

handle({
    sortInProgress(value) {
        for (const b of submitButtons) b.disabled = value;
    },
});

(async () => {
    await initCon();

    const {conf, node} = await remote.popupOpened();
    con.log("Loaded config:", conf);

    if (node) {
        con.log("Node-specific:", node);

        const {id, title} = node;

        const context = document.getElementById("context");
        context.textContent = `Sorting "${title || id}"`;

        const elems = document.getElementsByClassName("node-specific");
        for (const elem of elems) elem.style.display = "block";

        forId = id;
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
