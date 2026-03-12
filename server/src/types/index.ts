// ============================================================
// DATABASE ROW INTERFACES (match SQLite column names exactly)
// ============================================================

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  displayName: string;
}

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
}

export interface RecipeRow {
  id: number;
  user_id: number;
  title: string;
  prep_time: string | null;
  cook_time: string | null;
  servings: string | null;
  notes: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeRowWithStats extends RecipeRow {
  cook_count: number;
  last_cooked: string | null;
  avg_rating: number | null;
}

export interface RecipeTagRow {
  id: number;
  recipe_id: number;
  tag: string;
}

export interface IngredientRow {
  id: number;
  recipe_id: number;
  sort_order: number;
  quantity: string | null;
  name: string;
}

export interface DirectionRow {
  id: number;
  recipe_id: number;
  step_number: number;
  text: string;
}

export interface SubstitutionRow {
  id: number;
  ingredient: string;
  substitute_name: string;
  ratio: number;
  ratio_note: string | null;
  impact_note: string | null;
  category: string | null;
  rank: number;
}

export interface CookLogRow {
  id: number;
  user_id: number;
  recipe_id: number;
  rating: number | null;
  notes: string | null;
  photo_path: string | null;
  cooked_at: string;
}

export interface CookLogRowWithTitle extends CookLogRow {
  recipe_title: string;
  variation_id: number | null;
  variation_label: string | null;
}

export interface RecipeVariationRow {
  id: number;
  recipe_id: number;
  user_id: number;
  label: string;
  notes: string | null;
  created_at: string;
}

export interface VariationIngredientRow {
  id: number;
  variation_id: number;
  sort_order: number;
  quantity: string | null;
  name: string;
  is_substitution: number; // 0 or 1 (SQLite boolean)
  original_ingredient_name: string | null;
}

export interface VariationDirectionRow {
  id: number;
  variation_id: number;
  step_number: number;
  text: string;
}

// ============================================================
// SERIALIZED (API RESPONSE) TYPES
// ============================================================

export interface SerializedIngredient {
  id: number;
  sortOrder: number;
  quantity: string | null;
  name: string;
}

export interface SerializedDirection {
  id: number;
  stepNumber: number;
  text: string;
}

export interface SerializedRecipe {
  id: number;
  title: string;
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  notes: string | null;
  photoPath: string | null;
  tags: string[];
  ingredients: SerializedIngredient[];
  directions: SerializedDirection[];
  cookCount: number;
  lastCooked: string | null;
  avgRating: number | null;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeListItem {
  id: number;
  title: string;
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  notes: string | null;
  photoPath: string | null;
  tags: string[];
  cookCount: number;
  lastCooked: string | null;
  avgRating: number | null;
  createdAt: string;
}

export interface SerializedSubstitution {
  id: number;
  substituteName: string;
  ratio: number;
  ratioNote: string | null;
  impactNote: string | null;
  category: string | null;
  rank: number;
}

export interface SerializedCookLog {
  id: number;
  recipeId: number;
  recipeTitle?: string;
  rating: number | null;
  notes: string | null;
  photoPath: string | null;
  cookedAt: string;
  variationId: number | null;
  variationLabel: string | null;
}

// ============================================================
// VARIATION SERIALIZED TYPES
// ============================================================

export interface SerializedVariationIngredient {
  id: number;
  sortOrder: number;
  quantity: string | null;
  name: string;
  isSubstitution: boolean;
  originalIngredientName: string | null;
}

export interface SerializedVariationDirection {
  id: number;
  stepNumber: number;
  text: string;
}

export interface SerializedVariation {
  id: number;
  recipeId: number;
  label: string;
  notes: string | null;
  ingredients: SerializedVariationIngredient[];
  directions: SerializedVariationDirection[];
  createdAt: string;
}

export interface SerializedVariationListItem {
  id: number;
  recipeId: number;
  label: string;
  notes: string | null;
  createdAt: string;
  creatorName: string;
  isOwner: boolean;
  totalCooks: number;
  avgRating: number | null;
  userRating: number | null;
}

// ============================================================
// API REQUEST BODY TYPES
// ============================================================

export interface SignupBody {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RefreshBody {
  refreshToken: string;
}

export interface CreateRecipeBody {
  title: string;
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  notes?: string | null;
  tags?: string[];
  ingredients?: Array<{ quantity?: string | null; name: string }>;
  directions?: Array<{ stepNumber?: number; text: string }>;
}

export interface UpdateRecipeBody {
  title?: string;
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  notes?: string | null;
  tags?: string[];
  ingredients?: Array<{ quantity?: string | null; name: string }>;
  directions?: Array<{ stepNumber?: number; text: string }>;
}

export interface CreateCookLogBody {
  recipeId: number | string;
  rating?: number | string | null;
  notes?: string | null;
}

export interface FinishCookingBody {
  recipeId: number | string;
  label: string;
  variationNotes?: string | null;
  ingredients: Array<{
    quantity?: string | null;
    name: string;
    isSubstitution?: boolean;
    originalIngredientName?: string | null;
  }>;
  directions: Array<{
    stepNumber?: number;
    text: string;
  }>;
  rating?: number | string | null;
  cookLogNotes?: string | null;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface AuthResponse {
  user: { id: number; email: string; displayName: string };
  token: string;
  refreshToken: string;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

export interface RecipeResponse {
  recipe: SerializedRecipe;
}

export interface RecipeListResponse {
  recipes: RecipeListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SubstitutionLookupResponse {
  ingredient: string;
  substitutions: SerializedSubstitution[];
}

export interface CookLogCreateResponse {
  cookLog: SerializedCookLog;
}

export interface CookLogListResponse {
  cookLogs: SerializedCookLog[];
}

export interface VariationResponse {
  variation: SerializedVariation;
}

export interface VariationListResponse {
  variations: SerializedVariationListItem[];
}

export interface FinishCookingResponse {
  variation: SerializedVariation;
  cookLog: SerializedCookLog;
}

export interface StatsResponse {
  streak: number;
  mealsThisMonth: number;
  uniqueRecipesCooked: number;
  totalRecipes: number;
  mostCooked: MostCookedItem[];
  activityGrid: ActivityGridEntry[];
}

export interface MostCookedItem {
  recipeId: number;
  title: string;
  count: number;
}

export interface ActivityGridEntry {
  date: string;
  count: number;
}

// ============================================================
// INTERNAL TYPES
// ============================================================

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface TokenPayload {
  userId: number;
  email: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export type SubstitutionSeed = [
  string,   // ingredient
  string,   // substitute_name
  number,   // ratio
  string,   // ratio_note
  string,   // impact_note
  string,   // category
  number,   // rank
];

export interface RecipeStats {
  cook_count: number;
  last_cooked: string | null;
  avg_rating: number | null;
}

export interface CountResult {
  count: number;
}

export interface CountResultC {
  c: number;
}

export interface TotalResult {
  total: number;
}

export interface DateCountResult {
  date: string;
  count: number;
}

export interface DateResult {
  date: string;
}

export interface MostCookedRow {
  recipe_id: number;
  title: string;
  count: number;
}

export interface TableNameRow {
  name: string;
}

export interface ColumnInfoRow {
  name: string;
  type: string;
}

export interface PragmaResult {
  journal_mode?: string;
  foreign_keys?: number;
}
