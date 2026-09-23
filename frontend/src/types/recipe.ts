export interface RecipeSummary {
  recipe_id: number;
  name: string;
  cuisine: string;
  energy_kcal: number;
  photo_url: string | null;
}
