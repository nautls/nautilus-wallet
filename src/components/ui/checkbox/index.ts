import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Checkbox } from "./Checkbox.vue";

export const checkboxVariants = cva(
  "peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 border shadow-xs transition-shadow outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "rounded-[4px]",
        rounded: "rounded-full"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export type CheckboxVariants = VariantProps<typeof checkboxVariants>;
