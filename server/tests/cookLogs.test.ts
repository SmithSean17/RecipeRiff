/**
 * Cook log API tests — create logs, list logs, validation, recipe ownership.
 */
import {
  app, db, request, cleanDatabase, createTestUser, createTestRecipe,
  authGet, authPost,
} from './helpers';

let token: string;
let recipeId: any;

beforeEach(async () => {
  cleanDatabase();
  const user = await createTestUser();
  token = user.token;
  const { recipe } = await createTestRecipe(token);
  recipeId = recipe.id;
});

// ─── Create Cook Log ─────────────────────────────────────

describe('POST /api/cook-logs', () => {
  it('logs a cook with rating and notes', async () => {
    const res = await authPost('/api/cook-logs', token).send({
      recipeId,
      rating: 5,
      notes: 'Turned out great!',
    });

    expect(res.status).toBe(201);
    expect(res.body.cookLog).toMatchObject({
      recipeId,
      rating: 5,
      notes: 'Turned out great!',
    });
    expect(res.body.cookLog.id).toBeDefined();
    expect(res.body.cookLog.cookedAt).toBeDefined();
  });

  it('logs a cook with only recipeId (no rating or notes)', async () => {
    const res = await authPost('/api/cook-logs', token).send({
      recipeId,
    });

    expect(res.status).toBe(201);
    expect(res.body.cookLog.recipeId).toBe(recipeId);
    expect(res.body.cookLog.rating).toBeNull();
    expect(res.body.cookLog.notes).toBeNull();
  });

  it('rejects missing recipeId', async () => {
    const res = await authPost('/api/cook-logs', token).send({
      rating: 5,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recipeId/i);
  });

  it('rejects non-existent recipe', async () => {
    const res = await authPost('/api/cook-logs', token).send({
      recipeId: 99999,
    });

    expect(res.status).toBe(404);
  });

  it('rejects another user\'s recipe', async () => {
    const user2 = await createTestUser({ email: 'other@example.com' });
    const res = await authPost('/api/cook-logs', user2.token).send({
      recipeId,
      rating: 3,
    });

    expect(res.status).toBe(404);
  });

  it('rejects rating below 1', async () => {
    const res = await authPost('/api/cook-logs', token).send({
      recipeId,
      rating: 0,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1 and 5/);
  });

  it('rejects rating above 5', async () => {
    const res = await authPost('/api/cook-logs', token).send({
      recipeId,
      rating: 6,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1 and 5/);
  });

  it('rejects non-numeric rating', async () => {
    const res = await authPost('/api/cook-logs', token).send({
      recipeId,
      rating: 'excellent',
    });

    expect(res.status).toBe(400);
  });

  it('allows multiple cook logs for same recipe', async () => {
    await authPost('/api/cook-logs', token).send({ recipeId, rating: 4 });
    await authPost('/api/cook-logs', token).send({ recipeId, rating: 5 });

    const logs = await authGet(`/api/cook-logs?recipeId=${recipeId}`, token);
    expect(logs.body.cookLogs).toHaveLength(2);
  });
});

// ─── List Cook Logs ──────────────────────────────────────

describe('GET /api/cook-logs', () => {
  beforeEach(async () => {
    await authPost('/api/cook-logs', token).send({ recipeId, rating: 4, notes: 'First' });
    await authPost('/api/cook-logs', token).send({ recipeId, rating: 5, notes: 'Second' });
  });

  it('lists all user cook logs', async () => {
    const res = await authGet('/api/cook-logs', token);

    expect(res.status).toBe(200);
    expect(res.body.cookLogs).toHaveLength(2);
    expect(res.body.cookLogs[0]).toHaveProperty('recipeTitle');
    expect(res.body.cookLogs[0]).toHaveProperty('cookedAt');
  });

  it('orders by cooked_at DESC (most recent first)', async () => {
    // The beforeEach logs may have same-second timestamps via the API.
    // Insert directly with distinct timestamps to verify ordering.
    const userInfo: any = db.prepare("SELECT id FROM users LIMIT 1").get()
    const userId = userInfo.id;
    db.prepare("DELETE FROM cook_logs").run(); // clear API-inserted logs
    db.prepare(
      "INSERT INTO cook_logs (user_id, recipe_id, rating, notes, cooked_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, recipeId, 4, 'Older', '2025-01-01 10:00:00');
    db.prepare(
      "INSERT INTO cook_logs (user_id, recipe_id, rating, notes, cooked_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, recipeId, 5, 'Newer', '2025-01-02 10:00:00');

    const res = await authGet('/api/cook-logs', token);
    expect(res.body.cookLogs[0].notes).toBe('Newer');
    expect(res.body.cookLogs[1].notes).toBe('Older');
  });

  it('filters by recipeId', async () => {
    const { recipe: recipe2 } = await createTestRecipe(token, { title: 'Another' });
    await authPost('/api/cook-logs', token).send({ recipeId: recipe2.id, rating: 3 });

    const all = await authGet('/api/cook-logs', token);
    expect(all.body.cookLogs).toHaveLength(3);

    const filtered = await authGet(`/api/cook-logs?recipeId=${recipeId}`, token);
    expect(filtered.body.cookLogs).toHaveLength(2);
  });

  it('does not include other users\' logs', async () => {
    const user2 = await createTestUser({ email: 'other@example.com' });
    const { recipe: r2 } = await createTestRecipe(user2.token);
    await authPost('/api/cook-logs', user2.token).send({ recipeId: r2.id, rating: 3 });

    const res = await authGet('/api/cook-logs', token);
    expect(res.body.cookLogs).toHaveLength(2); // only our logs
  });

  it('includes recipe title in response', async () => {
    const res = await authGet('/api/cook-logs', token);
    expect(res.body.cookLogs[0].recipeTitle).toBe('Test Recipe');
  });
});
