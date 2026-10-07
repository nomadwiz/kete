// The sentence that says a write worked, in a live region that is on the page
// before the write. C28 (nomadwiz/kete#285), ADR 005 Decision Two.
//
// WHY IT IS ALWAYS MOUNTED. A screen reader watches a role="status" element for
// changes to its content; one inserted already holding its text is commonly
// skipped. So the element renders on the screen's first render, empty, and only
// its children change when the write succeeds.
//
// WHY EMPTY IS sr-only AND NOT hidden. display:none removes the element from the
// accessibility tree, which would defeat the point. sr-only is out of flow, so
// an empty region takes no row in the screen's grid or flex gap, and :empty
// drops it again if the sentence is cleared.
import { cn } from "../../cn";
import { Notice } from "./notice";

export function StatusRegion({
  children,
  plain,
  className,
}: {
  children?: React.ReactNode;
  /** Skip Notice's left rule and draw the sentence with `className` alone, for
   *  the one screen (recipes) that has its own panel. */
  plain?: boolean;
  className?: string;
}) {
  const classes = cn("empty:sr-only", className);
  return plain ? (
    <p role="status" className={classes}>
      {children}
    </p>
  ) : (
    <Notice tone="progress" role="status" className={classes}>
      {children}
    </Notice>
  );
}
