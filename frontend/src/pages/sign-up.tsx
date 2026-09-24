import { Form, Link, useActionData } from "react-router";

import { PATHS } from "../routes";
import "./sign-up.css";

export default function SignUp() {
  const error = useActionData() as string | undefined;

  return (
    <div className="sign-up">
      <h1 className="sign-up__title">Create an account</h1>
      <p className="sign-up__lede">
        Then sign in and record your measurements. Kete works out your daily
        targets from them.
      </p>

      {error ? (
        <p className="sign-up__error" role="alert">
          {error}
        </p>
      ) : null}

      <Form className="sign-up__form" method="post">
        <div className="sign-up__pair">
          <div className="sign-up__field">
            <label className="sign-up__label" htmlFor="first-name">
              First name
            </label>
            <input
              id="first-name"
              name="first_name"
              autoComplete="given-name"
              required
            />
          </div>

          <div className="sign-up__field">
            <label className="sign-up__label" htmlFor="last-name">
              Last name
            </label>
            <input
              id="last-name"
              name="last_name"
              autoComplete="family-name"
              required
            />
          </div>
        </div>

        <div className="sign-up__field">
          <label className="sign-up__label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
          />
        </div>

        <div className="sign-up__field">
          <label className="sign-up__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="sign-up__field">
          <label className="sign-up__label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby="password-hint"
          />
          <p className="sign-up__hint" id="password-hint">
            At least 8 characters.
          </p>
        </div>

        <button className="sign-up__submit" type="submit">
          Create an account
        </button>
      </Form>

      <p className="sign-up__alt">
        Already have an account? <Link to={PATHS.sign_in}>Sign in</Link>
      </p>
    </div>
  );
}
