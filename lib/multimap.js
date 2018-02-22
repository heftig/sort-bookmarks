"use strict";

class MultiMap extends Map {
  constructor(iterable) {
    super();
    for (const [key, ...values] of iterable) this.add(key, ...values);
  },

  set(key, ...values) {
    const set = super.get(key);
    if (!set) return super.set(key, new Set(values));

    set.clear();
    for (const value of values) set.add(value);
    return this;
  },

  add(key, ...values) {
    const set = super.get(key);
    if (!set) return super.set(key, new Set(values));

    for (const value of values) set.add(value);
    return this;
  },

  remove(key, ...values) {
    const set = super.get(key);
    if (set) {
      for (const value of values) set.delete(value);
      if (set.size == 0) super.delete(key);
    }
  },

  get(key) {
    const set = super.get(key);
    for (const value of set) return value;
    return undefined;
  },

  getAll(key) {
    return super.get(key);
  },

  *values() {
    for (const set of super.values()) yield* set.values();
  },

  *entries() {
    for (const [key, set] of super.entries()) {
      for (const value of set) yield [key, value];
    }
  },

  forEach(callbackFn, thisArg = undefined) {
    for ([key, set] of super.entries()) {
      for (value of set) callbackFn.apply(thisArg, key, value);
    }
  }
}
