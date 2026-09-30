// The layout every screen is built on. C30 (#303), ADR 006.
//
// THE GRID IS THE DESIGN, AND IT IS JUSTIFIED TWICE. A Swiss modular grid and a
// woven kete are the same idea -- structure that is the content rather than a
// container for it -- so the twelve columns are both the discipline the style
// asks for and the thing the product is named after. Every screen places
// against them; nothing is centred except the column itself.
//
// IT SHARES THE PAGE COLUMN WITH THE BAR ABOVE IT, and that is not optional.
// Both layouts cap at --column and centre, so a screen's title starts on the
// same line as the brand. pages/sign-in.css used to carry a comment saying why
// -- "centring the block instead puts the two on different alignments, which
// reads as an accident at any width wide enough to notice" -- and building this
// without the cap reproduced exactly that. It was visible in a screenshot and
// in no test, because jsdom applies no layout.
//
// THE SHAPE IS ASYMMETRIC ON PURPOSE. A screen's name and its one sentence of
// explanation sit in a narrow left measure; the content runs in the wider right
// one, one column clear of it. A generic dashboard centres a title over its
// content and loses the reading order. Below 64rem there is no room for two
// measures, so the title stacks above and the asymmetry is spent.
import { cn } from "../../cn";

export function Screen({
  title,
  lede,
  wide,
  center,
  actions,
  children,
}: {
  title: string;
  lede?: string;
  /** Content spans all twelve columns, under the title rather than beside it.
   *  For the planner's grid and the recipe library, which want the full width. */
  wide?: boolean;
  /** Holds a short screen in the middle of the viewport rather than against the
   *  bar. For the two auth screens, whose content is four controls: the block
   *  sits in the screen instead of hanging off the header. */
  center?: boolean;
  /** Sits under the lede in the left measure, so a screen's primary action is
   *  in the same place on every screen that has one. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-(--column) grid-cols-12 gap-x-6 gap-y-8 px-(--gutter) py-12 lg:py-16",
        center && "min-h-[72svh] content-center",
      )}
    >
      <header className={cn("col-span-12", !wide && "lg:col-span-4")}>
        <h1 className="text-title leading-[0.95] font-semibold tracking-tight [font-stretch:var(--stretch-display)]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-4 max-w-(--measure) text-sm text-muted-foreground">
            {lede}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-6 flex flex-wrap gap-3">{actions}</div>
        ) : null}
      </header>

      <div
        className={cn("col-span-12", !wide && "lg:col-span-7 lg:col-start-6")}
      >
        {children}
      </div>
    </div>
  );
}

/** A band of content announced by a rule and a small heading, not by a box.
 *  doc/design/visual-language.md section 4 rejects a border around a card and a
 *  tint used to group, so the weft is what separates one band from the next. */
export function Band({
  heading,
  children,
  className,
}: {
  heading?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-rule pt-4", className)}>
      {heading ? (
        <h2 className="text-sm font-semibold text-muted-foreground">
          {heading}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
