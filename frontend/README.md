# Kete client

The browser tier of the Kete meal planner: React with TypeScript, built by Vite and served as static files. It talks only to the REST API in [`../backend`](../backend), and it **never computes a nutrition figure** — every number on screen came from the API, so there is one implementation of the arithmetic and one place to correct it.

## Status

The project, the router and eleven routed pages exist. `src/api/http.ts` talks to the API, `src/api/session.ts` adds the credential and the rules about losing it, one error boundary component catches what loaders and actions throw, and nine screens are wired through them: `/targets` and `/dashboard` load through a loader, `/sign-in` and `/sign-up` each post to an action, and `/measurements`, `/account`, `/recipes`, `/recipes/:id` and `/planner` each do both — a loader to read, an action to write. The shell around them exists too — two layouts, the loader that guards the protected addresses, and sign out. `/`, `/sign-up`, `/sign-in`, `/measurements`, `/targets`, `/dashboard`, `/account`, `/recipes`, `/recipes/:id` and `/planner` are built and styled.

Known gaps, each tracked as an issue rather than left in this file:

| Gap                                                              | Issue                            |
| ---------------------------------------------------------------- | -------------------------------- |
| A recipe cannot be deleted from the client                       | C15 (#179)                       |
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

## Serving the build

`npm run build` writes `dist/`, and that directory is the whole deployable — `index.html`, fingerprinted files under `assets/`, and everything in `public/` copied unchanged. There is no application server: the host stores files, and the browser reaches the API itself. What follows is what that bundle requires of whoever builds the hosting, written here because each of these is cheaper to read than to discover during a deployment.

**Any request whose path does not match a stored object must be answered with this `index.html` and a `200` status.** Addresses are ordinary paths with no `#` fragment, which ADR 002 decided, so `/recipes/3` typed in, refreshed or opened from a bookmark is a real request to the host — and the router that would resolve it does not exist until a document has been served and the bundle has started. **The status matters as much as the body, and it is the part a static host is most likely to get wrong.** Amazon S3's static website hosting substitutes a configured error document for an absent object but keeps the `404` on the response, so the application renders correctly while the response tells every cache, crawler and monitor that the page is not there. Which service supplies the 200 is the cloud lane's to choose and to document — K6 (#192).

**`VITE_API_BASE_URL` is read when the bundle is built, not when it is served**, so the deployed API's address has to be known at build time. Vite substitutes the value into the JavaScript it emits — the warning above about secrets is the same mechanism described for a different reason — so afterwards there is no file on the host to edit and no environment variable the host can set. One artefact cannot therefore be built once and promoted to a second API address; pointing the client elsewhere means building again, which is a constraint on the pipeline rather than a detail of it (K9, #195).

**The build context is the repository, not the `frontend/` directory.** The type generation added by C21 (#235) runs ahead of `build`, `test` and `dev` and reads `../backend/openapi.json` — the schema exported by S1 (#138), a path above this folder — so a job that checks out, copies or uploads `frontend/` on its own fails before the compiler runs. Taking the repository root as the build context costs nothing and avoids it.

**`index.html` must not be cached hard, while everything under `assets/` may be.** Vite fingerprints each bundled file, so `assets/index-<hash>.js` can be served as immutable and a later deploy writes different names. `index.html` carries no fingerprint and is the only file naming the current ones, so a hard-cached copy goes on asking for the previous deploy's filenames until it expires, whether or not the host still stores them. `public/` is copied verbatim and keeps its names too, which puts `favicon.svg` on `index.html`'s side of that line.

Vite's `base` is left at its default `/`, which is what serving from the root of a bucket or a distribution needs, and every asset reference in `dist/index.html` is accordingly an absolute path. Serving the application from a sub-path instead would mean setting `base` and rebuilding.

`npm run preview` applies the fallback rule itself, which is why the Scripts table below sends you there to check a deep link against a real build. It models the deployed host in that one respect and in no other — it sends `Cache-Control: no-cache` on everything, hashed assets included, so it says nothing about the headers above.

## Design

How routing and data loading work, what may not be written where, and what the host must do for a deep link, are settled in ADR 002 — the documents repository `nomadwiz/kete-doc`, at [`doc/design/decisions/adr/002-client-routing.md`](../../doc/design/decisions/adr/002-client-routing.md). Read it before adding a screen. That link resolves once both repositories are cloned in the layout `nomadwiz/kete-doc`'s own `README.md` sets out.

The API contract is the schema FastAPI generates from [`../backend/main.py`](../backend/main.py) and serves at `/openapi.json`. There is no second, hand-written copy.

## The shell

Which layout a screen renders inside is decided by where it sits in the route tree in [`src/routes.tsx`](src/routes.tsx), and by nothing else. One pathless parent carries the error boundary; two pathless parents beneath it carry the layouts. A third pathless parent, inside `AppLayout`, carries the **same** error boundary component a second time — see [The error surface](#the-error-surface) below, and do not remove it as a duplicate. `PublicLayout` wraps `/`, `/sign-up` and `/sign-in`. `AppLayout` wraps the seven protected addresses and carries the navigation and sign out. The catch-all sits outside both, because at an unmatched address the application cannot tell which state the visitor is in.

`AppLayout`'s `loader` is the guard. It reads the credential through `src/api/token.ts` and throws a `redirect` to `/sign-in` when there is none. A loader runs before the route's component renders, so no protected content appears and is then withdrawn — which is what ADR 002 chose over a component-level check. It answers one question only: whether a credential is present. An expired one still looks present from there, because only the API can reject it, which is why every loader and action that reaches the API runs its work through `withSession`, and a 401 coming back from one of them is what sends the person to sign in.

Sign out is a route action at `/sign-out` rather than a click handler, so the one write this shell performs goes through the router like every other write. There is no `POST /logout` to call — the token is a twelve-hour JWT with no server-side revocation — so signing out disposes the stored credential and nothing else. A GET to that address disposes of nothing and redirects home, because a session that a prefetch or a bookmark could end is not a session.

`AppLayout` calls no API. Naming the signed-in user there would mean `GET /profile`, and the shell would then need a reachable API to render at all.

## The error surface

**One component, mounted twice.** [`src/components/error-boundary.tsx`](src/components/error-boundary.tsx) is the only place that turns a thrown failure into something on screen, and ADR 004's sibling ADR 003 — the documents repository `nomadwiz/kete-doc`, at [`doc/design/decisions/adr/003-error-surface-mount-points.md`](../../doc/design/decisions/adr/003-error-surface-mount-points.md) — records why it hangs in two places.

React Router renders a boundary **at the route carrying it**, replacing that route's own element. A single mount on the outermost pathless parent therefore replaces the whole tree, `AppLayout` and its navigation included, so a protected page whose loader threw left the user able to escape only by pressing Back. The inner mount is a pathless route between `AppLayout` and the seven protected addresses: a failure in one of them is caught there, renders into `AppLayout`'s outlet, and the navigation survives.

**Moving the boundary onto the `AppLayout` route object instead does not work**, and it is the obvious first attempt. That route would then be the one the boundary replaces, and the navigation goes exactly as before. Both arrangements are covered by [`src/pages/dashboard.test.tsx`](src/pages/dashboard.test.tsx) and both fail it.

The outer mount stays, because a failure in the public tree — and a throw from the guard on `AppLayout` itself, which hangs above the inner mount — still has to land somewhere.

## The form screens

`/sign-up`, `/sign-in` and `/measurements` are the same shape, and each is a `Form` posting to an action in [`src/routes.tsx`](src/routes.tsx). None reads the API any other way, which is what ADR 002 asks of every screen — including the one read among them, which is `/measurements` prefilling through a loader rather than an effect.

**Registering does not sign anyone in.** `POST /register` answers with a user id and no token, so `signUpAction` redirects to `/sign-in` rather than to the dashboard. The alternative was to chain a second `POST /login` inside the same action and land on `/dashboard`; it saves one step and was declined, because a register that succeeds followed by a login that fails leaves an account made and the person reading an error on the page that asked them to make it.

**Saving measurements discards what the save answered with.** `POST /profile/metrics` writes the five figures and returns the targets computed from them, in one transaction. `measurementsAction` throws that body away and redirects to `/targets`, which reads them through `GET /targets` — one screen renders a target rather than two that can disagree, and the cost is the second request. The five figures are sent every time because the endpoint takes no partial update.

**The measurements form opens on what was saved last time.** `metricsLoader` reads `GET /profile/metrics` — the endpoint that exists for this and answers the five figures rather than the targets computed from them — and the five controls carry them as `defaultValue`, so the fields stay uncontrolled. React reads a default only at mount, which this screen wants twice: a figure the person overtypes stays overtyped, and a submission the API refused re-renders the component without remounting it, so the typed values survive above the message saying why. Holding the five in state would mean a change handler per field and a second copy of the form to keep in step with the first.

**A 404 from `GET /profile/metrics` is a state, not a failure**, on the same terms as the one from `GET /targets`: it means nothing has been saved, so the loader answers `null` and the form draws empty. Sending a first-time visitor to the error boundary instead would put a failure in front of the person on the very screen they were sent here to fill in.

**The confirmation travels in the address, not in memory.** That redirect carries `?created=1`, and `/sign-in` renders "Account created. Sign in to start." when it is present. The key is a named constant exported from `src/routes.tsx` beside the paths, for the reason ADR 002 gives for the paths themselves, and it holds a flag rather than the new username — a name in the address is a name in browser history and in every log between here and the host.

**What the action returns and what it throws decide which surface the person sees.** A failure the API answered with is returned, so `useActionData` puts the server's own message above the form and the typed fields survive; the 409 that `POST /register` raises for a taken username or email arrives this way, and `messageFrom` in [`src/api/errors.ts`](src/api/errors.ts) has already flattened both of the API's `detail` shapes into text. A request that got no answer at all is rethrown to the `ErrorBoundary`, because there is no form left to return to.

**Validation is the browser's, and it mirrors the server.** `required` on every field, `type="email"`, and `minLength={8}` against `Field(min_length=8)` on `RegisterIn` in [`../backend/main.py`](../backend/main.py); on `/measurements`, `type="number"` with the `min`, `max` and `step` of each bound on `MetricsIn` in the same file, and a `<select>` per enumeration so a value outside it cannot be typed. Change one side of any of those pairs and the other is now wrong. The password rule is also written on screen and tied to the input with `aria-describedby`, so it is known before submitting rather than after.

**The account screen posts every field it holds, changed or not.** `PUT /profile` replaces the account rather than patching it — `ProfileIn` declares all four fields required and there is no partial update — so a form sending only what changed would blank the rest. It reads through `profileLoader` and writes through `profileAction`, both in [`src/routes.tsx`](src/routes.tsx), and the four controls carry the loaded values as `defaultValue` on the same terms as `/measurements`. The 409 for a username or email already taken is returned rather than thrown, so it appears above the form with the typed values intact.

**A 404 from `GET /profile` is a failure, unlike the two the other loaders catch.** It means the account behind a token that still parses no longer exists, so `profileLoader` carries no rule of its own and the error boundary has it. `profileAction` answers `null` when the save worked, and the screen reads that as the confirmation: React Router gives `undefined` until an action has run, so the three states — never submitted, refused, saved — are told apart without a second flag.

**The account screen points at `/measurements` rather than drawing it.** The body measurements are a different endpoint with a different failure mode, and `GET /profile` answers nothing about them; [`../backend/main.py`](../backend/main.py) keeps the two apart deliberately, so the forms stay apart too.

**`PublicLayout`'s header drops its account links on `/sign-up` and `/sign-in`.** Each of those two already links to the other beneath its own button, which is where someone who picked the wrong one looks; the brand stays, so there is always a way back to `/`.

## The targets screen

`/targets` reads through `targetsLoader` in [`src/routes.tsx`](src/routes.tsx) and renders what it is given. It computes nothing: each figure is printed as the API sent it, and the only arithmetic on the screen is turning a timestamp into a date.

**A 404 from `GET /targets` is a state, not a failure.** The endpoint answers it until measurements have been saved, which is the only signal the system has that a user has supplied none. So `targetsLoader` catches that one status, answers `null`, and the screen renders a panel pointing at `/measurements`. The alternative was to rethrow and let the `ErrorBoundary` have it, and it is declined because a person who has simply not filled the form in yet would be told something went wrong. `/dashboard` reads through the same loader for the same reason, which is where that question is answered for a returning user who still holds a valid token — ADR 004.

**The date is formatted on a fixed locale, not the reader's.** `en-NZ`, assembled from `formatToParts` because that locale's own separator is a slash, so the line reads `dd-mm-yyyy HH:MM` on any machine. A screenshot of this screen goes in the report, and a browser set to `en-US` would otherwise put `09/25/2026` in front of a marker reading documents that say `25-09-2026`. An unparseable value drops the line rather than throwing, because losing the four figures over the note beneath them is the wrong trade.

**The note says where the figures come from and stops before saying how energy is divided.** `MACRO_SPLIT` in [`../backend/main.py`](../backend/main.py) carries `TODO: team to confirm the split`, and the proportions are marked `[CITE]` in `doc/design/product.md` in the documents repository `nomadwiz/kete-doc`. A proportion printed here would read, on screen and later in a screenshot, exactly like a sourced figure — which is the reasoning `/measurements` used for leaving its activity levels undescribed. The activity factors and the four-and-nine gram conversions stand on the same footing.

## The recipe list

`/recipes` both reads and writes. `recipesLoader` answers the list and `recipesAction` writes a new recipe, both in [`src/routes.tsx`](src/routes.tsx), and the screen holds no state of its own — everything it needs is in the address or in what the loader answered.

**The search is the API's.** `GET /recipes` takes an optional `q`, so the loader reads the term off its own request and passes it through. Filtering a fetched array here would search only what the browser already had and would stop agreeing with the endpoint the moment its matching rule changed. The search box is a `<Form>` with no method, which is a GET: the browser writes the term into the query string itself, and the address that results is the one to bookmark, share or refresh. The field is uncontrolled and keyed on the term, because an input somebody has typed into ignores a later change to its `defaultValue` — without the key, a term reached by pressing Back would leave the box reading the search before it, and pressing Search again would silently undo the Back.

**The creation form is a modal on this page, addressed `?new`.** ADR 002 decided both halves of that — the form belongs to whichever page hosts it rather than to a route of its own, and the open state belongs in the query string because a person who refreshes half-way through writing a recipe would be surprised to lose it. So the modal is open exactly while `new` is in the address, and every way of closing it — Escape, the Cancel button, a successful save — puts the address back rather than touching the element.

**It is a native `<dialog>`, opened with `showModal()`.** The top layer, the backdrop, the focus trap and Escape all come with that one call, and a `<div>` standing in for a dialog means writing four of them by hand. `showModal()` is a method rather than an attribute, so an effect follows the address and calls it; the `open` attribute alone gives an ordinary block and none of the four. The form itself is [`src/components/recipe-form.tsx`](src/components/recipe-form.tsx), shared with the edit view on `/recipes/:id`, and it declares no `action`, so it posts to whichever route renders it.

**The form is mounted only while the modal is open.** Its nine controls are uncontrolled and read their defaults at mount, so one left mounted behind a closed dialog would open again holding the recipe just saved. The same fact is what makes a refusal behave: a 422 leaves `new` in the address, so the form is re-rendered rather than remounted and what the person typed is still in it.

**Escape is refused while a save is in flight.** The POST may already have reached the API, so closing would abort it in the browser and discard both the nine typed fields and any refusal coming back, leaving somebody unable to tell whether the recipe was written. `cancel` fires before `close` and can be prevented, which is the other half of why this is a `<dialog>`.

**A 422 is returned and everything else is thrown.** `POST /recipes` declares 401 and 422 and nothing else; the 401 is `withSession`'s, and the 422 is the one failure on this route that is answered by typing something different, so it goes back to the form the person is still standing in. The rule is what the contract says the status means on this route rather than the number — the same 404 that is a state on `GET /profile/metrics` is a failure on `POST /profile/metrics`.

**A save renders nothing from its own reply.** `POST /recipes` answers a recipe id and nothing else, so there is no record to draw even if this screen wanted one. React Router revalidates the route's loader once the action returns, and the new row arrives from the same place every other row came from. The redirect that closes the modal drops the whole query string, the search included, because that is what guarantees the new recipe is in the list the person lands on — returning someone who searched for a laksa and then wrote a dal to “Nothing matches “laksa”” would read exactly like a save that did nothing. It replaces rather than pushes, so Back does not reopen an empty form one click from a duplicate.

**`photo_url` is optional, nullable, and expires.** A card with no photograph draws a panel rather than an `<img>` pointed at nothing, which every browser renders as a broken-image glyph. The link is presigned and good for an hour — `LINK_SECONDS` in [`../backend/storage.py`](../backend/storage.py) — so it is read off the loader's answer each time and stored nowhere.

**Two empty states, because they are different facts.** "You have not written a recipe yet" sends a new user to the form; "nothing matches" offers the whole list back. Telling someone who has just searched that their library is empty would be false on the evidence in front of them.

**A card opens the recipe by its name, not by the whole card.** A card-sized anchor takes the photograph and the figures into its own accessible name, so a screen reader reads the entire tile as the link text.

## The recipe detail page

`/recipes/:id` both reads and writes, and one page holds the read view and the edit form. `recipeLoader` answers the record and `recipeAction` saves it, both in [`src/routes.tsx`](src/routes.tsx).

**The edit form replaces the read view rather than floating over it**, addressed `?edit`. ADR 002 puts the switch in the query string and calls the result editing the recipe _in place_; a modal was weighed and declined, because the record being edited is the same record the page is already showing, so a dialog would draw the nine values twice — once editable, once not — and would cost the effect, the `cancel` handling and the close-event-to-address round trip that `/recipes` needs for a form that has no read view behind it. The form is [`src/components/recipe-form.tsx`](src/components/recipe-form.tsx), shared with the creation modal on `/recipes`, and it is mounted only while `edit` is in the address: its nine controls are uncontrolled and read their defaults at mount, which is both what keeps them showing what is stored and what lets a 422 keep what was typed.

**Cancel is a button rather than a link, and it is refused while a save is in flight.** Navigating away during a save abandons a `PUT` that may already have reached the API, discarding the nine typed fields and any refusal coming back and leaving somebody unable to tell whether the recipe was saved. `disabled` is how a button refuses; a link has no equivalent. The pending state comes from `useSubmitting("POST")` — [`src/use-submitting.ts`](src/use-submitting.ts) — which is true for any POST to this route, so C15 (#179)'s delete will narrow its own control on the submitted intent rather than by parameterising the hook.

**One action, branching on a submitted intent.** A submission carrying no intent is the save, which is the convention `recipe-form.tsx` set by declaring no intent field; C15 (#179)'s delete arrives as a second branch carrying `intent=delete`, and each branch owns its own destination, because a save lands back on the record and a delete cannot. `PUT /recipes/{recipe_id}` is a full replace with no partial update, so all nine `RecipeIn` fields travel whether or not they changed.

**The two 404s on this route go to different surfaces, and the contract is why.** `backend/openapi.json` gives both the same sentence — "No such recipe, or it belongs to another account" — but what a person can do about it differs. On the read it means the address names nothing, which is not a failure of the system: the loader answers `null` and the page draws its own not-found panel linking back to `/recipes`, because "Something went wrong" is false for a recipe deleted in another tab and the boundary offers no way onward from an address that will never answer. The contract's second clause is not shown, since the endpoint answers 404 rather than 403 precisely so as not to confirm that somebody else's record exists. On the save it means the record vanished mid-edit, and there returning the message would print it into a form the revalidation is about to unmount — the following read 404s in turn and the not-found panel replaces the page with the typed fields gone and nothing saying why. So the save catches **422 and nothing else**, and its 404 reaches the `ErrorBoundary`, which is the surface for a failure there is no form left to return to.

**An id that is not a whole number is answered as a missing recipe, without a request.** The API would refuse `/recipes/NaN` with a 422 about a path parameter, which is a sentence about the address rather than about the recipe, and this page already owns the right answer for an address that names nothing. The test is the raw path segment rather than `Number()`, which accepts `3.5`, `0x10` and `1e3`.

**No figure is computed here.** The four the API sent are rendered as they arrived — no per-serving division, no totals — and a note beside them says Kete does not work them out from the ingredients, which `doc/design/product.md` §5 puts out of scope. Somebody reading four numbers under that heading would otherwise assume it did. `ingredients` and `steps` are free text stored as one string each, so the line breaks somebody typed are the only structure there is: they are drawn as one block kept by `white-space: pre-wrap` rather than split into list items, which would invent a structure the contract does not carry.

## The dashboard

`/dashboard` is the hub: the four daily target figures, and the three principal areas. It reads through **the same `targetsLoader`** the targets screen uses, referenced from both route objects rather than copied. That is one occurrence short of where this project normally extracts, and it is deliberate — what is shared is the knowledge that a 404 from `GET /targets` means no measurements have been saved, and ADR 004 requires that rule live in one place.

**A fresh sign-in lands here unconditionally.** `signInAction` used to probe `GET /targets` itself and send a user with no measurements to `/measurements` instead. That covered the arrival it could see and not the other one: the token lasts twelve hours and the guard checks only that one is present, so a returning user who skipped the form never passed through the action at all. The check now sits in the loader, where both arrivals meet it, and sign-in makes one request rather than two. ADR 004 in `nomadwiz/kete-doc`, at [`doc/design/decisions/adr/004-no-measurements-check.md`](../../doc/design/decisions/adr/004-no-measurements-check.md).

**It tells the user rather than redirecting them.** A loader that threw `redirect(PATHS.measurements)` would cover the same two arrivals and was declined: `/dashboard` is where the navigation sends a signed-in user, so someone who chose to skip the form would be returned to it every time they tried to leave. The panel names the same gap and links to the same form.

**The areas render in both states.** Someone who has saved no measurements can still write recipes, and a hub that withholds the hub until a form is filled in is a redirect wearing different clothes.

**The list of areas is built inside the component, not as a module constant.** `routes.tsx` imports this page through [`src/pages/index.tsx`](src/pages/index.tsx) and the page imports `PATHS` back from `routes.tsx`, so the two modules are circular and `PATHS` is still undefined while the page evaluates. `app-layout.tsx` builds its own list inside its component for the same reason. Hoisting either to the top level type-checks, lints and then crashes the application on load.

**Three things the wireframe draws are not here.** A greeting would need `GET /profile`, a second endpoint with a different failure mode on the screen every sign-in now lands on. A Log out button would duplicate the shell's, which is on every page and is what FR-14 asks for. And the planned week against the targets needs `GET /mealplan/summary?week=`, which ADR 001 designs and no endpoint answers — drawing it from `GET /mealplan` would mean computing a nutrition figure here, which this client does not do.

## Where things go

| Path              | What belongs there                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.css`   | The tokens every screen is styled from, a light reset, and base element styling — including how a form control looks, so every form screen inherits one. The one global stylesheet; nothing page-specific belongs in it (C5, #170)        |
| `src/routes.tsx`  | Every path string, once; the route objects; their loaders and actions                                                                                                                                                                     |
| `src/pages/`      | One file per page, and beside it that page's stylesheet                                                                                                                                                                                   |
| `src/api/`        | Talking to the API: `http.ts` the transport, `session.ts` the credential and what an ended session means, `token.ts` its storage, `errors.ts` the error shapes. Nothing here knows the router (C2, #167)                                  |
| `src/types/`      | `api.ts`, generated from the API's schema and never edited; beside it one small file per subject aliasing the schemas a screen needs, so a page imports `Targets` rather than `components["schemas"]["TargetsOut"]` (C2, #167; C21, #235) |
| `src/components/` | The route error boundary, the two layouts and their stylesheets, and shared presentational pieces — including the recipe form used by both the creation modal and the edit view (C4, #169; C13, #178)                                     |
| `src/test/`       | The Vitest setup file, and the helpers that render the real route array against a stubbed `fetch`. Tests themselves sit beside what they test (C22, #236)                                                                                 |

## Talking to the API

The enum spellings the API validates, the endpoint list and the authentication scheme are in [`../backend/README.md`](../backend/README.md), and the code that enforces them is [`../backend/main.py`](../backend/main.py). Where a description and the code disagree, the code is right — so read the code rather than copying either into this file.

**The types are generated from the contract, not written against it.** [`../backend/openapi.json`](../backend/openapi.json) is the schema FastAPI builds from [`../backend/main.py`](../backend/main.py), exported by `../backend/export_openapi.py` and committed so that a build needs no running API. `openapi-typescript` turns it into [`src/types/api.ts`](src/types/api.ts), and `npm run dev`, `npm run build` and `npm test` each regenerate that file before they start — so a field renamed or dropped in `main.py` reaches the screens that read it as a type error rather than as an empty space on the page.

**Never edit `src/types/api.ts`, and never add a hand-written type beside it.** Change `main.py`, run `python export_openapi.py`, and the next build carries the change through. The four files beside it are aliases and hold no field names of their own: `auth.ts`, `measurement.ts`, `recipe.ts` and `targets.ts` each name the schema a screen wants under the name that screen already imports, because the wire names differ in three places — `RegisterIn`, `LoginIn` and `LoginOut` for the two auth pairs, `MetricsIn` for the measurement form, `TargetsOut` for the figures. Add an alias when a screen needs one; `RecipeIn` serves both writing a recipe and editing one, so there is no create-and-update pair to look for.

`api.ts` is committed so that a clone can be read and linted without generating anything first, but nothing trusts the committed copy: every script that type-checks rewrites it first, so a stale one is overwritten rather than believed. The other side of the contract is held by `../backend/tests/test_contract.py`, which fails when `openapi.json` stops describing `main.py` — together the two mean a rename in `main.py` cannot reach a screen unnoticed.

## Scripts

| Script                   | What it does                                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| `npm run dev`            | Regenerates the types, then the Vite dev server on 5173, with hot reload         |
| `npm run generate:types` | Rewrites `src/types/api.ts` from `../backend/openapi.json`                       |
| `npm run build`          | Regenerates the types, type-checks, then writes the deployable bundle to `dist/` |
| `npm run preview`        | Serves `dist/` — use it to test deep links against a real build                  |
| `npm test`               | Regenerates the types, then Vitest over `src`, once, in jsdom                    |
| `npm run lint`           | ESLint over the project, config files included                                   |
| `npm run format`         | Rewrites files with Prettier                                                     |
| `npm run format:check`   | Reports without rewriting; this is the one CI runs                               |
