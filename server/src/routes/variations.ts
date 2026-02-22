import express, { Request, Response } from 'express';
import db from '../db/init';
import type {
  RecipeRow,
  RecipeVariationRow,
  VariationIngredientRow,
  VariationDirectionRow,
  CookLogRow,
  FinishCookingBody,
} from '../types';

const router = express.Router();

// Helper: serialize a variation with its ingredients and directions
function serializeVariation(
  v: RecipeVariationRow,
  ingredients: VariationIngredientRow[],
  directions: VariationDirectionRow[]
) {
  return {
    id: v.id,
    recipeId: v.recipe_id,
    label: v.label,
    notes: v.notes,
    ingredients: ingredients.map(i => ({
      id: i.id,
      sortOrder: i.sort_order,
      quantity: i.quantity,
      name: i.name,
      isSubstitution: i.is_substitution === 1,
      originalIngredientName: i.original_ingredient_name,
    })),
    directions: directions.map(d => ({
      id: d.id,
      stepNumber: d.step_number,
      text: d.text,
    })),
    createdAt: v.created_at,
  };
}

// POST /api/variations/finish-cooking — atomically create variation + cook log
router.post('/finish-cooking', (req: Request, res: Response): void => {
  try {
    const {
      recipeId, label, variationNotes,
      ingredients, directions,
      rating, cookLogNotes
    } = req.body as FinishCookingBody;

    if (!recipeId) {
      res.status(400).json({ error: 'recipeId is required' }); return;
    }
    if (!label || !(label as string).trim()) {
      res.status(400).json({ error: 'label is required' }); return;
    }
    if (!ingredients || ingredients.length === 0) {
      res.status(400).json({ error: 'At least one ingredient is required' }); return;
    }

    // Validate ingredients have names
    for (const ing of ingredients) {
      if (!ing.name || !ing.name.trim()) {
        res.status(400).json({ error: 'Each ingredient must have a name' }); return;
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

    // Verify recipe exists and belongs to user
    const recipe = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
      .get(recipeId, req.userId) as RecipeRow | undefined;
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' }); return;
    }

    // Validate rating range
    if (rating !== undefined && rating !== null && rating !== '') {
      const parsedRating = parseInt(rating as string);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        res.status(400).json({ error: 'Rating must be between 1 and 5' }); return;
      }
    }

    const finishCooking = db.transaction(() => {
      // 1. Create variation
      const varResult = db.prepare(
        'INSERT INTO recipe_variations (recipe_id, user_id, label, notes) VALUES (?, ?, ?, ?)'
      ).run(recipeId, req.userId, (label as string).trim(), variationNotes || null);
      const variationId = varResult.lastInsertRowid;

      // 2. Insert variation ingredients
      const insertIng = db.prepare(
        'INSERT INTO variation_ingredients (variation_id, sort_order, quantity, name, is_substitution, original_ingredient_name) VALUES (?, ?, ?, ?, ?, ?)'
      );
      ingredients.forEach((ing, i) => {
        insertIng.run(
          variationId, i, ing.quantity || null, ing.name.trim(),
          ing.isSubstitution ? 1 : 0,
          ing.originalIngredientName || null
        );
      });

      // 3. Insert variation directions
      if (directions && directions.length > 0) {
        const insertDir = db.prepare(
          'INSERT INTO variation_directions (variation_id, step_number, text) VALUES (?, ?, ?)'
        );
        directions.forEach((dir, i) => {
          insertDir.run(variationId, dir.stepNumber || i + 1, dir.text.trim());
        });
      }

      // 4. Create cook log linked to this variation
      const parsedRating = rating ? parseInt(rating as string) : null;
      const logResult = db.prepare(
        'INSERT INTO cook_logs (user_id, recipe_id, rating, notes, variation_id) VALUES (?, ?, ?, ?, ?)'
      ).run(req.userId, recipeId, parsedRating, cookLogNotes || null, variationId);

      return { variationId, cookLogId: logResult.lastInsertRowid };
    });

    const { variationId, cookLogId } = finishCooking();

    // Fetch and serialize response
    const variation = db.prepare('SELECT * FROM recipe_variations WHERE id = ?')
      .get(variationId) as RecipeVariationRow;
    const varIngs = db.prepare('SELECT * FROM variation_ingredients WHERE variation_id = ? ORDER BY sort_order')
      .all(variationId) as VariationIngredientRow[];
    const varDirs = db.prepare('SELECT * FROM variation_directions WHERE variation_id = ? ORDER BY step_number')
      .all(variationId) as VariationDirectionRow[];
    const cookLog = db.prepare('SELECT * FROM cook_logs WHERE id = ?')
      .get(cookLogId) as CookLogRow;

    res.status(201).json({
      variation: serializeVariation(variation, varIngs, varDirs),
      cookLog: {
        id: cookLog.id,
        recipeId: cookLog.recipe_id,
        rating: cookLog.rating,
        notes: cookLog.notes,
        photoPath: cookLog.photo_path,
        cookedAt: cookLog.cooked_at,
        variationId: Number(variationId),
        variationLabel: variation.label,
      }
    });
  } catch (err: unknown) {
    console.error('Finish cooking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/variations — list variations for a recipe
router.get('/', (req: Request, res: Response): void => {
  try {
    const { recipeId } = req.query;
    if (!recipeId) {
      res.status(400).json({ error: 'recipeId query parameter is required' }); return;
    }

    const variations = db.prepare(`
      SELECT * FROM recipe_variations
      WHERE recipe_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `).all(recipeId, req.userId) as RecipeVariationRow[];

    res.json({
      variations: variations.map(v => ({
        id: v.id,
        recipeId: v.recipe_id,
        label: v.label,
        notes: v.notes,
        createdAt: v.created_at,
      }))
    });
  } catch (err: unknown) {
    console.error('List variations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/variations/:id — get full variation detail
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const variation = db.prepare(
      'SELECT * FROM recipe_variations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.userId) as RecipeVariationRow | undefined;

    if (!variation) {
      res.status(404).json({ error: 'Variation not found' }); return;
    }

    const ingredients = db.prepare(
      'SELECT * FROM variation_ingredients WHERE variation_id = ? ORDER BY sort_order'
    ).all(variation.id) as VariationIngredientRow[];

    const directions = db.prepare(
      'SELECT * FROM variation_directions WHERE variation_id = ? ORDER BY step_number'
    ).all(variation.id) as VariationDirectionRow[];

    res.json({ variation: serializeVariation(variation, ingredients, directions) });
  } catch (err: unknown) {
    console.error('Get variation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
