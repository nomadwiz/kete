import { Form, useActionData } from "react-router";

export default function SignIn() {
  const error = useActionData() as string | undefined;

  return (
    <main>
      <h1>Sign in</h1>
      {error ? <p role="alert">{error}</p> : null}
      <Form method="post">
        <label>
          Username or email
          <input name="username_or_email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">Sign in</button>
      </Form>
    </main>
  );
}
