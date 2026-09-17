---
assignment: A02 — Research Report (Team Project)
course: S2_INFS803_CloudComputing
option: Choice B — Cloud Web Application Development and Deployment
due: 2026-10-16 (Friday, Week 12)
word_count_target: not specified
status: draft — sections 5, 6 and 7 written; 1–4 and 8–12 outstanding
---

# Kete — INFS803 Research Report

**Nutrition-aware meal planning on AWS**

Sokhour Lay · Nicholas Shih Hao Ng · Kyle Wakos
INFS803 Cloud Computing, Semester 2 2026 · Choice B
Submitted 16 October 2026

| | |
|---|---|
| **Git repository** | https://github.com/nomadwiz/kete |
| **Web client URL** | `[after deployment]` |
| **Backend API URL** | `[after deployment]` — interactive documentation at `/docs` |

---

> **Editorial note — delete before submission.**
> Sections 5, 6 and 7 are drafted. Outstanding work is listed below.
>
> | Section | Status | Blocked on |
> |---|---|---|
> | 1. Member Contribution | Not started | End of project |
> | 2. Presentation Video | Not started | Recording in Week 11 |
> | 3. Project Links | Partial | Deployment (client and API URLs) |
> | 4. Introduction | Not started | Best written last |
> | 5. Background and Requirements | **Drafted** | — |
> | 6. Project Management | **Drafted** | Notion snapshots and URLs; §6.7 rewritten at the end |
> | 7. Design | **Drafted** | — |
> | 8. Cloud Implementation | Not started | Kyle's AWS build and screenshots |
> | 9. User Manual | Not started | Deployed application |
> | 10. RESTful API List | Skeleton | Backend base URL |
> | 11. Summary | Not started | End of project |
> | 12. AI Usage Declaration | Not started | Form in `final/` |
>
> Figures referenced in Section 7 live in `../design/`: `fig_architecture.png`,
> `fig_erd.png`, `user_journey.svg`, `user_flow.jpg`. The AWS deployment diagram
> `aws_deployment.svg` belongs in Section 8.

---

## 1. Member Contribution

*[One paragraph per member, stating concrete contributions. Cross-reference the Git
history and the Notion worklog so each claim is verifiable — see Section 6.5.]*

| Member | Tier | Contribution |
|---|---|---|
| Sokhour Lay | Backend / API | *[to complete]* |
| Nicholas Shih Hao Ng | Front end | *[to complete]* |
| Kyle Wakos | Cloud / deployment | *[to complete]* |

---

## 2. Presentation Video

*[Public link to the video, under five minutes, with all three members presenting.]*

Video: `[URL]`

---

## 3. Project Links

| Resource | URL |
|---|---|
| Git repository | https://github.com/nomadwiz/kete |
| Web client | `[after deployment]` |
| Backend API | `[after deployment]` |
| Interactive API documentation | `[backend URL]/docs` |
| Demo account for markers | `[username and password]` |

---

## 4. Introduction

*[Purpose, scope, and what the application does. Write this last, once the
surrounding sections are settled, so it frames what the report actually contains.]*

---

## 5. Project Background and Requirements Analysis

### 5.1 Background

Dietary guidance is abundant, but acting on it is not straightforward. A person
who wishes to eat to a nutritional standard must complete three separate tasks:
establish what their body actually requires, select meals that satisfy that
requirement, and organise those meals across a period of time so that shopping
and cooking remain practical. Each task demands a different kind of effort. The
first is arithmetic applied to physiological measurements, the second requires
nutritional knowledge of individual foods, and the third is a scheduling problem.

The consequence of this division is that many people attempt none of the three.
The calculation is performed once, if at all, on a website that does not retain
the result. Recipes accumulate across bookmarks, photographs, and handwritten
notes with no nutritional information attached. Planning, where it occurs, takes
place on paper and is discarded at the end of the week. The information required
to eat well therefore exists, but it is fragmented, and the burden of assembling
it falls entirely on the individual.

Kete addresses the first and third of these tasks. It calculates and retains a
user's personal nutritional targets, and it provides a structure in which their
own recipes can be organised into a weekly plan. It deliberately does not attempt
the second task, which would require a per-ingredient nutritional data source and
lies outside what a three-person team can deliver within a semester. This
boundary is examined further in Section 5.4 and revisited in Section 11.

