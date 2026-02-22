import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal,
  ActivityIndicator, Alert, AlertButton, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import IngredientRow from '../../components/IngredientRow';
import CookLogModal from '../../components/CookLogModal';
import { useRecipes } from '../../hooks/useRecipes';
import { useSubstitutions } from '../../hooks/useSubstitutions';
import { useCookLogs } from '../../hooks/useCookLogs';
import { useVariations } from '../../hooks/useVariations';
import { colors, spacing, radius, recipeGradients, tagColors } from '../../theme';
import type { RecipesStackParamList } from '../../types/navigation';
import type { Recipe, Ingredient, Substitution, CookModeIngredient, CookModeDirection, VariationListItem } from '../../types';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeDetail'>;

interface SubMap {
  [ingredientId: number]: { name: string; quantity: string };
}

interface StatComponentProps {
  icon: string;
  label: string;
}

export default function RecipeDetailScreen({ navigation, route }: Props) {
  const recipeId = route.params?.id;
  const { getRecipe, deleteRecipe } = useRecipes();
  const { substitutions, loading: subsLoading, lookupSubstitutions } = useSubstitutions();
  const { logCook } = useCookLogs();
  const { variations, loading: variationsLoading, fetchVariations, getVariation } = useVariations();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'directions' | 'notes' | 'variations'>('ingredients');
  const [subs, setSubs] = useState<SubMap>({});
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [activeIngredient, setActiveIngredient] = useState<Ingredient | null>(null);
  const [showCookLog, setShowCookLog] = useState(false);
  const [customSubName, setCustomSubName] = useState('');

  const loadRecipeCallback = useCallback(() => {
    loadRecipe();
  }, [recipeId]);

  useEffect(() => {
    loadRecipeCallback();
  }, [loadRecipeCallback]);

  async function loadRecipe(): Promise<void> {
    setLoading(true);
    try {
      const r = await getRecipe(recipeId);
      setRecipe(r);
      fetchVariations(recipeId).catch(() => {});
    } catch (err: unknown) {
      Alert.alert('Error', 'Failed to load recipe.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  const handleIngredientPress = (ingredient: Ingredient): void => {
    Alert.alert(
      ingredient.name,
      `${ingredient.quantity || ''} ${ingredient.name}`,
      [
        { text: "I want to swap this", onPress: () => handleSubLookup(ingredient) },
        subs[ingredient.id]
          ? {
              text: 'Reset substitution',
              onPress: () => {
                const updated = { ...subs };
                delete updated[ingredient.id];
                setSubs(updated);
              }
            }
          : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as AlertButton[]
    );
  }

  async function handleSubLookup(ingredient: Ingredient): Promise<void> {
    setActiveIngredient(ingredient);
    try {
      await lookupSubstitutions(ingredient.name);
      setShowSubSheet(true);
    } catch (err: unknown) {
      Alert.alert('No Substitutions', 'No substitutions found for this ingredient.');
    }
  }

  function parseFraction(str: string): number | null {
    const trimmed = (str || '').trim();
    const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
      return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    }
    const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) {
      return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    }
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
  }

  function selectSubstitution(sub: Substitution): void {
    if (!activeIngredient) return;
    const origQty = activeIngredient.quantity || '';
    const numMatch = origQty.match(/[\d./\s]+/);
    let adjustedQty = origQty;
    if (numMatch) {
      const num = parseFraction(numMatch[0]);
      if (num !== null) {
        const adjusted = (num * sub.ratio).toFixed(2).replace(/\.?0+$/, '');
        adjustedQty = origQty.replace(numMatch[0], adjusted);
      }
    }

    setSubs({
      ...subs,
      [activeIngredient.id]: { name: sub.substituteName, quantity: adjustedQty },
    });
    setShowSubSheet(false);
    setActiveIngredient(null);
  }

  function selectCustomSubstitution(): void {
    if (!activeIngredient || !customSubName.trim()) return;
    setSubs({
      ...subs,
      [activeIngredient.id]: { name: customSubName.trim(), quantity: activeIngredient.quantity || '' },
    });
    setShowSubSheet(false);
    setActiveIngredient(null);
    setCustomSubName('');
  }

  async function handleCookLog({ recipeId: rid, rating, notes }: { recipeId: number; rating: number | null; notes: string | null }): Promise<void> {
    try {
      await logCook({ recipeId: rid, rating, notes });
      setShowCookLog(false);
      Alert.alert('Logged!', 'Cook logged successfully.');
      loadRecipe();
    } catch (err: unknown) {
      Alert.alert('Error', 'Failed to log cook.');
    }
  }

  function enterRiffMode(): void {
    if (!recipe) return;

    const riffIngredients: CookModeIngredient[] = recipe.ingredients.map((ing, idx) => {
      const sub = subs[ing.id];
      if (sub) {
        return {
          key: `ing-${idx}`,
          quantity: sub.quantity,
          name: sub.name,
          isSubstitution: true,
          originalIngredientName: ing.name,
        };
      }
      return {
        key: `ing-${idx}`,
        quantity: ing.quantity || '',
        name: ing.name,
        isSubstitution: false,
        originalIngredientName: null,
      };
    });

    const riffDirections: CookModeDirection[] = recipe.directions.map((dir, idx) => ({
      key: `dir-${idx}`,
      text: dir.text,
    }));

    navigation.navigate('RiffMode', {
      recipe,
      initialIngredients: riffIngredients,
      initialDirections: riffDirections,
    });
  }

  if (loading || !recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.amberDeep} />
        </View>
      </SafeAreaView>
    );
  }

  const gradientIndex = (recipe.id || 0) % recipeGradients.length;
  const [bgColor] = recipeGradients[gradientIndex];
  const tabs: Array<'ingredients' | 'directions' | 'notes' | 'variations'> = ['ingredients', 'directions', 'notes', 'variations'];

  const handleDeleteConfirmation = () => {
    deleteRecipe(recipeId);
    navigation.navigate('RecipeList');
  };

  const handleDeletePress = () => {
    Alert.alert(
      'Are you sure you want to delete this recipe?',
      '',
      [
        {
          text: 'Yes, delete this',
          style: 'destructive',
          onPress: handleDeleteConfirmation
        },
        {
          text: 'Cancel', style: 'cancel'
        }
      ]
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.flex}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: bgColor }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.charcoal} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePress}>
            <Ionicons name="trash-outline" size={20} color={colors.charcoal} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('RecipeForm', { recipe })}>
            <Ionicons name="pencil" size={20} color={colors.charcoal} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          <Text style={styles.title}>{recipe.title}</Text>

          <View style={styles.statsRow}>
            {recipe.prepTime && <Stat icon="time-outline" label={recipe.prepTime} />}
            {recipe.cookTime && <Stat icon="flame-outline" label={recipe.cookTime} />}
            {recipe.servings && <Stat icon="people-outline" label={recipe.servings} />}
          </View>

          {recipe.tags?.length > 0 && (
            <View style={styles.tagRow}>
              {recipe.tags.map(tag => {
                const tc = tagColors[tag] || { bg: 'rgba(245,158,11,0.12)', text: '#D97706' };
                return (
                  <View key={tag} style={[styles.miniTag, { backgroundColor: tc.bg }]}>
                    <Text style={[styles.miniTagText, { color: tc.text }]}>{tag}</Text>
                  </View>
                );
              })}
              {recipe.cookCount > 0 && (
                <Text style={styles.cookCount}>Cooked {recipe.cookCount}x</Text>
              )}
            </View>
          )}

          <View style={styles.tabBar}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'ingredients' && (
            <View>
              {recipe.ingredients?.map(ing => (
                <IngredientRow
                  key={ing.id}
                  ingredient={ing}
                  substitution={subs[ing.id] || null}
                  onPress={() => handleIngredientPress(ing)}
                />
              ))}
              {Object.keys(subs).length > 0 && (
                <TouchableOpacity style={styles.resetBtn} onPress={() => setSubs({})}>
                  <Text style={styles.resetText}>Reset All Substitutions</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeTab === 'directions' && (
            <View>
              {recipe.directions?.map((dir) => (
                <View key={dir.id} style={styles.directionRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNum}>{dir.stepNumber}</Text>
                  </View>
                  <Text style={styles.dirText}>{dir.text}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'notes' && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>{recipe.notes || 'No notes yet.'}</Text>
            </View>
          )}

          {activeTab === 'variations' && (
            <View>
              {variationsLoading ? (
                <ActivityIndicator color={colors.amberDeep} style={{ marginTop: 20 }} />
              ) : variations.length === 0 ? (
                <View style={styles.emptyVariations}>
                  <Ionicons name="flask-outline" size={32} color={colors.barkLighter} />
                  <Text style={styles.emptyVariationsText}>No variations yet</Text>
                  <Text style={styles.emptyVariationsHint}>Use Riff Mode to create your first variation!</Text>
                </View>
              ) : (
                variations.map(v => (
                  <TouchableOpacity key={v.id} style={styles.variationRow} activeOpacity={0.7}>
                    <View style={styles.variationInfo}>
                      <Text style={styles.variationLabel}>{v.label}</Text>
                      <Text style={styles.variationDate}>
                        {new Date(v.createdAt + 'Z').toLocaleDateString()}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.barkLighter} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.bottomBarButtons}>
            <TouchableOpacity style={styles.cookModeBtn} onPress={enterRiffMode} activeOpacity={0.8}>
              <Ionicons name="flame" size={16} color={colors.amberDeep} />
              <Text style={styles.cookModeBtnText}>Riff Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.madeThisBtn} onPress={() => setShowCookLog(true)} activeOpacity={0.8}>
              <Text style={styles.madeThisText}>I Made This</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Substitution Sheet Modal */}
        <Modal visible={showSubSheet} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.subSheet}>
              <View style={styles.handle} />
              <Text style={styles.subTitle}>
                Substitute for: {activeIngredient?.quantity} {activeIngredient?.name}
              </Text>
              <Text style={styles.subSubtitle}>in {recipe.title}</Text>

              <ScrollView style={styles.subScrollContent} showsVerticalScrollIndicator={false}>
                {subsLoading ? (
                  <ActivityIndicator color={colors.amberDeep} style={{ marginTop: 20 }} />
                ) : (
                  <>
                    {substitutions.length > 0 && (
                      <>
                        <Text style={styles.sectionLabel}>Suggested</Text>
                        {substitutions.map((sub, i) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={[styles.subOption, i === 0 && styles.subOptionBest]}
                            onPress={() => selectSubstitution(sub)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.subOptionHeader}>
                              <Text style={styles.subName}>{sub.substituteName}</Text>
                              {i === 0 && (
                                <View style={styles.bestBadge}>
                                  <Text style={styles.bestBadgeText}>Best match</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.subRatio}>Ratio: {sub.ratio}x</Text>
                            {sub.impactNote && <Text style={styles.subNote}>{sub.impactNote}</Text>}
                          </TouchableOpacity>
                        ))}
                      </>
                    )}

                    <Text style={[styles.sectionLabel, { marginTop: substitutions.length > 0 ? 16 : 0 }]}>
                      Custom
                    </Text>
                    <View style={styles.customSubRow}>
                      <TextInput
                        style={styles.customSubInput}
                        value={customSubName}
                        onChangeText={setCustomSubName}
                        placeholder="Enter your own substitute..."
                        placeholderTextColor={colors.barkLighter}
                        returnKeyType="done"
                        onSubmitEditing={selectCustomSubstitution}
                      />
                      <TouchableOpacity
                        style={[styles.customSubBtn, !customSubName.trim() && { opacity: 0.4 }]}
                        onPress={selectCustomSubstitution}
                        disabled={!customSubName.trim()}
                      >
                        <Text style={styles.customSubBtnText}>Use</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>

              <TouchableOpacity style={styles.subCancel} onPress={() => { setShowSubSheet(false); setActiveIngredient(null); setCustomSubName(''); }}>
                <Text style={styles.subCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <CookLogModal
          visible={showCookLog}
          recipe={recipe}
          onClose={() => setShowCookLog(false)}
          onSubmit={handleCookLog}
        />
      </View>
    </SafeAreaView>
  );
}

function Stat({ icon, label }: StatComponentProps) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon as 'time-outline'} size={14} color={colors.barkLight} />
      <Text style={styles.statText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { height: 200, position: 'relative' },
  backBtn: {
    position: 'absolute', top: 12, left: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    position: 'absolute', top: 12, right: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    position: 'absolute', top: 12, right: 64, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  title: { fontFamily: 'DMSerifDisplay', fontSize: 26, color: colors.charcoal, marginTop: 16, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: colors.barkLight },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  miniTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  miniTagText: { fontSize: 11, fontWeight: '600' },
  cookCount: { fontSize: 12, color: colors.barkLight, marginLeft: 8 },
  tabBar: { flexDirection: 'row', gap: 4, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(45,41,38,0.04)' },
  tabActive: { backgroundColor: colors.sageLight },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.barkLight },
  tabTextActive: { color: colors.sageDeep, fontWeight: '600' },
  directionRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  stepNum: { fontSize: 13, fontWeight: '600', color: colors.amberDeep },
  dirText: { flex: 1, fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  notesContainer: { padding: 16, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: radius.md },
  notesText: { fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  resetBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  resetText: { fontSize: 13, color: colors.barkLight, fontWeight: '500' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingBottom: 16, paddingTop: 8,
    backgroundColor: 'rgba(255,248,240,0.9)',
  },
  bottomBarButtons: {
    flexDirection: 'row', gap: 10,
  },
  cookModeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: radius.md, padding: 16,
    borderWidth: 1.5, borderColor: colors.amberDeep, backgroundColor: 'transparent',
  },
  cookModeBtnText: { color: colors.amberDeep, fontSize: 15, fontWeight: '600' },
  madeThisBtn: {
    flex: 1, backgroundColor: colors.amberDeep, borderRadius: radius.md, padding: 16, alignItems: 'center',
  },
  madeThisText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyVariations: { alignItems: 'center', paddingVertical: 32 },
  emptyVariationsText: { fontSize: 16, fontWeight: '600', color: colors.barkLight, marginTop: 12 },
  emptyVariationsHint: { fontSize: 13, color: colors.barkLighter, marginTop: 4, textAlign: 'center' },
  variationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 10,
    marginBottom: 6, borderWidth: 1, borderColor: 'rgba(45,41,38,0.04)',
  },
  variationInfo: { flex: 1 },
  variationLabel: { fontSize: 15, fontWeight: '500', color: colors.charcoal },
  variationDate: { fontSize: 12, color: colors.barkLight, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  subSheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingTop: 12, maxHeight: '75%',
  },
  subScrollContent: { flexGrow: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.barkLighter, alignSelf: 'center', marginBottom: 16 },
  subTitle: { fontFamily: 'DMSerifDisplay', fontSize: 18, color: colors.charcoal, textAlign: 'center' },
  subSubtitle: { fontSize: 13, color: colors.barkLight, textAlign: 'center', marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.amberDeep, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  noSubs: { fontSize: 14, color: colors.barkLight, textAlign: 'center', paddingVertical: 20 },
  subOption: {
    padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  subOptionBest: { backgroundColor: colors.sageLight, borderColor: 'rgba(139,175,124,0.3)' },
  subOptionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subName: { fontSize: 15, fontWeight: '600', color: colors.charcoal },
  bestBadge: { backgroundColor: 'rgba(139,175,124,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  bestBadgeText: { fontSize: 10, fontWeight: '600', color: colors.sageDeep },
  subRatio: { fontSize: 12, color: colors.sageDeep, fontWeight: '500', marginTop: 4 },
  subNote: { fontSize: 12, color: colors.barkLight, marginTop: 4 },
  subCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  subCancelText: { fontSize: 14, color: colors.barkLight },
  customSubRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  customSubInput: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: 12,
    fontSize: 14, color: colors.charcoal, borderWidth: 1.5, borderColor: colors.border,
  },
  customSubBtn: {
    backgroundColor: colors.amberDeep, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  customSubBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
