// ============================================================
// DOMAIN MODELS (match backend API response shapes)
// ============================================================

export interface User {
  id: number;
  email: string;
  displayName: string;
}

export interface Ingredient {
  id: number;
  sortOrder: number;
  quantity: string | null;
  name: string;
}

export interface Direction {
  id: number;
  stepNumber: number;
  text: string;
}

export interface Recipe {
  id: number;
  title: string;
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  notes: string | null;
  photoPath: string | null;
  tags: string[];
  ingredients: Ingredient[];
  directions: Direction[];
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

export interface Substitution {
  id: number;
  substituteName: string;
  ratio: number;
  ratioNote: string | null;
  impactNote: string | null;
  category: string | null;
  rank: number;
}

export interface CookLog {
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

export interface MostCookedItem {
  recipeId: number;
  title: string;
  count: number;
}

export interface ActivityGridEntry {
  date: string;
  count: number;
}

export interface StatsData {
  streak: number;
  mealsThisMonth: number;
  uniqueRecipesCooked: number;
  totalRecipes: number;
  mostCooked: MostCookedItem[];
  activityGrid: ActivityGridEntry[];
}

// ============================================================
// VARIATION DOMAIN MODELS
// ============================================================

export interface VariationIngredient {
  id: number;
  sortOrder: number;
  quantity: string | null;
  name: string;
  isSubstitution: boolean;
  originalIngredientName: string | null;
}

export interface VariationDirection {
  id: number;
  stepNumber: number;
  text: string;
}

export interface Variation {
  id: number;
  recipeId: number;
  label: string;
  notes: string | null;
  ingredients: VariationIngredient[];
  directions: VariationDirection[];
  createdAt: string;
}

export interface VariationListItem {
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
// FORM TYPES
// ============================================================

export interface FormIngredient {
  key: string;
  quantity: string;
  name: string;
}

export interface FormDirection {
  key: string;
  text: string;
}

export interface CookModeIngredient {
  key: string;
  quantity: string;
  name: string;
  isSubstitution: boolean;
  originalIngredientName: string | null;
}

export interface CookModeDirection {
  key: string;
  text: string;
}

// ============================================================
// API INPUT TYPES
// ============================================================

export interface RecipeInput {
  title: string;
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  notes: string | null;
  tags: string[];
  ingredients: Array<{ quantity: string | null; name: string }>;
  directions: Array<{ stepNumber: number; text: string }>;
}

export interface CookLogInput {
  recipeId: number;
  rating: number | null;
  notes: string | null;
  photoUri?: string;
}

export interface FetchRecipesParams {
  search?: string;
  tag?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface FinishCookingInput {
  recipeId: number;
  label: string;
  variationNotes: string | null;
  ingredients: Array<{
    quantity: string | null;
    name: string;
    isSubstitution: boolean;
    originalIngredientName: string | null;
  }>;
  directions: Array<{
    stepNumber: number;
    text: string;
  }>;
  rating: number | null;
  cookLogNotes: string | null;
}

// ============================================================
// ENUMS
// ============================================================

export enum SortMode {
  Default = 'default',
  MostCooked = 'most-cooked',
  RecentlyCooked = 'recently-cooked',
}

export enum ActiveTab {
  Ingredients = 'ingredients',
  Directions = 'directions',
  Notes = 'notes',
  Variations = 'variations',
}

// ============================================================
// COMPONENT PROPS
// ============================================================

export interface RecipeCardProps {
  recipe: RecipeListItem;
  onPress: () => void;
}

export interface TagPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export interface SortPillProps {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export interface IngredientRowProps {
  ingredient: Ingredient;
  substitution: { name: string; quantity: string } | null;
  onPress: () => void;
}

export interface CookLogModalProps {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onSubmit: (data: { recipeId: number; rating: number | null; notes: string | null }) => void;
}

export interface StarRatingProps {
  value?: number;
  onChange?: (star: number) => void;
  size?: number;
}

export interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export interface FinishCookingModalProps {
  visible: boolean;
  recipeName: string;
  onClose: () => void;
  onSubmit: (data: { label: string; rating: number | null; notes: string | null }) => void;
}

export interface CookModeIngredientRowProps {
  ingredient: CookModeIngredient;
  onUpdateQuantity: (value: string) => void;
  onUpdateName: (value: string) => void;
  onRemove: () => void;
  onSubstitute: () => void;
}

export interface RiffIngredientCardProps {
  ingredient: CookModeIngredient;
  originalQuantity: string;
  isRemoved: boolean;
  onAdjustQuantity: (delta: number) => void;
  onSetQuantity: (value: string) => void;
  onSwap: () => void;
  onRemove: () => void;
  onUndo: () => void;
}

export interface VariationListItemProps {
  variation: VariationListItem;
  onPress: () => void;
}

export interface StatProps {
  icon: string;
  label: string;
}

// ============================================================
// AUTH CONTEXT
// ============================================================

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, displayName: string) => Promise<User>;
  logout: () => Promise<void>;
}

// ============================================================
// HOOK RETURN TYPES
// ============================================================

export interface UseRecipesReturn {
  recipes: RecipeListItem[];
  loading: boolean;
  total: number;
  fetchRecipes: (params?: FetchRecipesParams) => Promise<RecipeListItem[]>;
  getRecipe: (id: number) => Promise<Recipe>;
  createRecipe: (recipe: RecipeInput) => Promise<Recipe>;
  updateRecipe: (id: number, recipe: Partial<RecipeInput>) => Promise<Recipe>;
  deleteRecipe: (id: number) => Promise<void>;
}

export interface UseSubstitutionsReturn {
  substitutions: Substitution[];
  loading: boolean;
  lookupSubstitutions: (ingredient: string) => Promise<Substitution[]>;
}

export interface UseCookLogsReturn {
  cookLogs: CookLog[];
  loading: boolean;
  logCook: (data: CookLogInput) => Promise<CookLog>;
  fetchCookLogs: (recipeId?: number) => Promise<CookLog[]>;
}

export interface UseStatsReturn {
  stats: StatsData | null;
  loading: boolean;
  fetchStats: () => Promise<StatsData>;
}

export interface UseVariationsReturn {
  variations: VariationListItem[];
  loading: boolean;
  fetchVariations: (recipeId: number) => Promise<VariationListItem[]>;
  getVariation: (id: number) => Promise<Variation>;
  finishCooking: (data: FinishCookingInput) => Promise<{ variation: Variation; cookLog: CookLog }>;
  renameVariation: (id: number, label: string, notes?: string | null) => Promise<void>;
}

// ============================================================
// API RESPONSE SHAPES (for typing Axios responses)
// ============================================================

export interface AuthApiResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RecipeListApiResponse {
  recipes: RecipeListItem[];
  total: number;
}

export interface RecipeDetailApiResponse {
  recipe: Recipe;
}

export interface SubstitutionApiResponse {
  ingredient: string;
  substitutions: Substitution[];
}

export interface CookLogApiResponse {
  cookLog: CookLog;
}

export interface CookLogListApiResponse {
  cookLogs: CookLog[];
}

export interface VariationApiResponse {
  variation: Variation;
}

export interface VariationListApiResponse {
  variations: VariationListItem[];
}

export interface FinishCookingApiResponse {
  variation: Variation;
  cookLog: CookLog;
}