The application also serves an academic purpose. The assignment requires a
three-tier web application deployed to a public cloud, decoupled through RESTful
services, using a managed cloud database and cloud object storage. Kete was
selected from several candidate projects because it exercises each of these
requirements naturally rather than artificially. It has genuine server-side
logic in the nutrition engine, a relational data model with meaningful
constraints, and a binary asset in the recipe photograph that must be stored
outside the database.

---

### 5.2 Users and their needs

Two classes of user interact with the system, and they have materially different
requirements.

The **planner** is the primary user: an individual managing their own nutrition,
assumed to be reasonably comfortable with a web application but to hold no
nutritional expertise. This user needs their targets calculated for them rather
than explained to them, needs their recipes to persist and remain private, and
needs planning to be fast enough to be worth doing weekly. The last of these
needs is what motivates the automatic week-generation feature described in
FR-11; a planner asked to fill twenty-one meal slots by hand each week will
abandon the exercise.

The **marker** is a secondary but mandatory user, arising from the assignment
rather than from the problem domain. This user must be able to reach the client
and the backend at public URLs, and must be able to exercise the backend
independently of the client. This requirement is unusual, in that it constrains
the architecture directly: it is not satisfied by documentation, but only by an
API that is genuinely separable from its client. Its influence is traced in
Section 7.3.

---

### 5.3 Functional requirements

The functional requirements are grouped by capability. Each is traced to the page
that exposes it and to the endpoint or endpoints that implement it, which permits
verification that every stated requirement has both an interface and an
implementation.

| ID | Requirement | Page | Endpoint |
|---|---|---|---|
| FR-1 | A visitor can create an account with a first name, last name, username, email address, and password | Sign up | `POST /register` |
| FR-2 | A registered user can sign in and receive a credential authorising subsequent requests | Log in | `POST /login` |
| FR-3 | A signed-in user can view and amend their account details | Account | `GET /profile`, `PUT /profile` |
| FR-4 | A user can record their weight, height, age, sex, and activity level | Fill profile | `POST /profile/metrics` |
| FR-5 | The system calculates daily energy and macronutrient targets from those measurements | See targets | `POST /profile/metrics` |
| FR-6 | A user can view their calculated targets at any time | See targets, Dashboard | `GET /targets` |
| FR-7 | A user can create a recipe with a name, cuisine, ingredients, method, serving count, and nutritional values per serving | Add recipe | `POST /recipes` |
| FR-8 | A user can attach a photograph to a recipe | Add / edit recipe | `POST /recipes/{id}/photo` |
| FR-9 | A user can browse, search, view, amend, and delete their recipes | Recipes, View recipe, Edit recipe | `GET /recipes?q=`, `GET /recipes/{id}`, `PUT /recipes/{id}`, `DELETE /recipes/{id}` |
| FR-10 | A user can place a recipe in a specified meal position on a specified day of a specified week, and remove it again | Weekly planner | `POST /mealplan`, `DELETE /mealplan/{id}` |
| FR-11 | A user can generate an entire week's plan automatically from their recipe library | Weekly planner | `POST /mealplan/generate` |
| FR-12 | A user can clear an entire week's plan in a single action | Weekly planner | `DELETE /mealplan/week/{week}` |
| FR-13 | A user can view the plan for a given week | Weekly planner | `GET /mealplan?week=` |
| FR-14 | A user can sign out from any signed-in page | All signed-in pages | client-side credential disposal |
| FR-15 | All data is private to the user who owns it | — | enforced at every authenticated endpoint |

FR-15 is stated as a functional requirement rather than as a security property
because it is observable behaviour: a user requesting a record belonging to
another user receives a response indicating that no such record exists. The
mechanism is described in Section 7.3.

Two requirements deserve comment. FR-5 specifies calculation rather than
retrieval, which is what gives the application server-side logic of substance:
the Mifflin-St Jeor equation produces a basal metabolic rate, an activity factor
scales it into a total daily energy expenditure, and that figure is divided into
protein, carbohydrate, and fat by proportion and converted into grams. FR-11 was
added after the initial specification, when the team recognised that manual
placement alone would not produce a planner anyone would use twice.

---

### 5.4 Requirements deliberately excluded

Four capabilities were considered and excluded. Grocery shopping and price
comparison, meal delivery, and payment handling each introduce a dependency on an
external commercial service, which would place the project's completion partly
outside the team's control. A shared or social recipe library would require
moderation and a materially more complex authorisation model without exercising
any additional cloud service.

