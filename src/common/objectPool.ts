import HdKey from "@/api/ergo/hdKey";

type PoolItem<ObjectType, Key> = {
  key: Key;
  object: ObjectType;
  alive: boolean;
};

class ObjectPool<ObjectType, KeyType> {
  #pool: PoolItem<ObjectType, KeyType>[];

  constructor() {
    this.#pool = [];
  }

  public alloc(object: ObjectType, key: KeyType): ObjectType {
    const item = this.getPoolItem(key);
    if (item) {
      item.alive = true;
      item.object = object;
    } else {
      const index = this.#pool.findIndex((item) => !item.alive);

      if (index > -1) {
        this.#pool[index].object = object;
        this.#pool[index].key = key;
        this.#pool[index].alive = true;
      }
      this.#pool.push({ key, object, alive: true });
    }

    return object;
  }

  public free(key: KeyType): void {
    const item = this.getPoolItem(key);
    if (!item) return;

    item.alive = false;
  }

  public get(key: KeyType): ObjectType {
    const item = this.getPoolItem(key);
    if (!item) throw Error("object not found");
    if (!item.alive) throw Error("object is not alive");

    return item.object;
  }

  public getPoolItem(key: KeyType): PoolItem<ObjectType, KeyType> | undefined {
    return this.#pool.find((item) => item.key === key);
  }
}

export const hdKeyPool = new ObjectPool<HdKey, string>();
