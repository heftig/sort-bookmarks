import con from "/console.js";

const {runtime} = browser;

export const remote = new Proxy({}, {
    get(_target, property, _receiver) {
        return (...args) => runtime.sendMessage({method: property, args});
    },
});

export function handle(handler) {
    runtime.onMessage.addListener(({method, args}, _sender) => {
        con.log("Received %s%s", method, args.length ? ":" : "", ...args);

        const {[method]: func} = handler;
        return Promise.resolve(func ? func(...args) : undefined);
    });
}
