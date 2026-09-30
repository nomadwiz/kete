import { isRouteErrorResponse, useRouteError } from "react-router";

import { ApiError } from "../api/errors";

// One error component, mounted twice -- ADR 003 in nomadwiz/kete-doc. The outer
// mount replaces the whole page, the inner one renders into AppLayout's outlet
// so the navigation survives, and neither is redundant.
//
// It carries its own <main> for the same reason pages/not-found.tsx does: the
// outer mount inherits no layout. All three branches take the same column and
// the same display setting as every other screen, because a screen a person
// only ever reaches when something has already gone wrong is the last one that
// should also look broken.
function Surface({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-(--column) gap-4 px-(--gutter) py-16 lg:py-24">
      <h1 className="text-title leading-[0.95] font-semibold tracking-tight [font-stretch:var(--stretch-display)]">
        {heading}
      </h1>
      <div className="grid max-w-(--measure) gap-2 border-t border-rule pt-4 text-muted-foreground">
        {children}
      </div>
    </main>
  );
}

export default function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof ApiError) {
    return (
      <Surface heading="Something went wrong">
        <p>{error.message}</p>
        <p className="tabular-nums">Status {error.status}.</p>
      </Surface>
    );
  }

  if (isRouteErrorResponse(error)) {
    return (
      <Surface heading={String(error.status)}>
        <p>{error.statusText}</p>
      </Surface>
    );
  }

  return (
    <Surface heading="Something went wrong">
      <p>The server could not be reached. Try again in a moment.</p>
    </Surface>
  );
}
