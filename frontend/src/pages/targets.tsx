import { useLoaderData } from "react-router";

import { Figures } from "../components/ui/figures";
import { NoMeasurements } from "../components/ui/no-measurements";
import { Band, Screen } from "../components/ui/screen";
import type { Targets as TargetFigures } from "../types/targets";

// One locale, fixed, rather than the reader's own. The project writes every
// date dd-mm-yyyy, and a screenshot of this screen goes in the report, so a
// machine set to en-US would otherwise put 09/25/2026 in front of a marker
// reading documents that say 25-09-2026. formatToParts rather than format
// because en-NZ's own separator is a slash: the parts are assembled here so
// the shape on screen is the shape the rule asks for.
//
// An unparseable value returns null and the line is dropped. Intl throws a
// RangeError on an invalid date, and a render that throws reaches the error
// boundary -- losing the four figures a user came for over the cosmetic line
// beneath them is the wrong trade.
function formatComputedAt(iso: string): string | null {
  const when = new Date(iso);

  if (Number.isNaN(when.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("day")}-${part("month")}-${part("year")} ${part("hour")}:${part("minute")}`;
}

export default function Targets() {
  const targets = useLoaderData() as TargetFigures | null;

  // Null is the 404 the loader caught: no measurements saved, so there is
  // nothing to compute a target from. It is not an error and is not announced
  // as one -- the one thing the person needs is the way to the form.
  if (!targets) {
    return (
      <Screen
        title="Your targets"
        lede="Kete works these out from your body measurements, and there are none saved yet."
      >
        <Band heading="Your daily target">
          <NoMeasurements />
        </Band>
      </Screen>
    );
  }

  const computed = targets.computed_at
    ? formatComputedAt(targets.computed_at)
    : null;

  // The four figures, in the order and the wording the mockup draws, with the
  // unit inside the value. toLocaleString on the same fixed locale as the date
  // above, for the same reason: the thousands separator is a comma wherever
  // the screenshot is taken. No arithmetic -- each figure is what the API sent.
  const rows = [
    {
      label: "Daily energy",
      value: `${targets.energy_kcal.toLocaleString("en-NZ")} kcal`,
    },
    { label: "Protein", value: `${targets.protein_g} g` },
    { label: "Carbs", value: `${targets.carbs_g} g` },
    { label: "Fat", value: `${targets.fat_g} g` },
  ];

  return (
    <Screen
      title="Your targets"
      lede="What your body needs each day, worked out from the measurements you saved."
    >
      <div className="grid gap-10">
        <Band heading="Your daily target">
          <Figures className="mt-2" rows={rows} />
          {computed ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Worked out {computed}
            </p>
          ) : null}
        </Band>

        {/* Where the figures come from, in the four steps of section 3 of
            doc/design/product.md in the documents repository nomadwiz/kete-doc,
            and in the words of someone who holds no nutritional expertise -- so
            the equation is "published" rather than named, and the day's total is
            scaled rather than a TDEE.

            It stops at "divided into" and says nothing about the proportions,
            which is deliberate. MACRO_SPLIT in backend/main.py carries "TODO:
            team to confirm the split" and product.md section 6 marks those
            proportions [CITE], so a figure here would read -- on screen and in
            a report screenshot -- exactly like a sourced one. The gap is
            recorded where it can be closed, not here. */}
        <Band heading="How these are worked out">
          <p className="mt-2 max-w-(--measure) text-sm">
            Kete worked these out from the measurements you saved. A published
            equation turns your weight, height, age and sex into the energy your
            body uses at rest, your activity level scales that up to a whole
            day, and the day's energy is divided into protein, carbohydrate and
            fat. Save your measurements again whenever they change and all four
            figures are worked out afresh.
          </p>
        </Band>
      </div>
    </Screen>
  );
}