A per-ingredient nutritional database was the most significant exclusion, and it
is the reason nutritional values are supplied by the user per recipe rather than
derived from ingredients. Deriving them would require either a licensed food
composition dataset or an external nutrition API, and would introduce unit
parsing, ingredient matching, and portion inference — a substantial subsystem
that would consume time better spent on the cloud deployment the assignment is
actually assessing. This is recorded as a future enhancement in Section 11.

---

### 5.5 Non-functional requirements

| ID | Attribute | Requirement |
|---|---|---|
| NFR-1 | Availability | The client and the backend remain reachable at public URLs from submission until marking is complete |
| NFR-2 | Security | Passwords are never stored in recoverable form; every non-public endpoint requires a valid credential; the database is unreachable from the public internet |
| NFR-3 | Privacy | Physiological measurements are the most sensitive data held, and are read by the fewest possible code paths |
| NFR-4 | Integrity | Rules that must always hold are enforced by the database rather than by application code |
| NFR-5 | Testability | The backend can be exercised in full without the client present |
| NFR-6 | Usability | A signed-in user can reach any principal area of the application in no more than two steps from the dashboard |
| NFR-7 | Cost | The deployed system operates within the AWS Free Tier or available student credits for the duration of the project |
| NFR-8 | Maintainability | Client and server are developed against an agreed interface, so either may change internally without the other being modified |

NFR-3 is the requirement that most directly shaped the data model. Because the
raw measurements are the most sensitive data the application holds, the
calculated targets are stored as a separate entity, and every screen that
displays a target reads only that derived entity. The measurements themselves are
read by one code path. NFR-4 similarly shaped the schema, and its consequences —
unique constraints, a composite constraint on the plan slot, and cascading
deletion — are set out in Section 7.2.

---

### 5.6 Constraints and assumptions

The constraints are largely imposed rather than chosen.

| ID | Constraint | Source |
|---|---|---|
| C-1 | The architecture must be three-tier, and the backend must be reachable without the client | Assignment brief |
| C-2 | At least ten RESTful endpoints, of which at least three use POST | Assignment brief |
| C-3 | The database must be a managed cloud service; a database local to the virtual machine is prohibited | Assignment brief |
| C-4 | Assets must be held in cloud object storage | Assignment brief |
| C-5 | Source control must be a cloud Git service with no history rewriting, so individual contribution remains visible | Assignment brief |
| C-6 | The team comprises three members with limited prior AWS experience | Team context |
| C-7 | Delivery must complete within the semester, with a two-week mid-semester break | Course calendar |
| C-8 | Operating cost must remain within free-tier or credit allowances | Team context |

C-6 and C-7 are the constraints that determined the technical approach more than
any requirement did. They are the reason a virtual machine was preferred to a
serverless implementation, and the reason the feature set was fixed early and
held. The trade-off is examined in Section 7.5.

The design further assumes that concurrent usage is low, in the order of tens of
users (A-1); that users have internet access and a current browser (A-2); that
recipe photographs are of the order of a few hundred kilobytes (A-3); that a
single AWS region is sufficient, since low global latency is not required (A-4);
and that free-tier provision or credits remain available through the marking
period (A-5). A-1 is the assumption on which the sizing in Section 7.5 depends,
and it would not hold for a production deployment.

---

### 5.7 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Deployment difficulties emerge late, when there is no time to resolve them | Deploy a trivial application to the cloud early to prove the pipeline, before the application itself is complete |
| R-2 | Scope expands beyond what three members can deliver | The feature set is fixed in Section 5.3; additions are recorded as future enhancements rather than adopted |
| R-3 | Unfamiliarity with AWS delays the infrastructure | The mid-semester break is reserved for infrastructure rather than new features |
| R-4 | Contribution is uneven, or cannot be evidenced | Each member owns one tier, commits under their own account, and records work in a timestamped worklog |
| R-5 | Client and server development block one another | The interface is agreed before implementation, and the backend is published returning representative data so client work can begin immediately |
| R-6 | Sensitive physiological data is exposed | Access is restricted to a single code path, storage is encrypted at rest, and the database is not reachable from the internet |

R-1 and R-5 both proved material during delivery, and the mitigations recorded
against them were followed rather than merely stated. Their outcomes are
reflected upon in Section 11.

