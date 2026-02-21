/**
 * Test helpers — shared utilities for all test suites.
 *
 * Because the codebase uses a singleton `better-sqlite3` instance via
 * import '../src/db/init', all tests share the same DB file. We clean
 * user-generated data between suites but leave the substitutions table
 * intact (seeded on first import).
 */

import request from 'supertest';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded before anything else
dotenv.config({ path: path.join(__dirname, '../.env') });

import db from '../src/db/init';
import app from '../src/index';
import authRouter from '../src/routes/auth';
import type { AuthRouter } from '../src/types/auth-router';

interface TestUser {
  user: { id: number; email: string; displayName: string };
  token: string;
  refreshToken: string;
}

interface RecipeOverrides {
  title?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  notes?: string;
  tags?: string[];
  ingredients?: Array<{ quantity: string; name: string }>;
  directions?: Array<{ stepNumber: number; text: string }>;
}

interface UserOverrides {
  email?: string;
  password?: string;
  displayName?: string;
}

/**
 * Wipe all user-generated data. Substitutions are left in place.
 * Also clears the in-memory rate limiter to prevent 429s across tests.
 */
function cleanDatabase(): void {
  db.exec(`
    DELETE FROM cook_logs;
    DELETE FROM directions;
    DELETE FROM ingredients;
    DELETE FROM recipe_tags;
    DELETE FROM recipes;
    DELETE FROM refresh_tokens;
    DELETE FROM users;
  `);
  // Clear the in-memory rate limiter
  const typedRouter = authRouter as AuthRouter;
  if (typedRouter._clearRateLimiter) {
    typedRouter._clearRateLimiter();
  }
}

/**
 * Create a test user via the signup endpoint and return
 * { user, token, refreshToken }.
 */
async function createTestUser(overrides: UserOverrides = {}): Promise<TestUser> {
  const email = overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides.password || 'TestPassword123';
  const displayName = overrides.displayName || 'Test User';

  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password, displayName });

  if (res.status !== 201) {
    throw new Error(`Failed to create test user (${res.status}): ${JSON.stringify(res.body)}`);
  }

  return {
    user: res.body.user,
    token: res.body.token,
    refreshToken: res.body.refreshToken,
  };
}

/**
 * Shorthand: make an authenticated request.
 */
function authGet(urlPath: string, token: string): request.Test {
  return request(app).get(urlPath).set('Authorization', `Bearer ${token}`);
}
function authPost(urlPath: string, token: string): request.Test {
  return request(app).post(urlPath).set('Authorization', `Bearer ${token}`);
}
function authPut(urlPath: string, token: string): request.Test {
  return request(app).put(urlPath).set('Authorization', `Bearer ${token}`);
}
function authDelete(urlPath: string, token: string): request.Test {
  return request(app).delete(urlPath).set('Authorization', `Bearer ${token}`);
}

/**
 * Create a recipe for a user and return the response body.
 */
async function createTestRecipe(token: string, overrides: RecipeOverrides = {}): Promise<{ recipe: Record<string, string> }> {
  const data = {
    title: overrides.title || 'Test Recipe',
    prepTime: overrides.prepTime || '10 min',
    cookTime: overrides.cookTime || '20 min',
    servings: overrides.servings || '4',
    notes: overrides.notes || 'Test notes',
    tags: overrides.tags || ['Dinner'],
    ingredients: overrides.ingredients || [
      { quantity: '2 cups', name: 'Flour' },
      { quantity: '1 cup', name: 'Sugar' },
    ],
    directions: overrides.directions || [
      { stepNumber: 1, text: 'Mix ingredients' },
      { stepNumber: 2, text: 'Bake at 350F' },
    ],
  };

  const res = await authPost('/api/recipes', token).send(data);
  if (res.status !== 201) {
    throw new Error(`Failed to create test recipe (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export {
  app,
  db,
  request,
  cleanDatabase,
  createTestUser,
  createTestRecipe,
  authGet,
  authPost,
  authPut,
  authDelete,
};
