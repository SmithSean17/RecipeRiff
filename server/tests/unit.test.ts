/**
 * Unit tests — token utils, database schema, middleware behavior.
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { signAccessToken, verifyToken } from '../src/utils/token';
import db from '../src/db/init';
import bcrypt from 'bcryptjs';
import type { TableNameRow, ColumnInfoRow, CountResultC, PragmaResult } from '../src/types';

// ─── Token Utils ─────────────────────────────────────────

describe('Token utilities', () => {
  it('signAccessToken returns a JWT string', () => {
    const token = signAccessToken({ userId: 1, email: 'a@b.com' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('verifyToken decodes a valid token', () => {
    const token = signAccessToken({ userId: 42, email: 'test@example.com' });
    const decoded = verifyToken(token);

    expect(decoded.userId).toBe(42);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.exp).toBeDefined(); // expiry claim
    expect(decoded.iat).toBeDefined(); // issued-at claim
  });

  it('verifyToken throws on tampered token', () => {
    const token = signAccessToken({ userId: 1, email: 'a@b.com' });
    const tampered = token.slice(0, -5) + 'XXXXX';

    expect(() => verifyToken(tampered)).toThrow();
  });

  it('verifyToken throws on garbage input', () => {
    expect(() => verifyToken('not.a.valid.token')).toThrow();
    expect(() => verifyToken('')).toThrow();
  });

  it('token has 15-minute expiry', () => {
    const token = signAccessToken({ userId: 1, email: 'a@b.com' });
    const decoded = verifyToken(token);

    const expiry = decoded.exp - decoded.iat;
    expect(expiry).toBe(15 * 60); // 900 seconds
  });
});

// ─── Database Schema ─────────────────────────────────────

describe('Database schema', () => {
  it('has all required tables', () => {
    const tables = (db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as TableNameRow[]).map(r => r.name);

    expect(tables).toContain('users');
    expect(tables).toContain('refresh_tokens');
    expect(tables).toContain('recipes');
    expect(tables).toContain('recipe_tags');
    expect(tables).toContain('ingredients');
    expect(tables).toContain('directions');
    expect(tables).toContain('substitutions');
    expect(tables).toContain('cook_logs');
  });

  it('has foreign keys enabled', () => {
    const fk = db.pragma('foreign_keys') as PragmaResult[];
    expect(fk[0].foreign_keys).toBe(1);
  });

  it('has indexes on key columns', () => {
    const indexes = (db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name"
    ).all() as TableNameRow[]).map(r => r.name);

    expect(indexes).toContain('idx_recipes_user');
    expect(indexes).toContain('idx_recipe_tags_recipe');
    expect(indexes).toContain('idx_recipe_tags_tag');
    expect(indexes).toContain('idx_ingredients_recipe');
    expect(indexes).toContain('idx_directions_recipe');
    expect(indexes).toContain('idx_subs_ingredient');
    expect(indexes).toContain('idx_cook_logs_user');
    expect(indexes).toContain('idx_cook_logs_recipe');
    expect(indexes).toContain('idx_cook_logs_date');
    expect(indexes).toContain('idx_refresh_tokens_token');
  });

  it('users table has expected columns', () => {
    const cols = (db.prepare("PRAGMA table_info(users)").all() as ColumnInfoRow[]).map(c => c.name);
    expect(cols).toEqual(expect.arrayContaining(['id', 'email', 'password_hash', 'display_name', 'created_at']));
  });

  it('recipes table has expected columns', () => {
    const cols = (db.prepare("PRAGMA table_info(recipes)").all() as ColumnInfoRow[]).map(c => c.name);
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'user_id', 'title', 'prep_time', 'cook_time', 'servings',
      'notes', 'photo_path', 'created_at', 'updated_at'
    ]));
  });

  it('substitutions table is seeded with data', () => {
    const count = db.prepare('SELECT COUNT(*) as c FROM substitutions').get() as CountResultC;
    expect(count.c).toBeGreaterThan(100); // should have 500+
  });

  it('enforces email uniqueness', () => {
    const hash = bcrypt.hashSync('test', 10);

    db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('unique@test.com', hash, 'User');

    expect(() => {
      db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('unique@test.com', hash, 'User 2');
    }).toThrow();

    // Clean up
    db.prepare("DELETE FROM users WHERE email = 'unique@test.com'").run();
  });

  it('cascade deletes child rows when recipe is deleted', () => {
    const hash = bcrypt.hashSync('test', 10);

    // Create user and recipe
    const user = db.prepare("INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)").run('cascade@test.com', hash, 'User');
    const recipe = db.prepare("INSERT INTO recipes (user_id, title) VALUES (?, ?)").run(user.lastInsertRowid, 'Test');
    const rid = recipe.lastInsertRowid;

    db.prepare("INSERT INTO ingredients (recipe_id, sort_order, name) VALUES (?, 0, ?)").run(rid, 'Flour');
    db.prepare("INSERT INTO directions (recipe_id, step_number, text) VALUES (?, 1, ?)").run(rid, 'Mix');
    db.prepare("INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)").run(rid, 'Test');

    // Delete recipe
    db.prepare("DELETE FROM recipes WHERE id = ?").run(rid);

    // Verify cascades
    expect((db.prepare("SELECT COUNT(*) as c FROM ingredients WHERE recipe_id = ?").get(rid) as CountResultC).c).toBe(0);
    expect((db.prepare("SELECT COUNT(*) as c FROM directions WHERE recipe_id = ?").get(rid) as CountResultC).c).toBe(0);
    expect((db.prepare("SELECT COUNT(*) as c FROM recipe_tags WHERE recipe_id = ?").get(rid) as CountResultC).c).toBe(0);

    // Clean up
    db.prepare("DELETE FROM users WHERE email = 'cascade@test.com'").run();
  });
});

// ─── Substitutions Seed Data ─────────────────────────────

describe('Substitution seed data quality', () => {
  it('covers major ingredient categories', () => {
    const categories = (db.prepare(
      'SELECT DISTINCT category FROM substitutions ORDER BY category'
    ).all() as Array<{ category: string }>).map(r => r.category);

    // At minimum should have these categories
    const expected = ['dairy', 'eggs', 'sweeteners', 'oils'];
    for (const cat of expected) {
      expect(categories).toContain(cat);
    }
  });

  it('has entries for common cooking ingredients', () => {
    const commonIngredients = ['butter', 'egg', 'milk', 'sugar', 'all-purpose flour', 'honey', 'olive oil'];

    for (const ingredient of commonIngredients) {
      const count = db.prepare(
        'SELECT COUNT(*) as c FROM substitutions WHERE ingredient = ?'
      ).get(ingredient) as CountResultC;
      expect(count.c).toBeGreaterThan(0);
    }
  });

  it('all entries have non-empty substitute_name', () => {
    const empty = db.prepare(
      "SELECT COUNT(*) as c FROM substitutions WHERE substitute_name IS NULL OR substitute_name = ''"
    ).get() as CountResultC;
    expect(empty.c).toBe(0);
  });

  it('all entries have positive ratio', () => {
    const invalid = db.prepare(
      'SELECT COUNT(*) as c FROM substitutions WHERE ratio <= 0'
    ).get() as CountResultC;
    expect(invalid.c).toBe(0);
  });

  it('rank values are non-negative', () => {
    const negative = db.prepare(
      'SELECT COUNT(*) as c FROM substitutions WHERE rank < 0'
    ).get() as CountResultC;
    expect(negative.c).toBe(0);
  });
});
