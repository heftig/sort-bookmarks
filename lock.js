import con from "/console.js";
import {send} from "/message.js";

const sorts = new Map();

export async function notify() {
    try {
        await send("sortInProgress", sorts.size > 0);
    } catch (_e) {
        // FIXME: Ignore; popup frame might not exist
    }
}

// Wait for a previous sort to complete
export async function wait(id) {
    let promise = sorts.get(id);

    if (promise) {
        con.log("Waiting on:", id, promise);
        await promise;
        promise = sorts.get(id);
    }

    return !!promise;
}

export async function run(id, asyncFunc) {
    if (sorts.has(id)) throw new Error(`Already sorting ${id}`);

    // XXX: Safety valve
    if (sorts.size >= 10000) throw new Error("Too many concurrent sorts");

    const promise = asyncFunc();
    sorts.set(id, promise);

    try {
        if (sorts.size === 1) notify();
        await promise;
    } finally {
        sorts.delete(id);
        if (sorts.size === 0) notify();
    }
}
