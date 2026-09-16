# Kete — product definition

The authority on **what the system is**, and the copy that is edited.
Paper-agnostic: no rubric language, no architecture, no cloud services.
Everything the design later claims traces back here; if the design invents
something this file does not claim, it is added here first.

**Copies of this file exist elsewhere and are snapshots, not peers.** The one in
the `kete` repository at `doc/product.md` is published for the team to read.
Editing a copy changes nothing here and creates a disagreement nobody will
notice — change this file, then refresh the copy.


---

# 1. Problem & value proposition

Dietary guidance is easy to find; acting on it is not. A person who wants to
eat to a nutritional standard has to do three separate jobs:

1. Work out what their body actually needs.
2. Find out what is in the food they eat.
3. Arrange meals across a week so that shopping and cooking stay practical.

Each job takes a different kind of effort — arithmetic on body measurements,
nutritional knowledge of individual foods, and scheduling — and the result is
that most people do none of them. The calculation is done once, on a site that
does not keep the answer. Recipes pile up across bookmarks, photographs and
handwritten notes with no nutrition attached. Planning, where it happens at
all, is done on paper and thrown away at the end of the week.

**Kete does the first and third jobs, and deliberately not the second.** It
calculates a person's targets and keeps them, and it gives their own recipes a
structure they can be arranged in. The second job — knowing what is in each
ingredient — is out by decision, for the reason given in §5.

**The value is the feedback loop.** The user already knows what they like to
eat. What they cannot see is whether the week they have assembled meets their
targets, and where it falls short. Kete makes that visible while the week is
still editable.

**What the evidence says.** Meal planning is associated with better diet
quality, more food variety and healthier body weight in a large adult sample
(Ducrot et al., 2017). App-based dietary interventions do shift behaviour,
though effects are modest and vary by design (Curtin et al., 2025).

# 2. Personas / stakeholders

- **The planner** (primary, and the only user role in the product). An adult
  managing their own nutrition. Comfortable with a web application, but holds
  no nutritional expertise — so they need their targets *calculated for them*
  rather than explained to them. They need their recipes to persist and to
  stay private, and they need planning to be quick enough to be worth doing
  every week.
- **System operator.** Runs the service and holds the data. There is no second
  party: no grocer, no payment processor, no content licensor.
- *Open:* whether a household shares one plan or each member keeps their own.
  One plan per account until decided, which is what is built.

# 3. Success metric

The system has worked, for one user in one week, when all three hold:

1. **The targets are right.** The figures the system computed match what the
   published equation produces for that person's measurements. Checkable by
   hand, and it should be checked.
2. **The plan is measured against them.** Every recipe placed in the week
   contributes its nutrition to a total, and the user can see the gap between
   that total and their target before the week starts.
3. **The week was assembled without the user doing arithmetic, and quickly
   enough to repeat.** Twenty-one slots filled by hand every week is an
   exercise people abandon, which is why filling a week from the library in one
   action is in scope (§5).

**How a target is computed.** Four steps, all arithmetic:

1. The **Mifflin-St Jeor equation** turns weight, height, age and sex into a
   basal metabolic rate — the energy a body uses at rest `[CITE]`.
2. An **activity factor** for one of five stated activity levels scales that
   into total daily energy expenditure.
3. That energy figure is **divided into protein, carbohydrate and fat by
   proportion**.
4. Each proportion is **converted into grams**, at four calories per gram for
   protein and carbohydrate and nine for fat.

**Two honest gaps in that chain.** The Mifflin-St Jeor equation is published
and needs its citation `[CITE]`. The proportions in step 3 are currently a
number the project chose rather than one taken from a source, which is a
weakness wherever the system claims its figures are not invented — see §6.1.

**Open:** whether the comparison is judged per day or across the week. Targets
are computed and stored as daily figures. An earlier version of this file
argued a weekly window from a nutrition-standards source that the build does
not use, so that argument no longer holds and the question is open again.

**Open:** what tolerance counts as "met", and how the gap is shown.

# 4. Mechanism

**Inputs.** Weight, height, age, sex and activity level. Plus the recipes the
user writes, each carrying its own nutrition figures.

**What is deterministic — all of it.** Targets come out of an equation, not a
model. Weekly totals are the sum of the recipes placed in the week. There is no
prediction, no ranking and no recommendation anywhere in the system. Every
number on the screen can be reproduced with a calculator, which is what makes
the system testable.

**The four things a user does.**

1. **Record measurements.** Once, then edit when they change. The system
   computes the targets and keeps them. Editing the measurements recomputes
   them.
2. **Build the recipe library.** Write a recipe: name, cuisine, ingredients,
   method, how many servings it makes, and **its nutrition per serving, which
   the user supplies**. A photograph can be attached. The system does not work
   the nutrition out from the ingredients — see §5.
3. **Assemble a week.** Place recipes into meal positions across seven days,
   or fill the whole week from the library in one action, or clear it.
4. **Read the comparison.** Totals against targets, with the gap shown per
   nutrient.

