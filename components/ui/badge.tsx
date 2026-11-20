import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-3 py-1 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-royal focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-royal text-white shadow hover:bg-royal/90",
        secondary:
          "border-transparent bg-turquoise text-void hover:bg-turquoise/80",
        destructive:
          "border-transparent bg-magenta text-white shadow hover:bg-magenta/90",
        outline: "text-void border-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
