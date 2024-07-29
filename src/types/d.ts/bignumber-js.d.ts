import type { BigNumber as _BigNumber } from "bignumber.js";

declare module "bignumber.js" {
  interface BigNumber extends _BigNumber {
    /** Used internally to identify a BigNumber instance.
     * Marked as optional here to avoid type inconsistences
     * */
    readonly _isBigNumber?: true;
  }
}
