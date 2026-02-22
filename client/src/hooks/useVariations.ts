import { useState, useCallback } from 'react';
import client from '../api/client';
import type {
  VariationListItem,
  Variation,
  CookLog,
  FinishCookingInput,
  UseVariationsReturn,
  VariationApiResponse,
  VariationListApiResponse,
  FinishCookingApiResponse,
} from '../types';

export function useVariations(): UseVariationsReturn {
  const [variations, setVariations] = useState<VariationListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchVariations = useCallback(async (recipeId: number): Promise<VariationListItem[]> => {
    setLoading(true);
    try {
      const { data } = await client.get<VariationListApiResponse>('/variations', {
        params: { recipeId },
      });
      setVariations(data.variations);
      return data.variations;
    } catch (err) {
      console.error('Fetch variations error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getVariation = useCallback(async (id: number): Promise<Variation> => {
    const { data } = await client.get<VariationApiResponse>(`/variations/${id}`);
    return data.variation;
  }, []);

  const finishCooking = useCallback(async (input: FinishCookingInput): Promise<{ variation: Variation; cookLog: CookLog }> => {
    setLoading(true);
    try {
      const { data } = await client.post<FinishCookingApiResponse>('/variations/finish-cooking', input);
      return { variation: data.variation, cookLog: data.cookLog };
    } catch (err) {
      console.error('Finish cooking error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { variations, loading, fetchVariations, getVariation, finishCooking };
}
