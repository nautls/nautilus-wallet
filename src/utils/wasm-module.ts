import type SigmaRust from "ergo-lib-wasm-browser";

type SigmaRustType = typeof SigmaRust;
class WasmLoader {
  private _sigmaRust?: SigmaRustType;
  private _loaded = false;

  public async loadAsync(): Promise<void> {
    this._sigmaRust = await import("ergo-lib-wasm-browser");
    this._loaded = true;
  }

  public get loaded(): boolean {
    return this._loaded;
  }

  public get SigmaRust(): SigmaRustType {
    if (!this._sigmaRust) {
      throw new Error("sigma-rust not loaded");
    }

    return this._sigmaRust;
  }
}

export const wasmModule = new WasmLoader();
