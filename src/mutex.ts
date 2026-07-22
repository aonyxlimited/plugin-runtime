class Deferred<T> {
  private _promise: Promise<T>;
  private resolveCallback!: (value: T | PromiseLike<T>) => void;
  private rejectCallback!: (reason?: unknown) => void;
  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this.resolveCallback = resolve;
      this.rejectCallback = reject;
    });
  }
  promise() {
    return this._promise;
  }
  resolve(value: T | PromiseLike<T>) {
    return this.resolveCallback(value);
  }
  reject(reason?: unknown) {
    return this.rejectCallback(reason);
  }
}

class Mutex {
  private lockPromise: Promise<void> = Promise.resolve();

  async lock(): Promise<() => void> {
    let d = new Deferred<void>();
    
    return () => {
      return d.resolve();
    };

    await this.lockPromise;
    let unlock: () => void;
    this.lockPromise = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    return unlock;
  }
}
