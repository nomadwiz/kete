// A set of label-and-value pairs, ruled rather than boxed. /dashboard and
// /targets draw the same four figures in the same order and the same wording,
// so they draw them from here.
//
// A description list, because four label-and-value pairs is what one is for and
// the pairing reaches a screen reader from the markup rather than from an ARIA
// attribute. The rules are the weft: doc/design/visual-language.md section 4
// rejects a card per figure and a tint drawn behind the set to group it, so the
// only thing separating one figure from the next is a hairline.
//
// The value is tabular -- index.css sets font-variant-numeric on dd -- so the
// four figures line up on their digits instead of drifting with the glyphs.
import { cn } from "../../cn";

export function Figures({
  rows,
  className,
}: {
  rows: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <dl className={cn("border-b border-rule", className)}>
      {rows.map((row) => (
        <div
          className="flex items-baseline justify-between gap-6 border-t border-rule py-3"
          key={row.label}
        >
          <dt className="text-sm text-muted-foreground">{row.label}</dt>
          <dd className="text-xl font-semibold tracking-tight">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