---

### 5.8 From requirement to cloud design

The requirements translate into cloud services directly, and the translation is
what distinguishes this design from a local application deployed remotely.

Reaching a personal plan from any device without installation (FR-1 to FR-14,
NFR-1) requires public hosting of both a client and an API, which is satisfied by
static website hosting for the compiled client and a virtual machine for the API.
Retaining data reliably without the team operating a database server (NFR-1,
NFR-4, C-3) is satisfied by a managed relational database service, which supplies
automated backup and point-in-time recovery that the team could not implement
itself within the time available. Storing photographs (FR-8, A-3, C-4) is
satisfied by object storage, which is priced for binary assets and can serve them
to the browser directly, keeping them out of the relational store. Operating
within a student budget (NFR-7, C-8) is satisfied by consumption-based pricing
and free-tier allowances, under which the deployment can be stopped when it is
not required.

Two requirements are satisfied by network configuration rather than by any
service selection. NFR-2 requires that the database be unreachable from the
public internet, which is achieved by placing it in a private subnet and
permitting connections only from the security group of the application tier.
NFR-5 requires that the backend be exercisable alone, which is achieved by giving
it a public address of its own and generating interactive documentation from the
API specification. The specific services chosen, and the alternatives set aside,
are justified in Section 7.5, and their configuration is evidenced in Section 8.

---

## 6. Project Management

### 6.1 Approach

The team comprises three members, which is small enough that a lightweight
process was appropriate but large enough that unmanaged parallel work would have
produced conflicts. Two decisions shaped the approach.

The first was to align ownership with the architecture. Each member owns one tier
— backend, front end, and cloud — so that responsibility for any given piece of
work is unambiguous and each member's contribution is visible in the repository
without further explanation. Documentation is shared, with each member writing
the report sections covering their own tier.

The second decision was to define the interface between the tiers before
implementing any of them. Because the client and the API are decoupled through
REST, they can be built simultaneously provided both sides agree in advance on
what passes between them. Four rules were fixed and recorded on the project hub
page, where they function as a contract rather than as a note:

1. The API base URL is supplied by an Angular environment file and never
   hardcoded, so the client can address a local server during development and the
   deployed server afterwards without code changes.
2. Cross-origin resource sharing is enabled in the API from the outset, because
   the client is served from object storage and the API from a virtual machine,
   which are different origins.
3. Errors always take the form `{detail: "message"}`, so the client implements
   one error handler rather than one per endpoint.
4. Enumerated values are spelled exactly as agreed: `male` and `female`;
   `sedentary`, `light`, `moderate`, `active`, `very_active`; `breakfast`,
   `lunch`, `dinner`.

The practical consequence was that the backend was published first as seventeen
endpoints returning representative sample data. Front end development began
against those, while the real logic and database access were implemented behind
the same interface. Neither member waited on the other, and neither needed to
understand the other's implementation.

---

### 6.2 Work breakdown structure

Work is decomposed into seven packages, each owned by one member or shared. The
complete task list, with owner, week, tier, and status for every item, is
maintained in the Tasks database in Notion.

| WBS | Work package | Owner | Principal tasks |
|---|---|---|---|
| **1** | **Project management** | All | Confirm submission date and AI policy; establish Notion workspace; agree the integration contract; set the weekly meeting; maintain the worklog |
| **2** | **Design** | All | User journey and page flow; entity relationship model; API specification; architecture and deployment diagrams |
| **3** | **Cloud infrastructure** | Kyle | AWS account and free-tier terms; VPC with public and private subnets; security groups; RDS PostgreSQL; EC2 instance; two S3 buckets; evidence capture |
| **4** | **Backend** | Sokhour | FastAPI scaffold; request and response models; seventeen stub endpoints; authentication with JWT and password hashing; nutrition engine; SQLAlchemy models and schema; database wiring; photo upload to object storage |
| **5** | **Front end** | Nicholas | Angular scaffold; environment configuration; routing for eleven pages; authentication screens; profile and targets; recipe library; weekly planner; account |
| **6** | **Integration and deployment** | All | Deploy client and API to public URLs; end-to-end integration testing; security review |
| **7** | **Documentation and presentation** | All | Report sections by tier; evidence collation; presentation video; AI usage declaration; final assembly to PDF |

