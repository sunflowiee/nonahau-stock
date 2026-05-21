import Link, { type LinkProps } from "next/link";

import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type Props = LinkProps &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    children: ReactNode;
  };

export function LinkButton({
  className,
  variant,
  size,
  children,
  ...props
}: Props) {
  return (
    <Link className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {children}
    </Link>
  );
}
