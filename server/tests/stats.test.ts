/**
 * Stats API tests — streak, meals this month, unique recipes, most cooked, activity grid.
 */
import { User } from '../src/types';
import {
  app, db, request, cleanDatabase, createTestUser, createTestRecipe,
  authGet, authPost,
} from './helpers';

let token: string;

beforeEach(async () => {
  cleanDatabase();
  const user = await createTestUser();
  token = user.token;
});

describe('GET /api/stats', () => {
  it('returns zeroed stats for a new user', async () => {
    const res = await authGet('/api/stats', token);

    expect(res.status).toBe(200);
    expect(res.body.streak).toBe(0);
    expect(res.body.mealsThisMonth).toBe(0);
    expect(res.body.uniqueRecipesCooked).toBe(0);
    expect(res.body.totalRecipes).toBe(0);
    expect(res.body.mostCooked).toHaveLength(0);
    expect(res.body.activityGrid).toHaveLength(28);
  });

  it('counts total recipes', async () => {
    await createTestRecipe(token, { title: 'R1' });
    await createTestRecipe(token, { title: 'R2' });

    const res = await authGet('/api/stats', token);
    expect(res.body.totalRecipes).toBe(2);
  });

  it('counts meals this month after logging cooks', async () => {
    const { recipe } = await createTestRecipe(token);
    await authPost('/api/cook-logs', token).send({ recipeId: recipe.id, rating: 4 });
    await authPost('/api/cook-logs', token).send({ recipeId: recipe.id, rating: 5 });

    const res = await authGet('/api/stats', token);
    expect(res.body.mealsThisMonth).toBe(2);
  });

  it('counts unique recipes cooked', async () => {
    const { recipe: r1 } = await createTestRecipe(token, { title: 'R1' });
    const { recipe: r2 } = await createTestRecipe(token, { title: 'R2' });

    await authPost('/api/cook-logs', token).send({ recipeId: r1.id, rating: 4 });
    await authPost('/api/cook-logs', token).send({ recipeId: r1.id, rating: 5 });
    await authPost('/api/cook-logs', token).send({ recipeId: r2.id, rating: 3 });

    const res = await authGet('/api/stats', token);
    expect(res.body.uniqueRecipesCooked).toBe(2);
  });

  it('returns most cooked recipes (top 5, ordered by count)', async () => {
    const { recipe: r1 } = await createTestRecipe(token, { title: 'Popular' });
    const { recipe: r2 } = await createTestRecipe(token, { title: 'Less Popular' });

    // Cook r1 three times, r2 once
    await authPost('/api/cook-logs', token).send({ recipeId: r1.id, rating: 5 });
    await authPost('/api/cook-logs', token).send({ recipeId: r1.id, rating: 5 });
    await authPost('/api/cook-logs', token).send({ recipeId: r1.id, rating: 5 });
    await authPost('/api/cook-logs', token).send({ recipeId: r2.id, rating: 3 });

    const res = await authGet('/api/stats', token);
    expect(res.body.mostCooked).toHaveLength(2);
    expect(res.body.mostCooked[0].title).toBe('Popular');
    expect(res.body.mostCooked[0].count).toBe(3);
    expect(res.body.mostCooked[1].title).toBe('Less Popular');
    expect(res.body.mostCooked[1].count).toBe(1);
  });

  it('activity grid has 28 entries with date and count', async () => {
    const res = await authGet('/api/stats', token);

    expect(res.body.activityGrid).toHaveLength(28);
    for (const entry of res.body.activityGrid) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('count');
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.count).toBe('number');
    }

    // Last entry should be today
    const today = new Date().toISOString().split('T')[0];
    expect(res.body.activityGrid[27].date).toBe(today);
  });

  it('activity grid reflects cook logs', async () => {
    const { recipe } = await createTestRecipe(token);
    await authPost('/api/cook-logs', token).send({ recipeId: recipe.id, rating: 5 });

    const res = await authGet('/api/stats', token);
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = res.body.activityGrid.find((e: any) => e.date === today);
    expect(todayEntry.count).toBeGreaterThanOrEqual(1);
  });

  it('streak is 1 after cooking today', async () => {
    const { recipe } = await createTestRecipe(token);
    await authPost('/api/cook-logs', token).send({ recipeId: recipe.id, rating: 4 });

    const res = await authGet('/api/stats', token);
    expect(res.body.streak).toBe(1);
  });

  it('streak counts consecutive days', async () => {
    const { recipe } = await createTestRecipe(token);
    const userInfo: any = db.prepare("SELECT id FROM users LIMIT 1").get();
    const userId = userInfo.id;

    // Manually insert cook logs for today, yesterday, and day before
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().replace('T', ' ').slice(0, 19);
      db.prepare(
        'INSERT INTO cook_logs (user_id, recipe_id, rating, cooked_at) VALUES (?, ?, ?, ?)'
      ).run(userId, recipe.id, 5, dateStr);
    }

    const res = await authGet('/api/stats', token);
    expect(res.body.streak).toBeGreaterThanOrEqual(3);
  });

  it('does not count other users\' stats', async () => {
    const user2 = await createTestUser({ email: 'other@example.com' });
    const { recipe } = await createTestRecipe(user2.token);
    await authPost('/api/cook-logs', user2.token).send({ recipeId: recipe.id, rating: 5 });

    const res = await authGet('/api/stats', token);
    expect(res.body.mealsThisMonth).toBe(0);
    expect(res.body.uniqueRecipesCooked).toBe(0);
  });
});