Packages 3, 4, and 5 run concurrently, which the integration contract in Section
6.1 is what makes possible. Package 6 depends on all three completing, and is
therefore the point at which the project is most exposed to slippage in any one
of them.

**[Snapshot 6.1 — Tasks database, grouped by owner]**
Notion Tasks database: `[…]`

---

### 6.3 Schedule and milestones

Work runs from Week 5 to Week 11, with the report due on Friday 16 October 2026. The
two-week mid-semester break falls between Week 6 and Week 7 and is not counted as
an academic week. It was deliberately allocated to standing up cloud
infrastructure rather than to new features, on the reasoning that infrastructure
is the work most likely to encounter unfamiliar obstacles and least able to
absorb them late in the schedule.

| Week | Dates | Phase | Milestone | Owner |
|---|---|---|---|---|
| W5 | 10–16 Aug | Foundations | Team, roles, and technology stack settled; repository created | All |
| W6 | 17–23 Aug | Design | API specification, database schema, and diagrams complete | All |
| Break | 24 Aug – 6 Sep | Buffer | Cloud infrastructure live, with a trivial application deployed | Kyle |
| W7 | 7–13 Sep | Foundations in code | Seventeen endpoints deployed at a public URL | Sokhour |
| W8 | 14–20 Sep | Backend | Backend complete: real logic, nutrition engine, database wired | Sokhour |
| W9 | 21–27 Sep | Front end | All eleven screens built and connected to the API | Nicholas |
| W10 | 28 Sep – 4 Oct | Deploy | Client and backend live on public URLs, integration tested | All |
| W11 | 5–11 Oct | Harden and document | Security pass and end-to-end testing; report written, video recorded | All |
| W12 | 12–16 Oct | Submit | Final PDF submitted by Friday 16 October | All |

The critical path runs from the technology stack decision, through the cloud
infrastructure and the backend, to deployment in Week 10. The front end, although
substantial, is not on the critical path, because it can be developed against the
stub API and only requires the deployed backend at integration.

Deploying a trivial application to the cloud during the break, well before the
real application was ready, was a deliberate risk control rather than an early
start. It proves the deployment pipeline at a point where a failure costs days
rather than the project, and it directly addresses risk R-1 in Section 5.7.

**[Snapshot 6.2 — Milestones database]**
Notion Milestones database: `[…]`

---

### 6.4 Meetings

The team meets weekly at a fixed time, with additional short meetings at the
integration points where one member's output becomes another's input. Each
meeting is recorded in the Meetings database with its date, attendees, decisions,
and resulting actions, and every action becomes a row in the Tasks database with
an owner and a due date, so that no decision is recorded without a consequence.

Between meetings the team communicates asynchronously, and decisions reached that
way are written back into the relevant Notion page rather than left in the message
history. The integration contract in Section 6.1 was settled this way.

**[Snapshot 6.3 — Meetings database with minutes]**
Notion Meetings database: `[…]`

---

### 6.5 Worklog and evidence of contribution

Contribution is evidenced two ways, deliberately, because each is weak alone.

The **Notion worklog** records what was worked on, by whom, and when. Each entry
carries an automatic timestamp applied when the row is created rather than a date
typed in afterwards, and links to the corresponding commit where one exists. The
worklog captures work that produces no commit — design decisions, AWS console
configuration, writing — which would otherwise be invisible.

The **Git history** records the code itself. Every member commits under their own
GitHub account, and history is never rewritten, in accordance with the brief. The
repository is a single mono-repo containing both `/frontend` and `/backend`, so
that all contributions appear in one history and can be compared directly. At the
time of writing the history shows the repository initialised in Week 5, followed
by the backend implemented across four commits that build up from the endpoint
scaffold to full database wiring.

Neither record is sufficient by itself: the Git history omits work that produces
no code, and a worklog alone is an assertion rather than evidence. Together they
allow any claim in the Member Contribution section of this report to be verified
against an independent, timestamped source.

**[Snapshot 6.4 — Worklog, showing timestamps]**
Notion Worklog database: `[…]`
Git repository: `[…]`

---

### 6.6 Tools

