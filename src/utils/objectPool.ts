import Bip32 from "@/api/ergo/bip32";

type PoolItem<ObjectType, Key> = {
  key: Key;
  object: ObjectType;
  alive: boolean;
};

class ObjectPool<ObjectType, KeyType> {
  private _pool: PoolItem<ObjectType, KeyType>[];

  constructor() {
    this._pool = [];
  }

  public alloc(object: ObjectType, key: KeyType): ObjectType {
    const item = this.getPoolItem(key);
    if (item) {
      item.alive = true;
    } else {
      this._pool.push({ key, object, alive: true });
    }

    return object;
  }

  public free(key: KeyType): void {
    const item = this.getPoolItem(key);
    if (!item) {
      return;
    }

    item.alive = false;
  }

  public get(key: KeyType): ObjectType {
    const item = this.getPoolItem(key);
    if (!item) {
      throw Error("object not found");
    }

    if (!item) {
      throw Error("object not alive");
    }

    return item.object;
  }

  public getPoolItem(key: KeyType): PoolItem<ObjectType, KeyType> | undefined {
    for (let i = 0; i < this._pool.length; i++) {
      if (this._pool[i].key === key) {
        return this._pool[i];
      }
    }
  }
}

export const bip32Pool = new ObjectPool<Bip32, string>();
