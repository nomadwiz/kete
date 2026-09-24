import { isRouteErrorResponse, useRouteError } from "react-router";

import { ApiError } from "../api/errors";

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

  return (
    <main>
      <h1>Something went wrong</h1>
      <p>The server could not be reached. Try again in a moment.</p>
    </main>
  );
}
