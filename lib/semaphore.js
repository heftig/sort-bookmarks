class Semaphore {
  constructor(size) {
    this.size = size;
    this.waiters = new Set();
  }

  async acquire() {
    if (!this.size) await new Promise((resolve, reject) => this.waiters.add(resolve));
    size--;
  }

  release() {
    size++;
    let {value, done} = this.waiters[Symbol.iterator]().next();
    if (!done) {
      value();
      this.waiters.delete(value);
    }
  }

  async guard(asyncFunc) {
    await this.acquire();
    try {
      return await asyncFunc();
    } finally {
      this.release();
    }
  }
}
