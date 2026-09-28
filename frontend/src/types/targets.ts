import type { components } from "./api";

// What GET /targets answers with. The four figures are whole numbers: the
// engine rounds them when it computes them, and the client renders what it was
// sent rather than rounding again.
//
// computed_at is both optional and nullable -- TargetsOut in backend/main.py
// declares it `Optional[datetime] = None`, so the schema leaves it out of
// `required` as well as admitting null -- although POST /profile/metrics
// always writes one. A target row predating that write can therefore arrive
// absent or null, and the type says so rather than assuming the row that
// exists is the row that was written.
export type Targets = components["schemas"]["TargetsOut"];
