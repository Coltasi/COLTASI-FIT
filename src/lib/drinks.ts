/** Drink types for the Add a drink screen. Calories and carbs are per standard serving, rounded. */
export const DRINKS = {
  beer: { label: "Beer", serving: "Pint or bottle", one: "beer", many: "beers", kcal: 180, carbs: 14 },
  wine: { label: "Wine", serving: "Glass", one: "glass of wine", many: "glasses of wine", kcal: 125, carbs: 4 },
  spirit: { label: "Spirit", serving: "Single, with mixer", one: "spirit and mixer", many: "spirits and mixers", kcal: 110, carbs: 12 },
  cocktail: { label: "Cocktail", serving: "Mojito, G&T…", one: "cocktail", many: "cocktails", kcal: 200, carbs: 20 },
} as const;

export type DrinkKind = keyof typeof DRINKS;
export const isDrinkKind = (v: unknown): v is DrinkKind => typeof v === "string" && v in DRINKS;
export const drinkName = (k: DrinkKind, n: number) => `${n} ${n === 1 ? DRINKS[k].one : DRINKS[k].many}`;