| Tool | Used for | Why |
|---|---|---|
| Notion | Work breakdown, schedule, milestones, meeting minutes, worklog | Databases rather than static pages, so the same tasks can be viewed by owner, by week, or by tier without maintaining three lists. Row timestamps are automatic, which is what makes the worklog evidential |
| GitHub | Source control, contribution history | Required by the brief. A single repository keeps both tiers in one history |
| Draw.io | Design diagrams | Diagram sources are stored alongside the report, so figures can be revised rather than redrawn |
| Shared OneDrive | Report drafts and design sources | Version history for the written deliverables |

The brief names Trello as an example project management tool. Notion was chosen
instead because the same data can be presented as a task board, a schedule, and a
worklog without duplication, which Trello's card model does not support as
directly.

---

### 6.7 Reflection on the plan

*To be completed at the end of the project. The observations below are recorded
now, while accurate, and should be revised once the outcome is known.*

Two departures from the plan are worth recording.

The **backend ran ahead of schedule.** Endpoints, authentication, the nutrition
engine, and database wiring were completed during the mid-semester break rather
than in Weeks 7 and 8 as planned. The gain was real but narrower than it appears:
it did not advance the critical path, because deployment still depends on the
cloud infrastructure, and it did not help the front end, which had the stub API to
work against regardless. The lesson is that in a project with parallel tracks,
progress on one track is only worth what it unblocks elsewhere.

The **schedule was initially built on an incorrect semester calendar,** which
placed the mid-semester break a week later than it falls. The error was found when
the team reviewed the timeline together, and it was corrected across the proposal
and the Notion workspace. Had it gone unnoticed, every date from Week 7 onwards
would have been wrong by a week, and the buffer allocated to infrastructure would
have been consumed silently.

*[Add at the end of the project: whether the milestones were met, where the
estimates were wrong and by how much, and what the team would do differently.]*

---

## 7. High-Level and Detailed Design

### 7.1 Three-tier architecture

Kete is built as a three-tier web application, which separates the presentation
of information, the logic that produces it, and the storage that preserves it.
Each tier runs as an independently deployed component, and each communicates only
with the tier directly beneath it.

The **client tier** is an Angular application written in TypeScript and compiled
to static files. It contains eleven pages and holds no business logic of its own.
Its responsibility is limited to presenting information and collecting input. It
is served from Amazon S3 in static website mode, so no application server is
required to deliver it.

The **application tier** is a RESTful API implemented in Python using the FastAPI
framework, running on an Amazon EC2 instance. All business logic resides here,
including authentication, authorisation, validation, and the nutrition engine
that converts body metrics into daily energy and macronutrient targets. This tier
is the only component that holds database credentials.

The **data tier** consists of a managed PostgreSQL database on Amazon RDS,
together with an Amazon S3 bucket for recipe photographs. The database stores all
structured application data, while S3 stores binary assets. Only the URL of each
photograph is recorded in the database, which keeps the relational store small
and allows images to be delivered directly to the browser.

![[fig_architecture.png|629]]

Figure 7.1 shows the architecture and the flow of requests between the tiers.

The separation is enforced rather than merely intended. The client is unable to
reach the database because it possesses no credentials and because the database
accepts connections only from the application tier. Every interaction between the
client and the data therefore passes through the API, where authorisation is
applied. This arrangement satisfies the requirement that the client and backend be
decoupled through RESTful services, and it also produces a practical benefit for
assessment, since the backend is reachable at its own public URL and can be
exercised without the client present.

---

### 7.2 Database design

![[fig_erd.png|614]]

The data model consists of five entities. Figure 7.2 presents the entity
relationship diagram.

**User** is the central entity and stores account identity, comprising the user
identifier, first and last name, username, email address, password hash, and
creation timestamp. Both username and email carry unique constraints, since each
must identify exactly one account.

**Profile** stores the physiological measurements from which targets are
calculated, namely weight, height, age, sex, and activity level. The relationship
to User is one to one, which is enforced by a unique constraint on the foreign
key.

**NutritionTarget** stores the daily energy and macronutrient values produced by
the nutrition engine. It also holds a one to one relationship with User.

**Recipe** stores a user's recipes, including name, cuisine, ingredients, method,
number of servings, nutritional values per serving, and the URL of the associated
photograph in S3. A user may own many recipes.

**PlanSlot** records the placement of one recipe in one meal position on one day
of a given week. It is a junction entity, because it holds foreign keys to both
User and Recipe, and it therefore expresses the many to many association between
recipes and the days on which they are planned.

Three design decisions in this model merit explanation.

