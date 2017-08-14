"use strict";

async function persistElements(elements) {
  let stor = browser.storage.sync;
  let keys = elements.map((e) => `popupForm-${e.name}`);
  let len = elements.length;

  con.log("Elements to persist: %o\nKeys: %o", elements, keys);

  let values = await stor.get(keys);

  con.log("Loaded values: %o", values);

  for (let i = 0; i < len; i++) {
    let elem = elements[i], key = keys[i];

    if (key in values) {
      if ("checked" in elem) {
        elem.checked = (elem.value == values[key]);
      } else {
        elem.value = values[key];
      }
    }

    elem.addEventListener("change", async (e) => {
      let value = e.target.value;
      if ("checked" in e.target && !e.target.checked) value = null;
      con.log("Persisting %s = %o", key, value);
      await stor.set({ [key]: value });
    });
  }
}

persistElements(Array.from(document.querySelectorAll(".persisted")));

function handleSortInProgress(value) {
  document.querySelector("button").disabled = value;
}

document.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();

  let data = new FormData(e.target);
  let spec = {};
  for (let [key, value] of data.entries()) spec[key] = value;

  handleSortInProgress(true);
  browser.runtime.sendMessage({ "type": "sortRoot", "spec": spec });
});

browser.runtime.onMessage.addListener((e) => {
  con.log("Received message: %o", e);

  switch (e.type) {
    case "sortInProgress":
      handleSortInProgress(e.value);
      break;
  }
});

browser.runtime.sendMessage({ "type": "popupOpened" });
