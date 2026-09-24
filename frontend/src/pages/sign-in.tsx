import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";

import { PATHS, QUERY } from "../routes";
import "./sign-in.css";

export default function SignIn() {
  const error = useActionData() as string | undefined;
  const [params] = useSearchParams();
  const created = params.has(QUERY.account_created);
  const navigation = useNavigation();
  const signingIn = navigation.formAction === PATHS.sign_in;

  return (
    <div className="sign-in">
      <h1 className="sign-in__title">Sign in</h1>

      {created ? (
        <p className="sign-in__created" role="status">
          Account created. Sign in to start.
        </p>
      ) : null}

      {error ? (
        <p className="sign-in__error" role="alert">
          {error}
        </p>
      ) : null}

      <Form className="sign-in__form" method="post" aria-busy={signingIn}>
        <div className="sign-in__field">
          <label className="sign-in__label" htmlFor="username-or-email">
            Username or email
          </label>
          <input
            id="username-or-email"
            name="username_or_email"
            autoComplete="username"
            required
          />
        </div>

        <div className="sign-in__field">
          <label className="sign-in__label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <button className="sign-in__submit" type="submit" disabled={signingIn}>
          {signingIn ? "Signing in…" : "Sign in"}
        </button>
      </Form>

      <p className="sign-in__alt">
        No account yet? <Link to={PATHS.sign_up}>Create an account</Link>
      </p>
    </div>
  );
}
