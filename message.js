import con from "/console.js";

const {runtime} = browser;

export function send(type, value = undefined) {
    return runtime.sendMessage({type, value});
}

export function handle(handler) {
    runtime.onMessage.addListener(({type, value}, {url}) => {
        con.log("Received message %s(%o) from %s", type, value, url);

        const {[type]: func} = handler;
        return Promise.resolve(func ? func(value) : undefined);
    });
}
