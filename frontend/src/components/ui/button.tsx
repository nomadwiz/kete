// The button element. Its appearance is in ./button-variants.ts, which is a
// separate file so that a link may be drawn as a button without rendering one
// -- the empty state on /dashboard is a link to /measurements, not a control --
// and because exporting a constant beside a component breaks Fast Refresh.
import { type VariantProps } from "class-variance-authority";

import { cn } from "../../cn";
import { buttonVariants } from "./button-variants";

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
