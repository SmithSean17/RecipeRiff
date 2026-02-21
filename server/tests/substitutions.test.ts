/**
 * Substitution engine tests — exact match, fuzzy, word-split fallback, validation.
 */
import {
  app, db, request, cleanDatabase, createTestUser,
  authGet,
} from './helpers';

let token: string;

beforeAll(async () => {
  cleanDatabase();
  const user = await createTestUser();
  token = user.token;
});

describe('GET /api/substitutions/lookup', () => {
  it('returns substitutions for a common ingredient (butter)', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=butter', token);

    expect(res.status).toBe(200);
    expect(res.body.ingredient).toBe('butter');
    expect(res.body.substitutions.length).toBeGreaterThan(0);

    const sub = res.body.substitutions[0];
    expect(sub).toHaveProperty('substituteName');
    expect(sub).toHaveProperty('ratio');
    expect(sub).toHaveProperty('ratioNote');
    expect(sub).toHaveProperty('impactNote');
    expect(sub).toHaveProperty('category');
    expect(sub).toHaveProperty('rank');
  });

  it('returns substitutions sorted by rank', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=butter', token);
    const ranks = res.body.substitutions.map((s: any) => s.rank);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  it('normalizes ingredient to lowercase', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=BUTTER', token);
    expect(res.status).toBe(200);
    expect(res.body.ingredient).toBe('butter');
    expect(res.body.substitutions.length).toBeGreaterThan(0);
  });

  it('finds substitutions for egg', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=egg', token);
    expect(res.status).toBe(200);
    expect(res.body.substitutions.length).toBeGreaterThan(0);
  });

  it('finds substitutions for sugar', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=sugar', token);
    expect(res.status).toBe(200);
    expect(res.body.substitutions.length).toBeGreaterThan(0);
  });

  it('finds substitutions for flour (via word-split fallback for "all-purpose flour")', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=all-purpose%20flour', token);
    expect(res.status).toBe(200);
    // Should find matches via LIKE or word-split
    expect(res.body.substitutions.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown ingredient', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=unobtanium', token);
    expect(res.status).toBe(200);
    expect(res.body.substitutions).toHaveLength(0);
  });

  it('rejects missing ingredient parameter', async () => {
    const res = await authGet('/api/substitutions/lookup', token);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ingredient/i);
  });

  it('rejects empty ingredient parameter', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=', token);
    expect(res.status).toBe(400);
  });

  it('trims whitespace from ingredient', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=%20butter%20', token);
    expect(res.status).toBe(200);
    expect(res.body.ingredient).toBe('butter');
  });

  it('finds substitutions for milk', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=milk', token);
    expect(res.status).toBe(200);
    expect(res.body.substitutions.length).toBeGreaterThan(0);
  });

  it('finds substitutions for honey', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=honey', token);
    expect(res.status).toBe(200);
    expect(res.body.substitutions.length).toBeGreaterThan(0);
  });

  it('substitution data has expected shape', async () => {
    const res = await authGet('/api/substitutions/lookup?ingredient=butter', token);
    const sub = res.body.substitutions[0];

    expect(typeof sub.id).toBe('number');
    expect(typeof sub.substituteName).toBe('string');
    expect(typeof sub.ratio).toBe('number');
    expect(typeof sub.rank).toBe('number');
    // ratioNote, impactNote, category can be null or string
  });
});