First, computed targets are stored in a separate entity rather than recalculated
whenever they are displayed. The nutrition engine executes once, when metrics are
saved, and the result is written to NutritionTarget. Screens that display targets
read only this derived entity and never access the raw measurements in Profile.
This reduces repeated computation, and it also limits the number of code paths
that read the most sensitive data the application holds.

Second, photographs are stored in object storage rather than in the database, and
only the resulting URL is persisted. Storing binary data in a relational database
would increase its size substantially, slow backup and restoration, and forfeit
the ability of the browser to retrieve images directly.

Third, PlanSlot carries a composite unique constraint across user, week, day, and
meal position. This makes it impossible for two recipes to occupy the same meal
slot, and the rule is enforced by the database rather than by application code.
Referential integrity is maintained through cascading deletion, so removing a user
removes their profile, targets, recipes, and plan slots, and removing a recipe
removes any plan slots that reference it. Enforcing these rules in the schema
means they hold regardless of which code path performs the operation.

---

### 7.3 RESTful API design and decoupling

The API exposes seventeen endpoints, of which seven use the POST method. This
exceeds the requirement of at least ten endpoints including at least three POST
methods. The complete list with access URLs appears in Section 10.

The design follows REST conventions. Resources are addressed by path, so recipes
are available at `/recipes` and an individual recipe at `/recipes/{id}`. The HTTP
method expresses the operation, with GET retrieving, POST creating, PUT updating,
and DELETE removing. Requests and responses use JSON. Each request is
self contained and carries the information needed to process it, so the server
retains no session state between requests.

Authentication uses a JSON Web Token issued at login. Two endpoints are public,
namely registration and login, and the remaining fifteen require an authorisation
header. The user identifier is read from the token rather than accepted from the
client, and every database query is scoped by that identifier. A client therefore
cannot request another user's data by altering a parameter, because no user
identifier is ever supplied by the client.

Response codes are used deliberately to communicate meaning. Attempting to
register a username or email that already exists returns 409 Conflict. Attempting
to place a recipe in an occupied meal slot also returns 409, reflecting the
database constraint described in Section 7.2. Requesting a resource belonging to
another user returns 404 Not Found rather than 403 Forbidden, because a 403
response would confirm that the resource exists and thereby disclose information.
Invalid values, such as an activity level outside the five permitted options, are
rejected with 422 Unprocessable Entity before the request reaches application
logic.

Because FastAPI derives an OpenAPI specification from the code itself, an
interactive Swagger interface is generated automatically and served at `/docs` on
the backend URL. This interface documents every endpoint together with its
request and response structure, and it allows the API to be exercised directly.
It is the mechanism by which the backend can be tested without the client.

The decoupling has a further practical consequence for the project. Because the
request and response structures were agreed before implementation began, the
backend was first published as a set of endpoints returning representative sample
data. Front end development proceeded against that interface while the underlying
logic and database access were implemented separately. Neither component required
knowledge of the other beyond the agreed contract.

---

### 7.4 User journey and screens

![[user_journey.svg|622]]

The application comprises eleven pages. Figure 7.3 shows the journey through them.

A visitor arrives at a public home page offering registration and sign in. A new
user registers, supplies their physiological measurements, and is shown the
targets calculated from them. A returning user signs in and, if measurements have
already been supplied, proceeds directly to the dashboard.

The dashboard is the hub of the signed in experience. It presents a summary of
the user's daily target and provides navigation to the three principal areas of
the application, together with the option to sign out.

The recipes area allows a user to browse and search their library, view an
individual recipe, create a new recipe with an accompanying photograph, and edit
or delete existing entries. The weekly planner presents a grid of seven days
against three meal positions. A user may place or remove individual recipes,
generate an entire week automatically from their library, or clear a week in a
single action. The account area allows account details to be amended and body
measurements to be updated, the latter causing targets to be recalculated.

![[user_flow.jpg]]

Figure 7.4 shows the complete navigation between these pages, including the
validation branches encountered during registration and sign in.

---

### 7.5 Technology stack and justification

