"use strict";

function setConf(conf) {
  con.log("Loading conf: %o", conf);

  for (let key in conf) {
    let value = conf[key];

    let elems = document.querySelectorAll(`[name="${key}"]`);
    if (elems.length == 0) {
      con.warn("No elements for %o", key);
      continue;
    }

    for (let elem of elems) {
      if ("checked" in elem) {
        elem.checked = (elem.value == value);
      } else {
        elem.value = value;
      }
    }
  }
}

function handleSortInProgress(value) {
  document.querySelector("button").disabled = value;
}

document.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();

  let data = new FormData(e.target);
  let conf = {};
  for (let [key, value] of data.entries()) conf[key] = value;

  handleSortInProgress(true);
  browser.runtime.sendMessage({ "type": "sort", "conf": conf });
});

browser.runtime.onMessage.addListener((e) => {
  con.log("Received message: %o", e);

  switch (e.type) {
    case "sortInProgress":
      handleSortInProgress(e.value);
      break;
  }
});

(async function() {
  let conf = await browser.runtime.sendMessage({ "type": "popupOpened" });
  setConf(conf);
})();
