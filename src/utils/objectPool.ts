import Bip32 from "@/api/ergo/bip32";
import { find, findIndex } from "lodash";

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
      item.object = object;
    } else {
      const index = findIndex(this._pool, item => !item.alive);

      if (index > -1) {
        this._pool[index].object = object;
        this._pool[index].key = key;
        this._pool[index].alive = true;
      }
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

    if (!item.alive) {
      throw Error("object is not alive");
    }

    return item.object;
  }

  public getPoolItem(key: KeyType): PoolItem<ObjectType, KeyType> | undefined {
    return find(this._pool, item => item.key === key);
  }
}

export const bip32Pool = new ObjectPool<Bip32, string>();