| Layer | Technology | Reason for selection |
|---|---|---|
| Client | Angular with TypeScript | A structured framework with built in routing and forms. Static typing reduces the risk of mismatch against the API contract. |
| Application | Python with FastAPI | Concise to develop, and it generates an OpenAPI specification and interactive documentation from the code, which supplies the required API documentation and the means of testing the backend independently. |
| Compute | Amazon EC2 | Named in the assignment brief as an example. A virtual machine is transparent to inspect and straightforward to demonstrate. |
| Database | Amazon RDS for PostgreSQL | A managed relational service. The data model is relational, and the brief prohibits a database local to the virtual machine. |
| Object storage | Amazon S3 | Stores recipe photographs and also hosts the compiled client as a static website. |
| Authentication | JSON Web Tokens issued by the API | Stateless, which suits a REST interface, and it keeps credential handling within the application tier. |
| Source control | GitHub, single repository | Contains both client and server, so each member's contribution is visible in one history. |
| Project management | Notion | Holds the work breakdown, schedule, meeting minutes, and a timestamped worklog. |

Two alternatives were considered and set aside. A serverless implementation using
AWS Lambda would have provided elasticity without the need to manage an instance,
and is noted in the brief as an alternative approach. It was set aside because the
team had limited prior experience of AWS and a virtual machine presented lower
delivery risk within the available time. A document oriented database was also
considered and rejected, since the data model contains several genuine
relationships and referential integrity between recipes and plan slots is
valuable. Both alternatives are revisited in Section 11.

---

## 8. Details on Cloud Implementation

*[Which AWS services were used and how they were configured: the VPC and its public
and private subnets, the security groups, the RDS instance, the EC2 instance, and the
two S3 buckets. Include the deployment diagram `design/aws_deployment.svg` here — it
is the physical view, where Section 7 gives the logical one. Evidence is required:
console screenshots showing public access disabled on RDS, the security group rules,
the running API, and both buckets.]*

*Owner: Kyle. Screenshot checklist is in `AWS_SETUP_KYLE.md`.*

---

## 9. User Manual

*[How to use the deployed application, following the journey in Section 7.4: register,
supply measurements, view targets, manage recipes, plan a week. One screenshot per
principal screen. Include how a marker signs in and exercises the API directly through
the Swagger interface.]*

---

## 10. RESTful API List

*[Seventeen endpoints, seven of which use POST, against a requirement of at least ten
including at least three POST. The access URL is the backend base URL followed by the
path. Fill in the base URL once the backend is deployed.]*

Base URL: `[after deployment]`

| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 1 | POST | `/register` | public | Create an account |
| 2 | POST | `/login` | public | Sign in, return a token |
| 3 | GET | `/profile` | token | Get account details |
| 4 | PUT | `/profile` | token | Update account details |
| 5 | POST | `/profile/metrics` | token | Save body metrics; runs the nutrition engine and stores the targets |
| 6 | GET | `/targets` | token | Get computed energy and macronutrient targets |
| 7 | GET | `/recipes?q=` | token | Browse and search recipes |
| 8 | GET | `/recipes/{id}` | token | View one recipe |
| 9 | POST | `/recipes` | token | Create a recipe |
| 10 | POST | `/recipes/{id}/photo` | token | Upload a photograph to object storage |
| 11 | PUT | `/recipes/{id}` | token | Edit a recipe |
| 12 | DELETE | `/recipes/{id}` | token | Delete a recipe |
| 13 | GET | `/mealplan?week=` | token | Get the week's plan |
| 14 | POST | `/mealplan` | token | Add a recipe to a day and meal position |
| 15 | DELETE | `/mealplan/{id}` | token | Remove a single plan slot |
| 16 | POST | `/mealplan/generate` | token | Auto-generate a whole week from the recipe library |
| 17 | DELETE | `/mealplan/week/{week}` | token | Clear an entire week's plan |

*[Add a paragraph on the response codes used deliberately — 409 for duplicates and
occupied slots, 404 rather than 403 for another user's resource, 422 for invalid enum
values — cross-referencing Section 7.3.]*

---

## 11. Summary

*[Outcomes against the requirements in Section 5, lessons learned, and future
improvements. The excluded requirements in Section 5.4 and the alternatives set aside
in Section 7.5 are the material for the future-improvements discussion: a
per-ingredient nutrition data source, target-aware plan optimisation, a shopping list,
a serverless implementation on Lambda, and multi-availability-zone deployment.]*

---

## 12. Appendix: AI Usage Declaration

*[Insert the completed form — see `final/AI Usage Declaration.docx`. Check the Canvas
AI-tool policy before completing it.]*
