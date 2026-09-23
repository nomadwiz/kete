# Kete client

The browser tier of the Kete meal planner: React with TypeScript, built by Vite and served as static files. It talks only to the REST API in [`../backend`](../backend), and it **never computes a nutrition figure** — every number on screen came from the API, so there is one implementation of the arithmetic and one place to correct it.

## Status

The project, the router and eleven routed pages exist. **No screen calls the API yet** — every page renders its own name and nothing else, so the client runs without the backend and shows nothing useful with it.

Known gaps, each tracked as an issue rather than left in this file:

| Gap                                                              | Issue                            |
| ---------------------------------------------------------------- | -------------------------------- |
| No API client, token storage or error surface                    | C2 (#167)                        |
| Every page is a placeholder; no screen calls the API             | #170–#184                        |
| No layout, navigation, sign out or route guard                   | C4 (#169)                        |
| Types are hand-written rather than generated from the API schema | blocked on S1 (#138)             |
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

## How routing works

Read this before adding a screen. Three rules, and the third is a requirement on the people who host this build rather than on the code.

**Every path string is written once**, in [`src/routes.tsx`](src/routes.tsx), as a named constant that pages and navigation import. No path literal appears anywhere else. That is what lets the addressing scheme change in one import instead of eleven files.

**Route data is loaded in data mode.** The router is built with `createBrowserRouter`, so an API call belongs in a route `loader` and a failure surfaces through a route `ErrorBoundary` rather than a `try`/`catch` in each page. A write is a route `action`, and completing one re-runs that route's loader on its own, so a list refreshes itself after a create or a delete. This is why no screen builds a request of its own.

**Addresses are ordinary paths, so the host must answer for them.** The client routes on browser history — `/recipes/3`, no `#` fragment — which means a deep link or a refresh sends a real request for a path that is not a stored file. **Any request whose path does not match a stored object must be answered with `index.html` and a 200 status.** Amazon S3 static website hosting does not do this on its own: it substitutes the configured error document but keeps the original 404, and its website endpoints serve no HTTPS at all. K6 (#192) and K13 (#193) own that problem.

View state a user would expect to survive a refresh lives in the query string rather than in a component: the recipe creation modal is `/recipes?new`, and the edit form is `/recipes/:id?edit`.

The reasoning for all of this is ADR 002, in the documents repository `nomadwiz/kete-doc` at [`doc/design/decisions/adr/002-client-routing.md`](../../doc/design/decisions/adr/002-client-routing.md). That link resolves only when both repositories are cloned in the layout `nomadwiz/kete-doc`'s own `README.md` sets out.

## Where things go

| Path              | What belongs there                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes.tsx`  | Every path string, once; the route objects; their loaders and actions                                                           |
| `src/pages/`      | One file per page                                                                                                               |
| `src/api/`        | The fetch wrapper, token storage and the one error surface (C2, #167)                                                           |
| `src/types/`      | Types matching the FastAPI schema (C2, #167)                                                                                    |
| `src/components/` | Shared presentational pieces, including the recipe form used by both the creation modal and the edit view (C4, #169; C13, #178) |

## Fixed values — do not vary the spelling

The API validates these exactly and answers 422 otherwise. `../backend/main.py` is the source; where this list and the code disagree, the code is right.

- `sex`: `male`, `female`
- `activity_level`: `sedentary`, `light`, `moderate`, `active`, `very_active`
- `meal_position`: `breakfast`, `lunch`, `dinner`
- `day_of_week`: `Mon` … `Sun`
- errors are always `{"detail": "message"}`

Authentication is `Authorization: Bearer <token>` on every endpoint except `/register` and `/login`. `POST /login` returns the credential in a field named **`token`**, not `access_token`, and there is no `token_type`. The token lasts twelve hours and there is no refresh, so an expired one surfaces as a 401 at an arbitrary moment and has to sign the user out from wherever it happens. The API reads the user id out of the token, so the client never sends one.

## Scripts

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Vite dev server on 5173, with hot reload                        |
| `npm run build`        | Type-checks, then writes the deployable bundle to `dist/`       |
| `npm run preview`      | Serves `dist/` — use it to test deep links against a real build |
| `npm run lint`         | ESLint over the project, config files included                  |
| `npm run format`       | Rewrites files with Prettier                                    |
| `npm run format:check` | Reports without rewriting; this is the one CI runs              |
