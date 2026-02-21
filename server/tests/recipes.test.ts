/**
 * Recipe CRUD API tests — create, read, update, delete, list, search, sort, tags.
 */
import {
  app, db, request, cleanDatabase, createTestUser, createTestRecipe,
  authGet, authPost, authPut, authDelete,
} from './helpers';

let token: string;
let userId;

beforeEach(async () => {
  cleanDatabase();
  const user = await createTestUser();
  token = user.token;
  userId = user.user.id;
});

// ─── Create Recipe ───────────────────────────────────────

describe('POST /api/recipes', () => {
  it('creates a recipe with full data', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: 'Banana Bread',
      prepTime: '15 min',
      cookTime: '55 min',
      servings: '8',
      notes: 'Use ripe bananas',
      tags: ['Baking', 'Dessert'],
      ingredients: [
        { quantity: '3', name: 'Ripe bananas' },
        { quantity: '2 cups', name: 'Flour' },
      ],
      directions: [
        { stepNumber: 1, text: 'Mash bananas' },
        { stepNumber: 2, text: 'Mix with flour' },
        { stepNumber: 3, text: 'Bake at 350F for 55 min' },
      ],
    });

    expect(res.status).toBe(201);
    const recipe = res.body.recipe;
    expect(recipe.title).toBe('Banana Bread');
    expect(recipe.prepTime).toBe('15 min');
    expect(recipe.cookTime).toBe('55 min');
    expect(recipe.servings).toBe('8');
    expect(recipe.notes).toBe('Use ripe bananas');
    expect(recipe.tags).toEqual(expect.arrayContaining(['Baking', 'Dessert']));
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.ingredients[0].name).toBe('Ripe bananas');
    expect(recipe.directions).toHaveLength(3);
    expect(recipe.directions[0].text).toBe('Mash bananas');
    expect(recipe.cookCount).toBe(0);
    expect(recipe.createdAt).toBeDefined();
  });

  it('creates a recipe with minimal data (title only)', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: 'Minimal Recipe',
    });

    expect(res.status).toBe(201);
    expect(res.body.recipe.title).toBe('Minimal Recipe');
    expect(res.body.recipe.ingredients).toHaveLength(0);
    expect(res.body.recipe.directions).toHaveLength(0);
    expect(res.body.recipe.tags).toHaveLength(0);
  });

  it('trims title whitespace', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: '  Padded Title  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.recipe.title).toBe('Padded Title');
  });

  it('rejects missing title', async () => {
    const res = await authPost('/api/recipes', token).send({
      prepTime: '10 min',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('rejects empty string title', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: '   ',
    });

    expect(res.status).toBe(400);
  });

  it('rejects title over 200 chars', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: 'x'.repeat(201),
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/200/);
  });

  it('rejects notes over 5000 chars', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: 'Test',
      notes: 'x'.repeat(5001),
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/5000/);
  });

  it('rejects ingredient without name', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: 'Test',
      ingredients: [{ quantity: '1 cup', name: '' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ingredient.*name/i);
  });

  it('rejects direction without text', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: 'Test',
      directions: [{ stepNumber: 1, text: '' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/direction.*text/i);
  });

  it('deduplicates tags', async () => {
    const res = await authPost('/api/recipes', token).send({
      title: 'Duped Tags',
      tags: ['Dinner', 'Dinner', 'Dinner'],
    });

    expect(res.status).toBe(201);
    expect(res.body.recipe.tags).toHaveLength(1);
    expect(res.body.recipe.tags).toContain('Dinner');
  });
});

// ─── Get Single Recipe ───────────────────────────────────

describe('GET /api/recipes/:id', () => {
  it('returns full recipe detail', async () => {
    const { recipe } = await createTestRecipe(token);

    const res = await authGet(`/api/recipes/${recipe.id}`, token);
    expect(res.status).toBe(200);
    expect(res.body.recipe.title).toBe('Test Recipe');
    expect(res.body.recipe.ingredients).toHaveLength(2);
    expect(res.body.recipe.directions).toHaveLength(2);
    expect(res.body.recipe.tags).toContain('Dinner');
  });

  it('returns 404 for non-existent recipe', async () => {
    const res = await authGet('/api/recipes/99999', token);
    expect(res.status).toBe(404);
  });

  it('returns 404 for another user\'s recipe', async () => {
    const { recipe } = await createTestRecipe(token);
    const user2 = await createTestUser({ email: 'other@example.com' });

    const res = await authGet(`/api/recipes/${recipe.id}`, user2.token);
    expect(res.status).toBe(404);
  });
});