**What the system carries.** Energy, protein, carbohydrate and fat. Nothing
else.

# 5. Scope boundary

**In.**

- One account, one set of targets, one recipe library private to that account.
- Deterministic target computation from body measurements.
- Recipes the user writes, with nutrition per serving that the user supplies,
  and a photograph.
- A week of twenty-one positions — seven days, each with breakfast, lunch and
  dinner, one recipe per position. Filling a week from the library in one
  action, and clearing a week in one action.
- The comparison of the week's totals against the targets.

**Out.**

- **A per-ingredient nutrition database.** The most significant exclusion, and
  the reason the user supplies nutrition per recipe. Deriving it would need
  either a licensed food composition dataset or an outside nutrition service,
  and would bring unit parsing, ingredient matching and portion inference with
  it — a subsystem in its own right.
- **Buying the food.** No shops, no stock, no price comparison, no orders, no
  delivery, no payment. Each of those would make finishing the system depend on
  an outside commercial service.
- **A shared or social recipe library.** Every recipe belongs to one account
  and is invisible to every other. Sharing would bring moderation and a much
  more complicated permission model with it.
- **Automatic correction.** Nothing swaps an ingredient, suggests a recipe or
  adjusts a plan to close a gap against the targets. Filling an empty week from
  the user's own library is in scope and does not breach this, because it deals
  recipes out without looking at the targets at all. Choosing recipes to hit
  the targets would breach it.
- **Cooking assistance.** The user cooks; the system does not instruct.

**Out, and stated rather than left silent.**

- `[DECIDED:26-08-2026]` **Anything to do with what a user cannot eat.**
  Allergies, intolerances, declared exclusions and condition-driven diets are
  all outside the system. It computes nutrition targets from body measurements
  and makes no claim about the safety of any ingredient for any individual.
  Stated as an exclusion because a system that plans a person's food would
  otherwise appear simply to have missed it.

**Assumed rather than solved.**

- **Use is light** — in the order of tens of users at once. This would not hold
  for a real deployment, and everything sized against it would have to be
  revisited.
- **The body measurements are the most sensitive thing the system holds.**
  Everything else it stores is recipes and plans.

# 6. Open items

1. **Where the macronutrient proportions come from.** Step 3 of §3 splits
   energy into protein, carbohydrate and fat by proportion, and that proportion
   is currently the project's own choice. Published acceptable ranges for
   macronutrient distribution exist and the split should be checked against
   them `[CITE]`. Until it is, the system has one invented number at the centre
   of the thing it exists to compute.
2. **The citation for Mifflin-St Jeor.** See §3.
3. **Per day or across the week.** See §3.
4. **How the gap is shown to the user.** The one design decision that is not
   settled by either the report or the code.
5. **Whether a household shares a plan.** See §2.
6. **The competitive landscape is unwritten.** See §7.

*Settled since the first draft:* the nutrient set (energy, protein,
carbohydrate, fat), where recipe nutrition comes from (the user), the shape of
a week (twenty-one fixed positions), whether the library is shared (it is not),
and whether targets are stored or recomputed (stored, and overwritten when the
measurements change, so an old week is judged against today's targets).

# 7. Competitive landscape

Nutrition tracking applications are numerous and mature, and most work the
opposite way round: the user logs what they have already eaten and the app
reports the damage. The distinction here is that the arithmetic happens
**before** the week, on a plan that is still editable, and against a target the
system computed rather than one the user guessed.

**Open:** the specific comparison — which products, what each does, where each
sits on that before-and-after line — is not yet written, and every claim in it
needs a check date.

# 8. Complexity note

The system is deliberately small, and the honesty of that matters: there is no
algorithmic novelty here, and none is claimed. What it has instead is a clean
shape — one user role, deterministic computation end to end, five entities, and
every output reproducible by hand. Leaving the per-ingredient nutrition problem
out is what buys that shape, and it is a decision rather than an oversight.

# References

APA 7th.

- Curtin, E., Green, R., Brown, K. A., Nájera Espinosa, S., Chandrasekar, A.,
  Hopkins, L., Turner, G., Alae-Carew, C., Ullian, K., & Scheelbeek, P. (2025).
  The effectiveness of mobile app-based interventions in facilitating behaviour
  change towards healthier and more sustainable diets: A systematic review and
  meta-analysis. *International Journal of Behavioral Nutrition and Physical
  Activity, 22*, 122. https://doi.org/10.1186/s12966-025-01823-7 (verified
  2026-09-02, in `comp806-a1`)
- Ducrot, P., Méjean, C., Aroumougame, V., Ibanez, G., Allès, B., Kesse-Guyot,
  E., Hercberg, S., & Péneau, S. (2017). Meal planning is associated with food
  variety, diet quality and body weight status in a large sample of French
  adults. *International Journal of Behavioral Nutrition and Physical Activity,
  14*, 12. https://doi.org/10.1186/s12966-017-0461-7 (verified 2026-09-02, in
  `comp806-a1`)
