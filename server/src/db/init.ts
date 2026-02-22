import Database, { Database as IDatabase } from 'better-sqlite3';
import path from 'path';
import seedSubstitutions from './seed-substitutions';
import type { CountResultC, ColumnInfoRow } from '../types';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'recipeRiff.db');
// const DB_PATH = path.join(__dirname, 'recipeRiff.db');

const db: IDatabase = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    prep_time TEXT,
    cook_time TEXT,
    servings TEXT,
    notes TEXT,
    photo_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipe_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    quantity TEXT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS directions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    text TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS substitutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient TEXT NOT NULL,
    substitute_name TEXT NOT NULL,
    ratio REAL NOT NULL DEFAULT 1.0,
    ratio_note TEXT,
    impact_note TEXT,
    category TEXT,
    rank INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS recipe_variations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS variation_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variation_id INTEGER NOT NULL REFERENCES recipe_variations(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    quantity TEXT,
    name TEXT NOT NULL,
    is_substitution INTEGER NOT NULL DEFAULT 0,
    original_ingredient_name TEXT
  );

  CREATE TABLE IF NOT EXISTS variation_directions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variation_id INTEGER NOT NULL REFERENCES recipe_variations(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    text TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    rating INTEGER,
    notes TEXT,
    photo_path TEXT,
    variation_id INTEGER REFERENCES recipe_variations(id) ON DELETE SET NULL,
    cooked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
  CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe ON recipe_tags(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags(tag);
  CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_directions_recipe ON directions(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_subs_ingredient ON substitutions(ingredient);
  CREATE INDEX IF NOT EXISTS idx_cook_logs_user ON cook_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_cook_logs_recipe ON cook_logs(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_cook_logs_date ON cook_logs(cooked_at);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_variations_recipe ON recipe_variations(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_variations_user ON recipe_variations(user_id);
  CREATE INDEX IF NOT EXISTS idx_var_ingredients_variation ON variation_ingredients(variation_id);
  CREATE INDEX IF NOT EXISTS idx_var_directions_variation ON variation_directions(variation_id);
`);

// Migrate existing cook_logs table: add variation_id column if missing
const cookLogCols = db.prepare("PRAGMA table_info(cook_logs)").all() as ColumnInfoRow[];
if (!cookLogCols.find(col => col.name === 'variation_id')) {
  db.exec("ALTER TABLE cook_logs ADD COLUMN variation_id INTEGER REFERENCES recipe_variations(id) ON DELETE SET NULL");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_cook_logs_variation ON cook_logs(variation_id)");

// Seed substitutions if table is empty
const count = db.prepare('SELECT COUNT(*) as c FROM substitutions').get() as CountResultC;
if (count.c === 0) {
  seedSubstitutions(db);
  const newCount = db.prepare('SELECT COUNT(*) as c FROM substitutions').get() as CountResultC;
  console.log(`Seeded ${newCount.c} substitution mappings`);
}

export default db;