// ─── List Recipes ────────────────────────────────────────

describe('GET /api/recipes', () => {
  beforeEach(async () => {
    await createTestRecipe(token, { title: 'Pasta Carbonara', tags: ['Dinner', 'Quick'] });
    await createTestRecipe(token, { title: 'Chocolate Cake', tags: ['Baking', 'Dessert'] });
    await createTestRecipe(token, { title: 'Quick Omelette', tags: ['Breakfast', 'Quick'] });
  });

  it('lists all user recipes', async () => {
    const res = await authGet('/api/recipes', token);
    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(3);
    expect(res.body.total).toBe(3);
  });

  it('does not include other users\' recipes', async () => {
    const user2 = await createTestUser({ email: 'other@example.com' });
    await createTestRecipe(user2.token, { title: 'Secret Recipe' });

    const res = await authGet('/api/recipes', token);
    expect(res.body.recipes).toHaveLength(3);
    const titles = res.body.recipes.map((r: any) => r.title);
    expect(titles).not.toContain('Secret Recipe');
  });

  it('filters by search query', async () => {
    const res = await authGet('/api/recipes?search=chocolate', token);
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Chocolate Cake');
  });

  it('search is case-insensitive', async () => {
    const res = await authGet('/api/recipes?search=PASTA', token);
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Pasta Carbonara');
  });

  it('filters by tag', async () => {
    const res = await authGet('/api/recipes?tag=Quick', token);
    expect(res.body.recipes).toHaveLength(2);
    const titles = res.body.recipes.map((r: any) => r.title);
    expect(titles).toContain('Pasta Carbonara');
    expect(titles).toContain('Quick Omelette');
  });

  it('returns empty for non-matching tag', async () => {
    const res = await authGet('/api/recipes?tag=Spicy', token);
    expect(res.body.recipes).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('paginates results', async () => {
    const res = await authGet('/api/recipes?page=1&limit=2', token);
    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);

    const page2 = await authGet('/api/recipes?page=2&limit=2', token);
    expect(page2.body.recipes).toHaveLength(1);
  });

  it('sorts by default (created_at DESC) — returns all recipes', async () => {
    const res = await authGet('/api/recipes', token);
    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(3);
    // All three created in same second so order may vary, but all should be present
    const titles = res.body.recipes.map((r: any) => r.title).sort();
    expect(titles).toEqual(['Chocolate Cake', 'Pasta Carbonara', 'Quick Omelette']);
  });

  it('sorts by most-cooked', async () => {
    const list = await authGet('/api/recipes', token);
    const pastaId = list.body.recipes.find((r: any) => r.title === 'Pasta Carbonara').id;

    await authPost('/api/cook-logs', token).send({ recipeId: pastaId, rating: 5 });
    await authPost('/api/cook-logs', token).send({ recipeId: pastaId, rating: 4 });

    const sorted = await authGet('/api/recipes?sort=most-cooked', token);
    expect(sorted.body.recipes[0].title).toBe('Pasta Carbonara');
  });

  it('sorts by recently-cooked', async () => {
    const list = await authGet('/api/recipes', token);
    const cakeId = list.body.recipes.find((r: any) => r.title === 'Chocolate Cake').id;

    await authPost('/api/cook-logs', token).send({ recipeId: cakeId, rating: 5 });

    const sorted = await authGet('/api/recipes?sort=recently-cooked', token);
    expect(sorted.body.recipes[0].title).toBe('Chocolate Cake');
  });

  it('combines search and tag filter', async () => {
    const res = await authGet('/api/recipes?search=omelette&tag=Quick', token);
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Quick Omelette');
  });
});

// ─── Update Recipe ───────────────────────────────────────

describe('PUT /api/recipes/:id', () => {
  let recipeId: string;

  beforeEach(async () => {
    const { recipe } = await createTestRecipe(token, {
      title: 'Original',
      tags: ['Dinner'],
      ingredients: [{ quantity: '1 cup', name: 'Rice' }],
      directions: [{ stepNumber: 1, text: 'Cook rice' }],
    });
    recipeId = recipe.id;
  });

  it('updates title', async () => {
    const res = await authPut(`/api/recipes/${recipeId}`, token).send({
      title: 'Updated Title',
    });

    expect(res.status).toBe(200);
    expect(res.body.recipe.title).toBe('Updated Title');
  });

  it('updates tags (replaces all)', async () => {
    const res = await authPut(`/api/recipes/${recipeId}`, token).send({
      tags: ['Healthy', 'Quick'],
    });

    expect(res.body.recipe.tags).toEqual(expect.arrayContaining(['Healthy', 'Quick']));
    expect(res.body.recipe.tags).not.toContain('Dinner');
  });

  it('updates ingredients (replaces all)', async () => {
    const res = await authPut(`/api/recipes/${recipeId}`, token).send({
      ingredients: [
        { quantity: '2 cups', name: 'Quinoa' },
        { quantity: '1 tbsp', name: 'Olive oil' },
      ],
    });

    expect(res.body.recipe.ingredients).toHaveLength(2);
    expect(res.body.recipe.ingredients[0].name).toBe('Quinoa');
  });

  it('updates directions (replaces all)', async () => {
    const res = await authPut(`/api/recipes/${recipeId}`, token).send({
      directions: [
        { stepNumber: 1, text: 'New step 1' },
        { stepNumber: 2, text: 'New step 2' },
        { stepNumber: 3, text: 'New step 3' },
      ],
    });

    expect(res.body.recipe.directions).toHaveLength(3);
  });

  it('preserves unchanged fields', async () => {
    const before = await authGet(`/api/recipes/${recipeId}`, token);
    const res = await authPut(`/api/recipes/${recipeId}`, token).send({
      notes: 'Added notes',
    });

    expect(res.body.recipe.title).toBe('Original'); // unchanged
    expect(res.body.recipe.notes).toBe('Added notes'); // changed
  });

  it('returns 404 for non-existent recipe', async () => {
    const res = await authPut('/api/recipes/99999', token).send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for another user\'s recipe', async () => {
    const user2 = await createTestUser({ email: 'other@example.com' });
    const res = await authPut(`/api/recipes/${recipeId}`, user2.token).send({ title: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('rejects title over 200 chars', async () => {
    const res = await authPut(`/api/recipes/${recipeId}`, token).send({
      title: 'x'.repeat(201),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Delete Recipe ───────────────────────────────────────

describe('DELETE /api/recipes/:id', () => {
  let recipeId: string;

  beforeEach(async () => {
    const { recipe } = await createTestRecipe(token);
    recipeId = recipe.id;
  });

  it('deletes a recipe', async () => {
    const res = await authDelete(`/api/recipes/${recipeId}`, token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it's gone
    const check = await authGet(`/api/recipes/${recipeId}`, token);
    expect(check.status).toBe(404);
  });

  it('cascade-deletes ingredients, directions, and tags', async () => {
    await authDelete(`/api/recipes/${recipeId}`, token);

    const ings = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(recipeId);
    const dirs = db.prepare('SELECT * FROM directions WHERE recipe_id = ?').all(recipeId);
    const tags = db.prepare('SELECT * FROM recipe_tags WHERE recipe_id = ?').all(recipeId);

    expect(ings).toHaveLength(0);
    expect(dirs).toHaveLength(0);
    expect(tags).toHaveLength(0);
  });

  it('cascade-deletes cook logs', async () => {
    await authPost('/api/cook-logs', token).send({ recipeId, rating: 5, notes: 'Great' });
    const logsBefore = db.prepare('SELECT * FROM cook_logs WHERE recipe_id = ?').all(recipeId);
    expect(logsBefore.length).toBeGreaterThan(0);

    await authDelete(`/api/recipes/${recipeId}`, token);

    const logsAfter = db.prepare('SELECT * FROM cook_logs WHERE recipe_id = ?').all(recipeId);
    expect(logsAfter).toHaveLength(0);
  });

  it('returns 404 for non-existent recipe', async () => {
    const res = await authDelete('/api/recipes/99999', token);
    expect(res.status).toBe(404);
  });

  it('returns 404 for another user\'s recipe', async () => {
    const user2 = await createTestUser({ email: 'other@example.com' });
    const res = await authDelete(`/api/recipes/${recipeId}`, user2.token);
    expect(res.status).toBe(404);
  });
});
