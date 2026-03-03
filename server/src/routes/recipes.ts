import express, { Request, Response } from 'express';
import db from '../db/init';
import type {
  RecipeRow,
  RecipeRowWithStats,
  RecipeTagRow,
  IngredientRow,
  DirectionRow,
  RecipeStats,
  TotalResult,
  SerializedRecipe,
  CreateRecipeBody,
  UpdateRecipeBody,
} from '../types';

const router = express.Router();

// Helper: serialize recipe from DB row + related data
function serializeRecipe(
  r: RecipeRow,
  tags: string[],
  ingredients: IngredientRow[],
  directions: DirectionRow[],
  stats: RecipeStats | undefined,
  isOwner: boolean = true
): SerializedRecipe {
  return {
    id: r.id,
    title: r.title,
    prepTime: r.prep_time,
    cookTime: r.cook_time,
    servings: r.servings,
    notes: r.notes,
    photoPath: r.photo_path,
    tags,
    ingredients: ingredients.map(i => ({ id: i.id, sortOrder: i.sort_order, quantity: i.quantity, name: i.name })),
    directions: directions.map(d => ({ id: d.id, stepNumber: d.step_number, text: d.text })),
    cookCount: stats?.cook_count || 0,
    lastCooked: stats?.last_cooked || null,
    avgRating: stats?.avg_rating || null,
    isOwner,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

// GET /api/recipes — list with search, tag filter, sort
router.get('/', (req: Request, res: Response): void => {
  try {
    const { search, tag, sort, page = 1, limit = 50 } = req.query;
    const userId = req.userId;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE r.user_id = ?';
    const params: (string | number)[] = [userId];

    if (tag && tag !== 'All') {
      where += ' AND r.id IN (SELECT recipe_id FROM recipe_tags WHERE tag = ? COLLATE NOCASE)';
      params.push(tag as string);
    }
    if (search && (search as string).trim()) {
      where += ' AND r.title LIKE ? COLLATE NOCASE';
      params.push(`%${(search as string).trim()}%`);
    }

    let orderBy = 'ORDER BY r.created_at DESC';
    if (sort === 'most-cooked') {
      orderBy = 'ORDER BY cook_count DESC, r.created_at DESC';
    } else if (sort === 'recently-cooked') {
      orderBy = "ORDER BY COALESCE(last_cooked, '1970-01-01') DESC, r.created_at DESC";
    }

    const countSql = `SELECT COUNT(DISTINCT r.id) as total FROM recipes r ${where}`;
    const total = (db.prepare(countSql).get(...params) as TotalResult).total;

    const sql = `
      SELECT r.*,
        COALESCE(cs.cook_count, 0) as cook_count,
        cs.last_cooked,
        cs.avg_rating
      FROM recipes r
      LEFT JOIN (
        SELECT recipe_id,
          COUNT(*) as cook_count,
          MAX(cooked_at) as last_cooked,
          ROUND(AVG(rating), 1) as avg_rating
        FROM cook_logs
        WHERE user_id = ?
        GROUP BY recipe_id
      ) cs ON cs.recipe_id = r.id
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const recipes = db.prepare(sql).all(userId, ...params, limitNum, offset) as RecipeRowWithStats[];

    // Batch fetch tags for all recipes (fixes N+1 query)
    const recipeIds = recipes.map(r => r.id);
    const tagMap: Record<number, string[]> = {};
    if (recipeIds.length > 0) {
      const placeholders = recipeIds.map(() => '?').join(',');
      const allTags = db.prepare(`SELECT recipe_id, tag FROM recipe_tags WHERE recipe_id IN (${placeholders})`).all(...recipeIds) as RecipeTagRow[];
      for (const t of allTags) {
        if (!tagMap[t.recipe_id]) tagMap[t.recipe_id] = [];
        tagMap[t.recipe_id].push(t.tag);
      }
    }

    const result = recipes.map(r => ({
      id: r.id,
      title: r.title,
      prepTime: r.prep_time,
      cookTime: r.cook_time,
      servings: r.servings,
      notes: r.notes,
      photoPath: r.photo_path,
      tags: tagMap[r.id] || [],
      cookCount: r.cook_count,
      lastCooked: r.last_cooked,
      avgRating: r.avg_rating,
      createdAt: r.created_at
    }));

    res.json({ recipes: result, total, page: pageNum, limit: limitNum });
  } catch (err: unknown) {
    console.error('List recipes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recipes/:id — full detail
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as RecipeRow | undefined;
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' }); return;
    }

    const tags = (db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ?').all(recipe.id) as RecipeTagRow[]).map(t => t.tag);
    const ingredients = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order').all(recipe.id) as IngredientRow[];
    const directions = db.prepare('SELECT * FROM directions WHERE recipe_id = ? ORDER BY step_number').all(recipe.id) as DirectionRow[];

    const stats = db.prepare(`
      SELECT COUNT(*) as cook_count, MAX(cooked_at) as last_cooked, ROUND(AVG(rating), 1) as avg_rating
      FROM cook_logs WHERE recipe_id = ? AND user_id = ?
    `).get(recipe.id, req.userId) as RecipeStats | undefined;

    const isOwner = recipe.user_id === req.userId;

    res.json({ recipe: serializeRecipe(recipe, tags, ingredients, directions, stats, isOwner) });
  } catch (err: unknown) {
    console.error('Get recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/recipes — create
router.post('/', (req: Request, res: Response): void => {
  try {
    if (!req.body) { res.status(400).json({ error: 'Request body required' }); return; }

    const { title, prepTime, cookTime, servings, notes, tags, ingredients, directions } = req.body as CreateRecipeBody;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Title is required' }); return;
    }
    if (title.length > 200) {
      res.status(400).json({ error: 'Title must be at most 200 characters' }); return;
    }
    if (notes && notes.length > 5000) {
      res.status(400).json({ error: 'Notes must be at most 5000 characters' }); return;
    }

    // Validate ingredients have names
    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        if (!ing.name || !ing.name.trim()) {
          res.status(400).json({ error: 'Each ingredient must have a name' }); return;
        }
      }
    }

    // Validate directions have text
    if (directions && directions.length > 0) {
      for (const dir of directions) {
        if (!dir.text || !dir.text.trim()) {
          res.status(400).json({ error: 'Each direction must have text' }); return;
        }
      }
    }

    const createRecipe = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO recipes (user_id, title, prep_time, cook_time, servings, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(req.userId, title.trim(), prepTime || null, cookTime || null, servings || null, notes || null);

      const recipeId = result.lastInsertRowid;

      if (tags && tags.length > 0) {
        const uniqueTags = [...new Set(tags)]; // Deduplicate
        const insertTag = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
        for (const tag of uniqueTags) {
          insertTag.run(recipeId, tag);
        }
      }

      if (ingredients && ingredients.length > 0) {
        const insertIng = db.prepare('INSERT INTO ingredients (recipe_id, sort_order, quantity, name) VALUES (?, ?, ?, ?)');
        ingredients.forEach((ing, i) => {
          insertIng.run(recipeId, i, ing.quantity || null, ing.name.trim());
        });
      }

      if (directions && directions.length > 0) {
        const insertDir = db.prepare('INSERT INTO directions (recipe_id, step_number, text) VALUES (?, ?, ?)');
        directions.forEach((dir, i) => {
          insertDir.run(recipeId, dir.stepNumber || i + 1, dir.text.trim());
        });
      }

      return recipeId;
    });

    const recipeId = createRecipe();

    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as RecipeRow;
    const savedTags = (db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ?').all(recipeId) as RecipeTagRow[]).map(t => t.tag);
    const savedIngs = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order').all(recipeId) as IngredientRow[];
    const savedDirs = db.prepare('SELECT * FROM directions WHERE recipe_id = ? ORDER BY step_number').all(recipeId) as DirectionRow[];

    res.status(201).json({
      recipe: serializeRecipe(recipe, savedTags, savedIngs, savedDirs, { cook_count: 0, last_cooked: null, avg_rating: null })
    });
  } catch (err: unknown) {
    console.error('Create recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/recipes/:id — update
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as RecipeRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Recipe not found' }); return;
    }

    if (!req.body) { res.status(400).json({ error: 'Request body required' }); return; }

    const { title, prepTime, cookTime, servings, notes, tags, ingredients, directions } = req.body as UpdateRecipeBody;

    if (title !== undefined && title.length > 200) {
      res.status(400).json({ error: 'Title must be at most 200 characters' }); return;
    }
    if (notes !== undefined && notes && notes.length > 5000) {
      res.status(400).json({ error: 'Notes must be at most 5000 characters' }); return;
    }

    if (ingredients !== undefined && ingredients.length > 0) {
      for (const ing of ingredients) {
        if (!ing.name || !ing.name.trim()) {
          res.status(400).json({ error: 'Each ingredient must have a name' }); return;
        }
      }
    }

    if (directions !== undefined && directions.length > 0) {
      for (const dir of directions) {
        if (!dir.text || !dir.text.trim()) {
          res.status(400).json({ error: 'Each direction must have text' }); return;
        }
      }
    }

    const updateRecipe = db.transaction(() => {
      db.prepare(`
        UPDATE recipes SET title = ?, prep_time = ?, cook_time = ?, servings = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        title ? title.trim() : existing.title,
        prepTime !== undefined ? prepTime : existing.prep_time,
        cookTime !== undefined ? cookTime : existing.cook_time,
        servings !== undefined ? servings : existing.servings,
        notes !== undefined ? notes : existing.notes,
        existing.id
      );

      if (tags !== undefined) {
        db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(existing.id);
        const uniqueTags = [...new Set(tags)];
        const insertTag = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
        for (const tag of uniqueTags) {
          insertTag.run(existing.id, tag);
        }
      }

      if (ingredients !== undefined) {
        db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(existing.id);
        const insertIng = db.prepare('INSERT INTO ingredients (recipe_id, sort_order, quantity, name) VALUES (?, ?, ?, ?)');
        ingredients.forEach((ing, i) => {
          insertIng.run(existing.id, i, ing.quantity || null, ing.name.trim());
        });
      }

      if (directions !== undefined) {
        db.prepare('DELETE FROM directions WHERE recipe_id = ?').run(existing.id);
        const insertDir = db.prepare('INSERT INTO directions (recipe_id, step_number, text) VALUES (?, ?, ?)');
        directions.forEach((dir, i) => {
          insertDir.run(existing.id, dir.stepNumber || i + 1, dir.text.trim());
        });
      }
    });

    updateRecipe();

    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(existing.id) as RecipeRow;
    const savedTags = (db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ?').all(existing.id) as RecipeTagRow[]).map(t => t.tag);
    const savedIngs = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order').all(existing.id) as IngredientRow[];
    const savedDirs = db.prepare('SELECT * FROM directions WHERE recipe_id = ? ORDER BY step_number').all(existing.id) as DirectionRow[];
    const stats = db.prepare(`
      SELECT COUNT(*) as cook_count, MAX(cooked_at) as last_cooked, ROUND(AVG(rating), 1) as avg_rating
      FROM cook_logs WHERE recipe_id = ? AND user_id = ?
    `).get(existing.id, req.userId) as RecipeStats | undefined;

    res.json({ recipe: serializeRecipe(recipe, savedTags, savedIngs, savedDirs, stats) });
  } catch (err: unknown) {
    console.error('Update recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as RecipeRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Recipe not found' }); return;
    }

    db.prepare('DELETE FROM recipes WHERE id = ?').run(existing.id);
    res.json({ success: true });
  } catch (err: unknown) {
    console.error('Delete recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
