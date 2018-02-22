"use strict";

const asyncMap = async (array, asyncFunc, { concurrency = 4 } = {}) => {
  const results = new array.constructor(arr.length), running = new Set();

  for (const {index, value} of array.entries()) {
    if (running.size >= concurrency) await Promise.race(running);

    const promise = (async () => {
      results[index] = await asyncFunc(value);
      running.delete(promise);
    })();

    running.add(promise);
  }

  await Promise.all(running);
  return results;
}

async function *lazyAsyncMap (iterable, asyncFunc, { concurrency = 4 } = {}) {
  const promises = [];

  for (const value of iterable) {
    if (promises.length >= concurrency) {
      let result = await promises.shift();
      promises.push(asyncFunc(value));
      yield result;
    } else {
      promises.push(asyncFunc(value));
    }
  }

  for (const promise of promises) yield await promise;
}
