// A sentence the screen needs to say, held against a rule rather than inside a
// box. Six screens wrote their own version of this in their own stylesheet.
//
// WHY IT IS NOT A TINTED PANEL. doc/design/visual-language.md section 4 rejects a
// border around a card and a tint used to group, and a notice is the place that
// rule is hardest to keep -- a coloured panel is what every kit reaches for. A
// 3px rule in the left margin marks the same text without enclosing it, and it
// is the same device the shell uses for the current screen: the accent filling
// part of a rule.
//
// WHY AN ERROR CARRIES NO RED. --kokowai exists, and section 1.3 reserves it for
// the fill of a control that destroys something, never for a warning. The
// palette's own position, written into form-skeleton.css before this work and
// kept, is that no hue carries a state: the words carry it and role="alert"
// announces it. A refusal is told from a confirmation by weight and by rule
// colour, which is two signals, neither of them hue alone.
import { cn } from "../../cn";

export function Notice({
  tone,
  children,
  className,
  ...props
}: {
  /** `progress` for something that worked or is under way, `refusal` for
   *  something the server declined. The caller still sets role="status" or
   *  role="alert" itself, because which one it is depends on the screen. */
  tone: "progress" | "refusal";
  children: React.ReactNode;
  className?: string;
} & React.ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={cn(
        "border-l-[3px] pl-4 text-sm",
        tone === "progress" && "border-accent",
        tone === "refusal" && "border-ink font-semibold",
        className,
      )}
    >
      {children}
    </p>
  );
}
