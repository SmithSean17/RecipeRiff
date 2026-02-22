import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Modal, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RiffIngredientCard from '../../components/RiffIngredientCard';
import { useSubstitutions } from '../../hooks/useSubstitutions';
import { colors, spacing, radius } from '../../theme';
import type { RecipesStackParamList } from '../../types/navigation';
import type { CookModeIngredient, CookModeDirection, Substitution } from '../../types';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RiffMode'>;

export default function RiffModeScreen({ navigation, route }: Props) {
  const { recipe, initialIngredients, initialDirections } = route.params;
  const { substitutions, loading: subsLoading, lookupSubstitutions } = useSubstitutions();

  const [ingredients, setIngredients] = useState<CookModeIngredient[]>(initialIngredients);
  const [directions, setDirections] = useState<CookModeDirection[]>(initialDirections);
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());

  // Substitution sheet state
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [activeIngIdx, setActiveIngIdx] = useState<number | null>(null);
  const [customSubName, setCustomSubName] = useState('');

  // Store original quantities so we can detect modifications and undo them
  const originalQtyMap = useRef<Map<string, string>>(
    new Map(initialIngredients.map(i => [i.key, i.quantity]))
  );

  const nextKeyRef = useRef(1000);
  function getNextKey(prefix: string): string {
    nextKeyRef.current += 1;
    return `${prefix}-${nextKeyRef.current}`;
  }

  // --- Count changes for the strip ---
  function getChangeCounts() {
    let swapped = 0, added = 0, removed = removedKeys.size, qtyModified = 0;
    for (const ing of ingredients) {
      if (ing.isSubstitution) swapped++;
      else if (ing.key.startsWith('added-')) added++;
      else {
        const orig = originalQtyMap.current.get(ing.key);
        if (orig !== undefined && ing.quantity !== orig) qtyModified++;
      }
    }
    return { swapped, added, removed, qtyModified };
  }

  // --- Quantity helpers ---
  function parseFraction(str: string): number | null {
    const trimmed = (str || '').trim();
    const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
  }

  function adjustQuantity(index: number, delta: number): void {
    setIngredients(prev => {
      const updated = [...prev];
      const qty = updated[index].quantity || '';
      const numMatch = qty.match(/[\d./\s]+/);
      if (numMatch) {
        const num = parseFraction(numMatch[0]);
        if (num !== null) {
          const newNum = Math.max(0, num + delta);
          const formatted = newNum % 1 === 0 ? String(newNum) : newNum.toFixed(2).replace(/\.?0+$/, '');
          updated[index] = { ...updated[index], quantity: qty.replace(numMatch[0], formatted) };
        }
      }
      return updated;
    });
  }

  function setQuantity(index: number, value: string): void {
    setIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: value };
      return updated;
    });
  }

  // --- Add ingredient ---
  function addIngredient(): void {
    Alert.prompt(
      'Add Ingredient',
      'Enter ingredient (e.g. "1/2 cup chocolate chips")',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (text?: string) => {
            if (!text?.trim()) return;
            const match = text.trim().match(/^([\d./\s]+\s*\w*?)\s+(.+)$/);
            let qty = '', name = text.trim();
            if (match) {
              qty = match[1].trim();
              name = match[2].trim();
            }
            const newIng: CookModeIngredient = {
              key: `added-${getNextKey('ing')}`,
              quantity: qty,
              name,
              isSubstitution: false,
              originalIngredientName: null,
            };
            setIngredients(prev => [...prev, newIng]);
          },
        },
      ],
      'plain-text',
    );
  }

  // --- Remove ingredient (move to removed section) ---
  function removeIngredient(index: number): void {
    const ing = ingredients[index];
    if (ing.key.startsWith('added-')) {
      // Fully delete added ingredients
      setIngredients(prev => prev.filter((_, i) => i !== index));
    } else {
      // Mark as removed
      setRemovedKeys(prev => new Set(prev).add(ing.key));
    }
  }

  // --- Undo remove ---
  function undoRemove(key: string): void {
    setRemovedKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // --- Direction editing ---
  function editDirection(index: number, text: string): void {
    setDirections(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  }

  function addDirectionAt(index: number): void {
    const newDir: CookModeDirection = {
      key: getNextKey('dir'),
      text: '',
    };
    setDirections(prev => {
      const updated = [...prev];
      updated.splice(index, 0, newDir);
      return updated;
    });
  }

  function removeDirection(index: number): void {
    if (directions.length <= 1) return;
    setDirections(prev => prev.filter((_, i) => i !== index));
  }

  // --- Undo swap or qty modification ---
  function undoChange(index: number): void {
    const ing = ingredients[index];
    if (ing.isSubstitution && ing.originalIngredientName) {
      // Undo a swap: restore original name + original qty
      const origIng = recipe.ingredients.find(ri => ri.name === ing.originalIngredientName);
      const origQty = originalQtyMap.current.get(ing.key) || origIng?.quantity || ing.quantity;
      setIngredients(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          name: ing.originalIngredientName!,
          quantity: origQty,
          isSubstitution: false,
          originalIngredientName: null,
        };
        return updated;
      });
    } else {
      // Undo a qty modification: restore original quantity
      const origQty = originalQtyMap.current.get(ing.key);
      if (origQty !== undefined) {
        setIngredients(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], quantity: origQty };
          return updated;
        });
      }
    }
  }

  // --- Substitution flow ---
  function handleSwap(index: number): void {
    setActiveIngIdx(index);
    setCustomSubName('');
    const ing = ingredients[index];
    lookupSubstitutions(ing.isSubstitution && ing.originalIngredientName ? ing.originalIngredientName : ing.name)
      .then(() => setShowSubSheet(true))
      .catch(() => {
        // No results - still show sheet for custom entry
        setShowSubSheet(true);
      });
  }

  function selectSubstitution(sub: Substitution): void {
    if (activeIngIdx === null) return;
    const ing = ingredients[activeIngIdx];
    const origQty = ing.quantity || '';
    const numMatch = origQty.match(/[\d./\s]+/);
    let adjustedQty = origQty;
    if (numMatch) {
      const num = parseFraction(numMatch[0]);
      if (num !== null) {
        const adjusted = (num * sub.ratio).toFixed(2).replace(/\.?0+$/, '');
        adjustedQty = origQty.replace(numMatch[0], adjusted);
      }
    }

    setIngredients(prev => {
      const updated = [...prev];
      updated[activeIngIdx] = {
        ...updated[activeIngIdx],
        originalIngredientName: ing.isSubstitution ? ing.originalIngredientName : ing.name,
        name: sub.substituteName,
        quantity: adjustedQty,
        isSubstitution: true,
      };
      return updated;
    });
    setShowSubSheet(false);
    setActiveIngIdx(null);
  }

  function selectCustomSubstitution(): void {
    if (activeIngIdx === null || !customSubName.trim()) return;
    const ing = ingredients[activeIngIdx];
    setIngredients(prev => {
      const updated = [...prev];
      updated[activeIngIdx] = {
        ...updated[activeIngIdx],
        originalIngredientName: ing.isSubstitution ? ing.originalIngredientName : ing.name,
        name: customSubName.trim(),
        isSubstitution: true,
      };
      return updated;
    });
    setShowSubSheet(false);
    setActiveIngIdx(null);
    setCustomSubName('');
  }

  // --- Navigate to Cook ---
  function startCooking(): void {
    const activeIngredients = ingredients.filter(ing => !removedKeys.has(ing.key));
    if (activeIngredients.length === 0) {
      Alert.alert('No ingredients', 'Add at least one ingredient before cooking.');
      return;
    }
    navigation.navigate('CookScreen', {
      recipe,
      ingredients: activeIngredients,
      directions,
    });
  }

  function handleCancel(): void {
    const changes = getChangeCounts();
    const totalChanges = changes.swapped + changes.added + changes.removed;
    if (totalChanges === 0) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Discard changes?',
      `You have ${totalChanges} change${totalChanges > 1 ? 's' : ''}. Discard them?`,
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  }

  const changes = getChangeCounts();
  const totalChanges = changes.swapped + changes.added + changes.removed + changes.qtyModified;
  const activeIngs = ingredients.filter(ing => !removedKeys.has(ing.key));
  const removedIngs = ingredients.filter(ing => removedKeys.has(ing.key));
  const activeIng = activeIngIdx !== null ? ingredients[activeIngIdx] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleCancel}>
          <Ionicons name="chevron-back" size={22} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
          <Text style={styles.headerSub}>Planning your riff</Text>
        </View>
        <TouchableOpacity style={styles.cookBtn} onPress={startCooking}>
          <Text style={styles.cookBtnText}>Cook</Text>
          <Ionicons name="play" size={12} color={colors.white} />
        </TouchableOpacity>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Ingredients Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Ingredients</Text>
            <TouchableOpacity onPress={addIngredient} style={styles.addBtn}>
              <Ionicons name="add-circle" size={18} color={colors.sageDeep} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {activeIngs.map((ing, idx) => {
            const realIdx = ingredients.indexOf(ing);
            return (
              <RiffIngredientCard
                key={ing.key}
                ingredient={ing}
                originalQuantity={originalQtyMap.current.get(ing.key) || ''}
                isRemoved={false}
                onAdjustQuantity={(delta) => adjustQuantity(realIdx, delta)}
                onSetQuantity={(val) => setQuantity(realIdx, val)}
                onSwap={() => handleSwap(realIdx)}
                onRemove={() => removeIngredient(realIdx)}
                onUndo={() => undoChange(realIdx)}
              />
            );
          })}

          <TouchableOpacity style={styles.addIngBtn} onPress={addIngredient} activeOpacity={0.7}>
            <Ionicons name="add" size={18} color={colors.sageDeep} />
            <Text style={styles.addIngText}>Add ingredient</Text>
          </TouchableOpacity>

          {/* Removed section */}
          {removedIngs.length > 0 && (
            <>
              <View style={styles.removedDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.removedLabel}>Removed</Text>
                <View style={styles.dividerLine} />
              </View>
              {removedIngs.map(ing => (
                <RiffIngredientCard
                  key={ing.key}
                  ingredient={ing}
                  originalQuantity={originalQtyMap.current.get(ing.key) || ''}
                  isRemoved={true}
                  onAdjustQuantity={() => {}}
                  onSetQuantity={() => {}}
                  onSwap={() => {}}
                  onRemove={() => {}}
                  onUndo={() => undoRemove(ing.key)}
                />
              ))}
            </>
          )}

          {/* Directions Section */}
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <Text style={styles.sectionLabel}>Directions</Text>
            <TouchableOpacity onPress={() => addDirectionAt(directions.length)} style={styles.addBtn}>
              <Ionicons name="add-circle" size={18} color={colors.sageDeep} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {totalChanges > 0 && (
            <View style={styles.dirHint}>
              <Ionicons name="information-circle-outline" size={16} color={colors.amberDeep} />
              <Text style={styles.dirHintText}>
                Review directions to match your ingredient changes
              </Text>
            </View>
          )}

          {directions.map((dir, idx) => (
            <View key={dir.key}>
              {/* Insert-above tap target */}
              <TouchableOpacity
                style={styles.insertBtn}
                onPress={() => addDirectionAt(idx)}
                activeOpacity={0.6}
              >
                <View style={styles.insertLine} />
                <View style={styles.insertIcon}>
                  <Ionicons name="add" size={10} color={colors.sageDeep} />
                </View>
                <View style={styles.insertLine} />
              </TouchableOpacity>

              <View style={styles.dirRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{idx + 1}</Text>
                </View>
                <TextInput
                  style={styles.dirInput}
                  value={dir.text}
                  onChangeText={(text) => editDirection(idx, text)}
                  placeholder="Describe this step..."
                  placeholderTextColor={colors.barkLighter}
                  multiline
                />
                {directions.length > 1 && (
                  <TouchableOpacity
                    style={styles.dirRemoveBtn}
                    onPress={() => removeDirection(idx)}
                  >
                    <Ionicons name="close" size={14} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addDirBtn}
            onPress={() => addDirectionAt(directions.length)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={colors.sageDeep} />
            <Text style={styles.addDirText}>Add step</Text>
          </TouchableOpacity>

          {/* Spacer for bottom bar */}
          <View style={{ height: 140 }} />
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Changes strip */}
      {totalChanges > 0 && (
        <View style={styles.changesStrip}>
          {changes.swapped > 0 && (
            <>
              <View style={[styles.cdot, { backgroundColor: colors.amberDeep }]} />
              <Text style={styles.ccount}>{changes.swapped}</Text>
              <Text style={styles.clabel}>swapped</Text>
            </>
          )}
          {changes.qtyModified > 0 && (
            <>
              <View style={[styles.cdot, { backgroundColor: colors.amberDeep }]} />
              <Text style={styles.ccount}>{changes.qtyModified}</Text>
              <Text style={styles.clabel}>adjusted</Text>
            </>
          )}
          {changes.added > 0 && (
            <>
              <View style={[styles.cdot, { backgroundColor: colors.sageDeep }]} />
              <Text style={styles.ccount}>{changes.added}</Text>
              <Text style={styles.clabel}>added</Text>
            </>
          )}
          {changes.removed > 0 && (
            <>
              <View style={[styles.cdot, { backgroundColor: colors.danger }]} />
              <Text style={styles.ccount}>{changes.removed}</Text>
              <Text style={styles.clabel}>removed</Text>
            </>
          )}
        </View>
      )}

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.startCookBtn} onPress={startCooking} activeOpacity={0.8}>
          <Text style={styles.startCookText}>Start Cooking</Text>
        </TouchableOpacity>
      </View>

      {/* Substitution Sheet Modal */}
      <Modal visible={showSubSheet} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => { setShowSubSheet(false); setActiveIngIdx(null); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.subSheet}>
                <View style={styles.handle} />
                <Text style={styles.subTitle}>
                  Swap: {activeIng?.quantity} {activeIng?.isSubstitution ? activeIng?.originalIngredientName : activeIng?.name}
                </Text>
                <Text style={styles.subSubtitle}>in {recipe.title}</Text>

                <ScrollView style={styles.subScrollContent} showsVerticalScrollIndicator={false}>
                  {subsLoading ? (
                    <ActivityIndicator color={colors.amberDeep} style={{ marginTop: 20 }} />
                  ) : (
                    <>
                      {substitutions.length > 0 && (
                        <>
                          <Text style={styles.recLabel}>Suggested</Text>
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

                      {/* Custom section */}
                      <Text style={[styles.recLabel, { marginTop: substitutions.length > 0 ? 16 : 0 }]}>
                        Custom
                      </Text>
                      <View style={styles.customRow}>
                        <TextInput
                          style={styles.customInput}
                          value={customSubName}
                          onChangeText={setCustomSubName}
                          placeholder="Enter your own substitute..."
                          placeholderTextColor={colors.barkLighter}
                          returnKeyType="done"
                          onSubmitEditing={selectCustomSubstitution}
                        />
                        <TouchableOpacity
                          style={[
                            styles.customBtn,
                            !customSubName.trim() && styles.customBtnDisabled,
                          ]}
                          onPress={selectCustomSubstitution}
                          disabled={!customSubName.trim()}
                        >
                          <Text style={styles.customBtnText}>Use</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.subCancel}
                  onPress={() => { setShowSubSheet(false); setActiveIngIdx(null); }}
                >
                  <Text style={styles.subCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(45,41,38,0.06)',
  },
  backBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: 'DMSerifDisplay', fontSize: 18, color: colors.charcoal,
  },
  headerSub: { fontSize: 11, color: colors.barkLighter, marginTop: 1 },
  cookBtn: {
    backgroundColor: colors.sageDeep, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  cookBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  // Content
  scrollContent: { flex: 1 },
  scrollInner: { paddingHorizontal: spacing.xl, paddingTop: 16 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: colors.barkLight,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, color: colors.sageDeep, fontWeight: '500' },

  addIngBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 14, borderWidth: 2, borderStyle: 'dashed',
    borderColor: 'rgba(94,140,74,0.2)', borderRadius: 14,
    marginTop: 4,
  },
  addIngText: { fontSize: 14, fontWeight: '500', color: colors.sageDeep },

  // Removed divider
  removedDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(45,41,38,0.06)' },
  removedLabel: { fontSize: 11, color: colors.barkLighter },

  // Directions
  dirHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(217,119,6,0.06)', borderRadius: 10,
    padding: 10, marginBottom: 12,
  },
  dirHintText: { fontSize: 12, color: colors.amberDeep, flex: 1 },
  dirRow: {
    flexDirection: 'row', gap: 10, marginBottom: 4, alignItems: 'flex-start',
  },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center', justifyContent: 'center', marginTop: 10,
  },
  stepNum: { fontSize: 12, fontWeight: '600', color: colors.amberDeep },
  dirInput: {
    flex: 1, fontSize: 14, color: colors.charcoal, lineHeight: 22,
    backgroundColor: colors.white, borderRadius: 10,
    padding: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(45,41,38,0.06)',
    minHeight: 44, textAlignVertical: 'top',
  },
  dirRemoveBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(45,41,38,0.04)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  insertBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, marginLeft: 34,
  },
  insertLine: {
    flex: 1, height: 1, backgroundColor: 'rgba(94,140,74,0.15)',
  },
  insertIcon: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(94,140,74,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  addDirBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 14, borderWidth: 2, borderStyle: 'dashed',
    borderColor: 'rgba(94,140,74,0.2)', borderRadius: 14,
    marginTop: 4,
  },
  addDirText: { fontSize: 14, fontWeight: '500', color: colors.sageDeep },

  // Changes strip
  changesStrip: {
    position: 'absolute', bottom: 76, left: 16, right: 16,
    backgroundColor: colors.white, borderRadius: 12,
    padding: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 4,
  },
  cdot: { width: 7, height: 7, borderRadius: 4 },
  ccount: { fontWeight: '700', color: colors.charcoal, fontSize: 11 },
  clabel: { color: colors.barkLight, fontSize: 11, marginRight: 4 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: spacing.xl, paddingBottom: 34, paddingTop: 12,
    backgroundColor: colors.cream,
    borderTopWidth: 1, borderTopColor: 'rgba(45,41,38,0.06)',
  },
  cancelBtn: {
    borderRadius: 14, padding: 14, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: 'rgba(45,41,38,0.12)',
  },
  cancelText: { fontSize: 14, color: colors.barkLight, fontWeight: '500' },
  startCookBtn: {
    flex: 1, backgroundColor: colors.sageDeep, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  startCookText: { fontSize: 15, fontWeight: '600', color: colors.white },

  // Substitution modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  subSheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingTop: 12, maxHeight: '80%',
  },
  subScrollContent: { flexGrow: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.barkLighter, alignSelf: 'center', marginBottom: 16 },
  subTitle: { fontFamily: 'DMSerifDisplay', fontSize: 18, color: colors.charcoal, textAlign: 'center' },
  subSubtitle: { fontSize: 13, color: colors.barkLight, textAlign: 'center', marginBottom: 16 },
  recLabel: {
    fontSize: 12, fontWeight: '600', color: colors.amberDeep,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
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
  customRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8,
  },
  customInput: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: 12,
    fontSize: 14, color: colors.charcoal, borderWidth: 1.5, borderColor: colors.border,
  },
  customBtn: {
    backgroundColor: colors.amberDeep, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  customBtnDisabled: { opacity: 0.4 },
  customBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  subCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  subCancelText: { fontSize: 14, color: colors.barkLight },
});
