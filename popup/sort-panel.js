"use strict";

async function persistElements(elements) {
  let stor = browser.storage.sync;
  let keys = elements.map((e) => `popupForm-${e.name}`);
  let len = elements.length;

  console.log("Elements to persist: %o\nKeys: %o", elements, keys);

  let values = await stor.get(keys);

  console.log("Loaded values: %o", values);

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
      console.log("Persisting %s = %o", key, value);
      await stor.set({ [key]: value });
    });
  }
}

persistElements(Array.from(document.querySelectorAll(".persisted")));

document.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();

  let data = new FormData(e.target);
  let spec = {};
  for (let [key, value] of data.entries()) spec[key] = value;

  browser.runtime.sendMessage({ "type": "sortRoot", "spec": spec });
});

console.log("Loaded sort-panel.js");
