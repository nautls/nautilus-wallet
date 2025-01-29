import { cva, type VariantProps } from "class-variance-authority";

export { default as TransactionEntry } from "./TransactionEntry.vue";
export { default as TransactionSignDialog } from "./TransactionSignDialog.vue";
export { default as TransactionSign } from "./TransactionSign.vue";

export const cardVariants = cva("", {
  variants: {
    variant: {
      default: "",
      destructive: "bg-destructive text-destructive-foreground",
      warning: "bg-warning text-warning-foreground",
      success: "bg-success text-success-foreground"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export type CardVariants = VariantProps<typeof cardVariants>;
