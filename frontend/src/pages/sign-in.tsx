import { useDeferredValue } from "react";
import { Form, Link, useActionData, useSearchParams } from "react-router";

import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { Notice } from "../components/ui/notice";
import { Screen } from "../components/ui/screen";
import { StatusRegion } from "../components/ui/status-region";
import { PATHS, QUERY } from "../routes";
import { useWrite } from "../use-write";

export default function SignIn() {
  const error = useActionData() as string | undefined;
  const [params] = useSearchParams();
  // False on this screen's first render whatever the address says, then the
  // real answer in a second render React schedules straight after. A new
  // account arrives here by a redirect that mounts this screen, so without the
  // delay the sentence below would be inserted already written, which a screen
  // reader commonly does not announce -- StatusRegion says why. C38
  // (nomadwiz/kete#379).
  const created = useDeferredValue(params.has(QUERY.account_created), false);
  // Nothing is announced here on success, because success is a redirect to
  // the dashboard and this screen is gone before it could say anything. What
  // this call is for is the other half of C28 (nomadwiz/kete#285): the button
  // below disables itself mid-submission, and on a refusal it comes back with
  // focus on <body> unless something puts it back. src/use-write.ts does.
  const { busy: signingIn } = useWrite("POST");

  return (
    <Screen
      center
      title="Sign in"
      lede="Your measurements, your recipes and your week are waiting where you left them."
    >
      <div className="grid max-w-(--form-width) gap-6">
        <StatusRegion>
          {created ? "Account created. Sign in to start." : null}
        </StatusRegion>

        {error ? (
          <Notice tone="refusal" role="alert">
            {error}
          </Notice>
        ) : null}

        <Form className="grid gap-6" method="post" aria-busy={signingIn}>
          <Field htmlFor="username-or-email" label="Username or email">
            <input
              id="username-or-email"
              name="username_or_email"
              autoComplete="username"
              required
            />
          </Field>

          <Field htmlFor="password" label="Password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          {/* justify-self-start, because a submit that spans the measure reads
              as a banner and loses the relation between its size and what it
              does. */}
          <Button
            className="justify-self-start"
            variant="accent"
            type="submit"
            disabled={signingIn}
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </Button>
        </Form>

        <p className="border-t border-rule pt-4 text-sm text-muted-foreground">
          No account yet?{" "}
          <Link className="text-ink underline" to={PATHS.sign_up}>
            Create an account
          </Link>
        </p>
      </div>
    </Screen>
  );
}
