import { isRouteErrorResponse, useRouteError } from "react-router";

import { ApiError } from "../api/errors";

// The single error surface. Every loader and action failure that is not
// handled where it is raised arrives here, because the router sends it to the
// nearest route ErrorBoundary rather than to a try/catch in a page.
export default function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof ApiError) {
    return (
      <main>
        <h1>Something went wrong</h1>
        <p>{error.message}</p>
        <p>Status {error.status}.</p>
      </main>
    );
  }

  if (isRouteErrorResponse(error)) {
    return (
      <main>
        <h1>{error.status}</h1>
        <p>{error.statusText}</p>
      </main>
    );
  }

  // What an unreachable API produces: fetch rejects with a TypeError rather
  // than answering, so this never became an ApiError. Its message is "Failed
  // to fetch", which tells a user nothing, so it is not shown.
  return (
    <main>
      <h1>Something went wrong</h1>
      <p>The server could not be reached. Try again in a moment.</p>
    </main>
  );
}
