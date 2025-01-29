import { cva, type VariantProps } from "class-variance-authority";

export { default as AssetSignIcon } from "./AssetSignIcon.vue";

export const assetSignIconVariants = cva(
  "size-5 min-w-5 rounded-full p-0.5 bg-accent border-accent border",
  {
    variants: {
      variant: {
        positive: "text-green-600 dark:text-green-400",
        negative: "text-red-600 dark:text-red-400",
        equal: "text-muted-foreground",
        swap: "",
        burn: "bg-transparent border-none"
      }
    },
    defaultVariants: {
      variant: "equal"
    }
  }
);

export type AssetSignIconVariants = VariantProps<typeof assetSignIconVariants>;
