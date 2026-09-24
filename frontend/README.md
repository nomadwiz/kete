# Kete client

The browser tier of the Kete meal planner: React with TypeScript, built by Vite and served as static files. It talks only to the REST API in [`../backend`](../backend), and it **never computes a nutrition figure** — every number on screen came from the API, so there is one implementation of the arithmetic and one place to correct it.

## Status

The project, the router and eleven routed pages exist. `src/api/http.ts` talks to the API, `src/api/session.ts` adds the credential and the rules about losing it, one route error boundary catches what loaders and actions throw, and three screens are wired through them: `/recipes` loads its list, and `/sign-in` and `/sign-up` each post to an action. The shell around them exists too — two layouts, the loader that guards the protected addresses, and sign out. `/`, `/sign-up` and `/sign-in` are built and styled. The remaining pages render their own name and nothing else.

Known gaps, each tracked as an issue rather than left in this file:

| Gap                                                              | Issue                            |
| ---------------------------------------------------------------- | -------------------------------- |
| Seven of the eleven pages are placeholders                       | #172–#184                        |
| Types are hand-written rather than generated from the API schema | C21 (#235)                       |
| No tests of the client's security behaviour                      | C22 (#236)                       |
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

Which layout a screen renders inside is decided by where it sits in the route tree in [`src/routes.tsx`](src/routes.tsx), and by nothing else. One pathless parent carries the error boundary; two pathless parents beneath it carry the layouts. `PublicLayout` wraps `/`, `/sign-up` and `/sign-in`. `AppLayout` wraps the seven protected addresses and carries the navigation and sign out. The catch-all sits outside both, because at an unmatched address the application cannot tell which state the visitor is in.

`AppLayout`'s `loader` is the guard. It reads the credential through `src/api/token.ts` and throws a `redirect` to `/sign-in` when there is none. A loader runs before the route's component renders, so no protected content appears and is then withdrawn — which is what ADR 002 chose over a component-level check. It answers one question only: whether a credential is present. An expired one still looks present from there, because only the API can reject it, which is why `recipesLoader` keeps its own `SessionExpired` catch.

Sign out is a route action at `/sign-out` rather than a click handler, so the one write this shell performs goes through the router like every other write. There is no `POST /logout` to call — the token is a twelve-hour JWT with no server-side revocation — so signing out disposes the stored credential and nothing else. A GET to that address disposes of nothing and redirects home, because a session that a prefetch or a bookmark could end is not a session.

`AppLayout` calls no API. Naming the signed-in user there would mean `GET /profile`, and the shell would then need a reachable API to render at all.

## The two form screens

`/sign-up` and `/sign-in` are the same shape, and each is a `Form` posting to an action in [`src/routes.tsx`](src/routes.tsx). Neither reads the API any other way, which is what ADR 002 asks of every screen.

**Registering does not sign anyone in.** `POST /register` answers with a user id and no token, so `signUpAction` redirects to `/sign-in` rather than to the dashboard. The alternative was to chain a second `POST /login` inside the same action and land on `/dashboard`; it saves one step and was declined, because a register that succeeds followed by a login that fails leaves an account made and the person reading an error on the page that asked them to make it.

**The confirmation travels in the address, not in memory.** That redirect carries `?created=1`, and `/sign-in` renders "Account created. Sign in to start." when it is present. The key is a named constant exported from `src/routes.tsx` beside the paths, for the reason ADR 002 gives for the paths themselves, and it holds a flag rather than the new username — a name in the address is a name in browser history and in every log between here and the host.

**What the action returns and what it throws decide which surface the person sees.** A failure the API answered with is returned, so `useActionData` puts the server's own message above the form and the typed fields survive; the 409 that `POST /register` raises for a taken username or email arrives this way, and `messageFrom` in [`src/api/errors.ts`](src/api/errors.ts) has already flattened both of the API's `detail` shapes into text. A request that got no answer at all is rethrown to the `ErrorBoundary`, because there is no form left to return to.

**Validation is the browser's, and it mirrors the server.** `required` on every field, `type="email"`, and `minLength={8}` against `Field(min_length=8)` on `RegisterIn` in [`../backend/main.py`](../backend/main.py). Change one of those two and the other is now wrong. The password rule is also written on screen and tied to the input with `aria-describedby`, so it is known before submitting rather than after.

**The header drops its account links on both of these screens.** Each form already links to the other beneath its own button, which is where someone who picked the wrong one looks; the brand stays, so there is always a way back to `/`.

## Where things go

| Path              | What belongs there                                                                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.css`   | The tokens every screen is styled from, a light reset, and base element styling — including how a form control looks, so every form screen inherits one. The one global stylesheet; nothing page-specific belongs in it (C5, #170) |
| `src/routes.tsx`  | Every path string, once; the route objects; their loaders and actions                                                                                                                                                              |
| `src/pages/`      | One file per page, and beside it that page's stylesheet                                                                                                                                                                            |
| `src/api/`        | Talking to the API: `http.ts` the transport, `session.ts` the credential and what an ended session means, `token.ts` its storage, `errors.ts` the error shapes. Nothing here knows the router (C2, #167)                           |
| `src/types/`      | Types matching the FastAPI schema, added as a screen needs one rather than up front (C2, #167; C21, #235)                                                                                                                          |
| `src/components/` | The route error boundary, the two layouts and their stylesheets, and shared presentational pieces — including the recipe form used by both the creation modal and the edit view (C4, #169; C13, #178)                              |

## Talking to the API

The enum spellings the API validates, the endpoint list and the authentication scheme are in [`../backend/README.md`](../backend/README.md), and the code that enforces them is [`../backend/main.py`](../backend/main.py). Where a description and the code disagree, the code is right — so read the code rather than copying either into this file.

## Scripts

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Vite dev server on 5173, with hot reload                        |
| `npm run build`        | Type-checks, then writes the deployable bundle to `dist/`       |
| `npm run preview`      | Serves `dist/` — use it to test deep links against a real build |
| `npm run lint`         | ESLint over the project, config files included                  |
| `npm run format`       | Rewrites files with Prettier                                    |
| `npm run format:check` | Reports without rewriting; this is the one CI runs              |
