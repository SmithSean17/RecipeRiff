import express, { Request, Response } from 'express';
import db from '../db/init';
import upload from '../middleware/upload';
import type { RecipeRow, CookLogRow, CookLogRowWithTitle } from '../types';

const router = express.Router();

// POST /api/cook-logs — log a cook
router.post('/', upload.single('photo'), (req: Request, res: Response): void => {
  try {
    const { recipeId, rating, notes } = req.body as { recipeId?: string; rating?: string; notes?: string };

    if (!recipeId) {
      res.status(400).json({ error: 'recipeId is required' }); return;
    }

    // Validate rating range
    if (rating !== undefined && rating !== null && rating !== '') {
      const parsedRating = parseInt(rating);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        res.status(400).json({ error: 'Rating must be between 1 and 5' }); return;
      }
    }

    // Verify recipe exists and belongs to user
    const recipe = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, req.userId) as RecipeRow | undefined;
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' }); return;
    }

    const photoPath = req.file ? `cook-logs/${req.file.filename}` : null;
    const parsedRating = rating ? parseInt(rating) : null;

    const result = db.prepare(
      'INSERT INTO cook_logs (user_id, recipe_id, rating, notes, photo_path) VALUES (?, ?, ?, ?, ?)'
    ).run(req.userId, recipeId, parsedRating, notes || null, photoPath);

    const log = db.prepare('SELECT * FROM cook_logs WHERE id = ?').get(result.lastInsertRowid) as CookLogRow;

    res.status(201).json({
      cookLog: {
        id: log.id,
        recipeId: log.recipe_id,
        rating: log.rating,
        notes: log.notes,
        photoPath: log.photo_path,
        cookedAt: log.cooked_at,
        variationId: null,
        variationLabel: null,
      }
    });
  } catch (err: unknown) {
    console.error('Log cook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cook-logs — get cook history
router.get('/', (req: Request, res: Response): void => {
  try {
    const { recipeId } = req.query;

    let sql = `
      SELECT cl.*, r.title as recipe_title,
        rv.id as variation_id, rv.label as variation_label
      FROM cook_logs cl
      JOIN recipes r ON r.id = cl.recipe_id
      LEFT JOIN recipe_variations rv ON rv.id = cl.variation_id
      WHERE cl.user_id = ?
    `;
    const params: (string | number)[] = [req.userId];

    if (recipeId) {
      sql += ' AND cl.recipe_id = ?';
      params.push(recipeId as string);
    }

    sql += ' ORDER BY cl.cooked_at DESC';

    const logs = db.prepare(sql).all(...params) as CookLogRowWithTitle[];

    res.json({
      cookLogs: logs.map(l => ({
        id: l.id,
        recipeId: l.recipe_id,
        recipeTitle: l.recipe_title,
        rating: l.rating,
        notes: l.notes,
        photoPath: l.photo_path,
        cookedAt: l.cooked_at,
        variationId: l.variation_id || null,
        variationLabel: l.variation_label || null,
      }))
    });
  } catch (err: unknown) {
    console.error('Get cook logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
