import type SigmaRust from "ergo-lib-wasm-browser";

type SigmaRustType = typeof SigmaRust;
class WasmLoader {
  private _sigmaRust?: SigmaRustType;

  public async loadAsync(): Promise<void> {
    this._sigmaRust = await import("ergo-lib-wasm-browser");
  }

  public get SigmaRust(): SigmaRustType {
    if (!this._sigmaRust) {
      throw new Error("sigma-rust not loaded");
    }

    return this._sigmaRust;
  }
}

export const WasmModule = new WasmLoader();
