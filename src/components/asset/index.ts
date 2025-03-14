import { cva, type VariantProps } from "class-variance-authority";

export const assetSignIconVariants = cva(
  "border-accent bg-accent size-5 min-w-5 rounded-full border p-0.5",
  {
    variants: {
      variant: {
        positive: "text-green-600 dark:text-green-400",
        negative: "text-red-600 dark:text-red-400",
        equal: "text-muted-foreground",
        swap: "",
        burn: "border-none bg-transparent"
      }
    },
    defaultVariants: {
      variant: "equal"
    }
  }
);

export type AssetSignIconVariants = VariantProps<typeof assetSignIconVariants>;
export { default as AssetSignIcon } from "./AssetSignIcon.vue";
export { default as AssetIcon } from "./AssetIcon.vue";
export { default as AssetInput } from "./AssetInput.vue";
export { default as AssetSelect } from "./AssetSelect.vue";
export { default as AssetInfoDialog } from "./AssetInfoDialog.vue";
export { default as AssetImageSandbox } from "./AssetImageSandbox.vue";
