// A labelled control, and a row of two that read as one line. This is the form
// skeleton four screens used to repeat -- it was written out four times, then
// once as src/form-skeleton.css with one selector per screen, and it is a
// component here so that a fifth form screen inherits it instead of adding a
// line to nine selector lists. C30 (#303), ADR 006.
//
// It takes its control as a child rather than as props. A field needs the
// input's id, name, type, autoComplete, required, min, step and pattern, and
// proxying all of them means a prop per attribute and a new one each time a
// screen needs something the component never anticipated.
import { cn } from "../../cn";

export function Field({
  htmlFor,
  label,
  className,
  children,
}: {
  htmlFor: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("grid gap-2 [&_input]:w-full [&_select]:w-full", className)}
    >
      <label className="text-sm font-semibold" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

// Two fields drawn as one line, because they read as one: a first and last
// name, weight with height, age with sex. Anything that can be long on its own
// takes the full width instead and is not a pair. One column below 34rem, so a
// phone gets the same answer on every screen that pairs anything.
export function FieldPair({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 xs:grid-cols-2 xs:gap-4">
      {children}
    </div>
  );
}
