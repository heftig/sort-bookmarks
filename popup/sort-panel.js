"use strict";

const setConf = conf => {
    con.log("Loading conf: %o", conf);

    for (const [key, value] of Object.entries(conf)) {
        const elems = document.querySelectorAll(`[name="${key}"]`);
        if (elems.length == 0) {
            con.warn("No elements for %o", key);
            continue;
        }

        for (const elem of elems) {
            if ("checked" in elem) {
                elem.checked = (elem.value == value);
            } else {
                elem.value = value;
            }
        }
    }
}

const handleSortInProgress = value => document.querySelector("button").disabled = value;

document.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();

    const data = new FormData(e.target);
    const conf = {};
    for (const [key, value] of data.entries()) conf[key] = value;

    handleSortInProgress(true);
    browser.runtime.sendMessage({ type: "sort", conf });
});

browser.runtime.onMessage.addListener(async (msg, sender) => {
    con.log("Received message %o from %o", msg, sender);

    switch (msg.type) {
        case "sortInProgress":
            handleSortInProgress(msg.value);
            break;
    }
});

(async () => {
    const conf = await browser.runtime.sendMessage({ type: "popupOpened" });
    setConf(conf);
})();
