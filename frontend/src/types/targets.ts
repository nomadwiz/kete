// What GET /targets answers with, matching TargetsOut in backend/main.py. The
// four figures are whole numbers: the engine rounds them when it computes
// them, and the client renders what it was sent rather than rounding again.
//
// computed_at is optional on the server although POST /profile/metrics always
// writes one, so a target row predating that write would answer null. The type
// says so rather than assuming the row that exists is the row that was written.
export interface Targets {
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  computed_at: string | null;
}
