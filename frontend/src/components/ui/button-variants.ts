// Every button in the client, defined once. C30 (#303), ADR 006.
//
// DO NOT "IMPROVE" THREE THINGS HERE. Each was decided rather than defaulted,
// and each is the thing a component kit's own defaults would undo.
//
// 1. `disabled` is the native attribute and the pending treatment carries no
//    hue. shadcn's own Button ships `disabled:opacity-50`; fifty per cent
//    opacity on --color-accent destroys its contrast, and the palette has no
//    spare hue to signal with. So a disabled button takes the surface fill and
//    the same inset boundary, and the label is what says what is happening.
//    ADR 005 settled that it stays `disabled` and never `aria-disabled`,
//    because planner.tsx relies on the attribute to stop a second Add being
//    answered 409 and a second Remove 404.
//
// 2. There is no `focus-visible:ring-*` here, deliberately. index.css sets one
//    outline for everything, outside every cascade layer so that no utility
//    can remove it, and use-write.css depends on `:focus` rather than
//    `:focus-visible` because use-write.ts moves focus to a container
//    programmatically. A ring here would be a second focus mechanism.
//
// 3. The accent variant carries an inset boundary, and that is a fix rather
//    than decoration. --color-accent reaches only 2.39:1 against the page
//    where WCAG 2.1 asks 3:1 of a control's edge, and no darkening satisfies
//    both that and 4.5:1 of the label -- measured in
//    ../../../../doc/design/visual-language.md section 1.2 of nomadwiz/kete-doc.
//    The boundary reaches 5.69:1. It is an inset shadow rather than a border
//    because the button has none and gaining one shifts its text by a pixel.
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-150 disabled:cursor-default",
  {
    variants: {
      variant: {
        // The primary action. One per screen, and never full width.
        accent:
          "bg-accent text-ink inset-ring-1 inset-ring-border hover:not-disabled:bg-ink hover:not-disabled:text-paper disabled:bg-surface disabled:text-muted-foreground",
        // Everything else that acts. Outlined rather than filled, so twenty-one
        // of them on the planner do not make the accent mean nothing.
        secondary:
          "bg-background text-ink border border-border hover:not-disabled:bg-ink hover:not-disabled:text-paper disabled:bg-surface disabled:text-muted-foreground",
        // A control that destroys something: the delete on /recipes/:id and
        // the submit on /account/delete. Filled, so it is told apart from
        // secondary by shape and not by hue alone: --color-destructive and
        // --color-border measure 1.08:1 against each other.
        destructive:
          "bg-destructive text-paper inset-ring-1 inset-ring-border hover:not-disabled:bg-ink disabled:bg-surface disabled:text-muted-foreground",
      },
      size: {
        default: "px-6 py-3 text-base",
        sm: "px-4 py-2 text-sm",
        xs: "px-3 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);
