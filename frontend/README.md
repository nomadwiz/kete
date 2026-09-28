# Kete client

The browser tier of the Kete meal planner: React with TypeScript, built by Vite and served as static files. It talks only to the REST API in [`../backend`](../backend), and it **never computes a nutrition figure** — every number on screen came from the API, so there is one implementation of the arithmetic and one place to correct it.

## Status

The project, the router and eleven routed pages exist. `src/api/http.ts` talks to the API, `src/api/session.ts` adds the credential and the rules about losing it, one error boundary component catches what loaders and actions throw, and six screens are wired through them: `/recipes`, `/targets` and `/dashboard` load through a loader, and `/sign-in`, `/sign-up` and `/measurements` each post to an action. The shell around them exists too — two layouts, the loader that guards the protected addresses, and sign out. `/`, `/sign-up`, `/sign-in`, `/measurements`, `/targets` and `/dashboard` are built and styled. The remaining pages render their own name and nothing else.

Known gaps, each tracked as an issue rather than left in this file:

| Gap                                                              | Issue                            |
| ---------------------------------------------------------------- | -------------------------------- |
| Four of the eleven pages are placeholders                        | #176–#184                        |
| Types are hand-written rather than generated from the API schema | C21 (#235)                       |
| The production build is not wired to a host                      | C20 (#185), K6 (#192), K9 (#195) |

## Run it

```bash
cd frontend
nvm use                          # reads .nvmrc — Node 22.23.2
npm install

cp .env.example .env             # then set VITE_API_BASE_URL
npm run dev
```

The `.env` step is not optional. `VITE_API_BASE_URL` is the only address the client knows, and nothing is hardcoded, so the same build can point at a local API during development and the deployed one afterwards. `.env` is gitignored; `.env.example` is the committed template.

**Vite inlines every `VITE_`-prefixed variable into the browser bundle**, where anyone who opens the page can read it. Put the API's address there. Never put a secret there.

The dev server listens on **5173** and the API on **8000**, so development is already cross-origin — which is why the API enables CORS from the outset rather than as a deployment afterthought. Start the API first; [`../backend/README.md`](../backend/README.md) has the commands.

## Design

How routing and data loading work, what may not be written where, and what the host must do for a deep link, are settled in ADR 002 — the documents repository `nomadwiz/kete-doc`, at [`doc/design/decisions/adr/002-client-routing.md`](../../doc/design/decisions/adr/002-client-routing.md). Read it before adding a screen. That link resolves once both repositories are cloned in the layout `nomadwiz/kete-doc`'s own `README.md` sets out.

The API contract is the schema FastAPI generates from [`../backend/main.py`](../backend/main.py) and serves at `/openapi.json`. There is no second, hand-written copy.

## The shell

Which layout a screen renders inside is decided by where it sits in the route tree in [`src/routes.tsx`](src/routes.tsx), and by nothing else. One pathless parent carries the error boundary; two pathless parents beneath it carry the layouts. A third pathless parent, inside `AppLayout`, carries the **same** error boundary component a second time — see [The error surface](#the-error-surface) below, and do not remove it as a duplicate. `PublicLayout` wraps `/`, `/sign-up` and `/sign-in`. `AppLayout` wraps the seven protected addresses and carries the navigation and sign out. The catch-all sits outside both, because at an unmatched address the application cannot tell which state the visitor is in.

`AppLayout`'s `loader` is the guard. It reads the credential through `src/api/token.ts` and throws a `redirect` to `/sign-in` when there is none. A loader runs before the route's component renders, so no protected content appears and is then withdrawn — which is what ADR 002 chose over a component-level check. It answers one question only: whether a credential is present. An expired one still looks present from there, because only the API can reject it, which is why `recipesLoader` keeps its own `SessionExpired` catch.

Sign out is a route action at `/sign-out` rather than a click handler, so the one write this shell performs goes through the router like every other write. There is no `POST /logout` to call — the token is a twelve-hour JWT with no server-side revocation — so signing out disposes the stored credential and nothing else. A GET to that address disposes of nothing and redirects home, because a session that a prefetch or a bookmark could end is not a session.

`AppLayout` calls no API. Naming the signed-in user there would mean `GET /profile`, and the shell would then need a reachable API to render at all.

## The error surface

**One component, mounted twice.** [`src/components/error-boundary.tsx`](src/components/error-boundary.tsx) is the only place that turns a thrown failure into something on screen, and ADR 004's sibling ADR 003 — the documents repository `nomadwiz/kete-doc`, at [`doc/design/decisions/adr/003-error-surface-mount-points.md`](../../doc/design/decisions/adr/003-error-surface-mount-points.md) — records why it hangs in two places.

React Router renders a boundary **at the route carrying it**, replacing that route's own element. A single mount on the outermost pathless parent therefore replaces the whole tree, `AppLayout` and its navigation included, so a protected page whose loader threw left the user able to escape only by pressing Back. The inner mount is a pathless route between `AppLayout` and the seven protected addresses: a failure in one of them is caught there, renders into `AppLayout`'s outlet, and the navigation survives.

**Moving the boundary onto the `AppLayout` route object instead does not work**, and it is the obvious first attempt. That route would then be the one the boundary replaces, and the navigation goes exactly as before. Both arrangements are covered by [`src/pages/dashboard.test.tsx`](src/pages/dashboard.test.tsx) and both fail it.

The outer mount stays, because a failure in the public tree — and a throw from the guard on `AppLayout` itself, which hangs above the inner mount — still has to land somewhere.

## The form screens

`/sign-up`, `/sign-in` and `/measurements` are the same shape, and each is a `Form` posting to an action in [`src/routes.tsx`](src/routes.tsx). None reads the API any other way, which is what ADR 002 asks of every screen.

**Registering does not sign anyone in.** `POST /register` answers with a user id and no token, so `signUpAction` redirects to `/sign-in` rather than to the dashboard. The alternative was to chain a second `POST /login` inside the same action and land on `/dashboard`; it saves one step and was declined, because a register that succeeds followed by a login that fails leaves an account made and the person reading an error on the page that asked them to make it.

**Saving measurements discards what the save answered with.** `POST /profile/metrics` writes the five figures and returns the targets computed from them, in one transaction. `measurementsAction` throws that body away and redirects to `/targets`, which reads them through `GET /targets` — one screen renders a target rather than two that can disagree, and the cost is the second request. The five figures are sent every time because the endpoint takes no partial update.

**The confirmation travels in the address, not in memory.** That redirect carries `?created=1`, and `/sign-in` renders "Account created. Sign in to start." when it is present. The key is a named constant exported from `src/routes.tsx` beside the paths, for the reason ADR 002 gives for the paths themselves, and it holds a flag rather than the new username — a name in the address is a name in browser history and in every log between here and the host.

**What the action returns and what it throws decide which surface the person sees.** A failure the API answered with is returned, so `useActionData` puts the server's own message above the form and the typed fields survive; the 409 that `POST /register` raises for a taken username or email arrives this way, and `messageFrom` in [`src/api/errors.ts`](src/api/errors.ts) has already flattened both of the API's `detail` shapes into text. A request that got no answer at all is rethrown to the `ErrorBoundary`, because there is no form left to return to.

**Validation is the browser's, and it mirrors the server.** `required` on every field, `type="email"`, and `minLength={8}` against `Field(min_length=8)` on `RegisterIn` in [`../backend/main.py`](../backend/main.py); on `/measurements`, `type="number"` with the `min`, `max` and `step` of each bound on `MetricsIn` in the same file, and a `<select>` per enumeration so a value outside it cannot be typed. Change one side of any of those pairs and the other is now wrong. The password rule is also written on screen and tied to the input with `aria-describedby`, so it is known before submitting rather than after.

**`PublicLayout`'s header drops its account links on `/sign-up` and `/sign-in`.** Each of those two already links to the other beneath its own button, which is where someone who picked the wrong one looks; the brand stays, so there is always a way back to `/`.

## The targets screen

`/targets` reads through `targetsLoader` in [`src/routes.tsx`](src/routes.tsx) and renders what it is given. It computes nothing: each figure is printed as the API sent it, and the only arithmetic on the screen is turning a timestamp into a date.

**A 404 from `GET /targets` is a state, not a failure.** The endpoint answers it until measurements have been saved, which is the only signal the system has that a user has supplied none. So `targetsLoader` catches that one status, answers `null`, and the screen renders a panel pointing at `/measurements`. The alternative was to rethrow and let the `ErrorBoundary` have it, and it is declined because a person who has simply not filled the form in yet would be told something went wrong. `/dashboard` reads through the same loader for the same reason, which is where that question is answered for a returning user who still holds a valid token — ADR 004.

**The date is formatted on a fixed locale, not the reader's.** `en-NZ`, assembled from `formatToParts` because that locale's own separator is a slash, so the line reads `dd-mm-yyyy HH:MM` on any machine. A screenshot of this screen goes in the report, and a browser set to `en-US` would otherwise put `09/25/2026` in front of a marker reading documents that say `25-09-2026`. An unparseable value drops the line rather than throwing, because losing the four figures over the note beneath them is the wrong trade.

**The note says where the figures come from and stops before saying how energy is divided.** `MACRO_SPLIT` in [`../backend/main.py`](../backend/main.py) carries `TODO: team to confirm the split`, and the proportions are marked `[CITE]` in `doc/design/product.md` in the documents repository `nomadwiz/kete-doc`. A proportion printed here would read, on screen and later in a screenshot, exactly like a sourced figure — which is the reasoning `/measurements` used for leaving its activity levels undescribed. The activity factors and the four-and-nine gram conversions stand on the same footing.

## The dashboard

`/dashboard` is the hub: the four daily target figures, and the three principal areas. It reads through **the same `targetsLoader`** the targets screen uses, referenced from both route objects rather than copied. That is one occurrence short of where this project normally extracts, and it is deliberate — what is shared is the knowledge that a 404 from `GET /targets` means no measurements have been saved, and ADR 004 requires that rule live in one place.

**A fresh sign-in lands here unconditionally.** `signInAction` used to probe `GET /targets` itself and send a user with no measurements to `/measurements` instead. That covered the arrival it could see and not the other one: the token lasts twelve hours and the guard checks only that one is present, so a returning user who skipped the form never passed through the action at all. The check now sits in the loader, where both arrivals meet it, and sign-in makes one request rather than two. ADR 004 in `nomadwiz/kete-doc`, at [`doc/design/decisions/adr/004-no-measurements-check.md`](../../doc/design/decisions/adr/004-no-measurements-check.md).

**It tells the user rather than redirecting them.** A loader that threw `redirect(PATHS.measurements)` would cover the same two arrivals and was declined: `/dashboard` is where the navigation sends a signed-in user, so someone who chose to skip the form would be returned to it every time they tried to leave. The panel names the same gap and links to the same form.

**The areas render in both states.** Someone who has saved no measurements can still write recipes, and a hub that withholds the hub until a form is filled in is a redirect wearing different clothes.

**The list of areas is built inside the component, not as a module constant.** `routes.tsx` imports this page through [`src/pages/index.tsx`](src/pages/index.tsx) and the page imports `PATHS` back from `routes.tsx`, so the two modules are circular and `PATHS` is still undefined while the page evaluates. `app-layout.tsx` builds its own list inside its component for the same reason. Hoisting either to the top level type-checks, lints and then crashes the application on load.

**Three things the wireframe draws are not here.** A greeting would need `GET /profile`, a second endpoint with a different failure mode on the screen every sign-in now lands on. A Log out button would duplicate the shell's, which is on every page and is what FR-14 asks for. And the planned week against the targets needs `GET /mealplan/summary?week=`, which ADR 001 designs and no endpoint answers — drawing it from `GET /mealplan` would mean computing a nutrition figure here, which this client does not do.

## Where things go

| Path              | What belongs there                                                                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.css`   | The tokens every screen is styled from, a light reset, and base element styling — including how a form control looks, so every form screen inherits one. The one global stylesheet; nothing page-specific belongs in it (C5, #170) |
| `src/routes.tsx`  | Every path string, once; the route objects; their loaders and actions                                                                                                                                                              |
| `src/pages/`      | One file per page, and beside it that page's stylesheet                                                                                                                                                                            |
| `src/api/`        | Talking to the API: `http.ts` the transport, `session.ts` the credential and what an ended session means, `token.ts` its storage, `errors.ts` the error shapes. Nothing here knows the router (C2, #167)                           |
| `src/types/`      | Types matching the FastAPI schema, added as a screen needs one rather than up front (C2, #167; C21, #235)                                                                                                                          |
| `src/components/` | The route error boundary, the two layouts and their stylesheets, and shared presentational pieces — including the recipe form used by both the creation modal and the edit view (C4, #169; C13, #178)                              |
| `src/test/`       | The Vitest setup file, and the helpers that render the real route array against a stubbed `fetch`. Tests themselves sit beside what they test (C22, #236)                                                                          |

## Talking to the API

The enum spellings the API validates, the endpoint list and the authentication scheme are in [`../backend/README.md`](../backend/README.md), and the code that enforces them is [`../backend/main.py`](../backend/main.py). Where a description and the code disagree, the code is right — so read the code rather than copying either into this file.

## Scripts

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Vite dev server on 5173, with hot reload                        |
| `npm run build`        | Type-checks, then writes the deployable bundle to `dist/`       |
| `npm run preview`      | Serves `dist/` — use it to test deep links against a real build |
| `npm test`             | Vitest over `src`, once, in jsdom                               |
| `npm run lint`         | ESLint over the project, config files included                  |
| `npm run format`       | Rewrites files with Prettier                                    |
| `npm run format:check` | Reports without rewriting; this is the one CI runs              |
