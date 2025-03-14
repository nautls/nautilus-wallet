import { AssetBalance } from "@/stores/walletStore";

export { default as AssetInputSelect } from "./AssetInputSelect.vue";

export interface Asset extends AssetBalance {
  disabled?: boolean;
}
