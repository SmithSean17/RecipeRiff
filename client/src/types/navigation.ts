import type { Recipe, CookModeIngredient, CookModeDirection } from './index';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type RecipesStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { id: number; variationId?: number };
  RecipeForm: { recipe?: Recipe } | undefined;
  RiffMode: {
    recipe: Recipe;
    initialIngredients: CookModeIngredient[];
    initialDirections: CookModeDirection[];
  };
  CookScreen: {
    recipe: Recipe;
    ingredients: CookModeIngredient[];
    directions: CookModeDirection[];
  };
  SaveRiff: {
    recipe: Recipe;
    ingredients: CookModeIngredient[];
    directions: CookModeDirection[];
  };
};

export type StatsStackParamList = {
  StatsHome: undefined;
  RecipeDetail: { id: number; variationId?: number };
  RecipeForm: { recipe?: Recipe } | undefined;
  RiffMode: {
    recipe: Recipe;
    initialIngredients: CookModeIngredient[];
    initialDirections: CookModeDirection[];
  };
  CookScreen: {
    recipe: Recipe;
    ingredients: CookModeIngredient[];
    directions: CookModeDirection[];
  };
  SaveRiff: {
    recipe: Recipe;
    ingredients: CookModeIngredient[];
    directions: CookModeDirection[];
  };
};

export type BottomTabParamList = {
  Recipes: undefined;
  Stats: undefined;
  Profile: undefined;
};
