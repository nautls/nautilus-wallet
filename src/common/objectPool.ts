import HdKey from "@/chains/ergo/hdKey";

class ObjectPool<K, V> {
  #pool: Map<K, V>;

  constructor() {
    this.#pool = new Map();
  }

  public alloc(key: K, object: V): V {
    this.#pool.set(key, object);
    return object;
  }

  public free(key: K): boolean {
    return this.#pool.delete(key);
  }

  public get(key: K): V {
    const object = this.#pool.get(key);
    if (!object) throw Error(`Object with key ${key} not found in pool`);
    return object;
  }
}

export const hdKeyPool = new ObjectPool<string, HdKey>();
