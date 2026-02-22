import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../../theme';
import type { RecipesStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RecipesStackParamList, 'CookScreen'>;

export default function CookScreen({ navigation, route }: Props) {
  const { recipe, ingredients, directions } = route.params;
  const [checkedIngs, setCheckedIngs] = useState<Set<string>>(new Set());
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  function toggleIng(key: string) {
    setCheckedIngs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleStep(idx: number) {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const totalItems = ingredients.length + directions.length;
  const checkedTotal = checkedIngs.size + checkedSteps.size;
  const progress = totalItems > 0 ? checkedTotal / totalItems : 0;

  // Find current active step (first unchecked)
  const currentStep = directions.findIndex((_, i) => !checkedSteps.has(i));

  function goToRiff() {
    navigation.goBack();
  }

  function handleFinish() {
    navigation.navigate('SaveRiff', { recipe, ingredients, directions });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Dark header */}
      <View style={styles.darkHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.6)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.modeLabel}>Cooking</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
        </View>
        <TouchableOpacity style={styles.riffBtn} onPress={goToRiff}>
          <Ionicons name="pencil" size={12} color={colors.amberDeep} />
          <Text style={styles.riffBtnText}>Riff</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {currentStep >= 0 ? `Step ${currentStep + 1} of ${directions.length}` : 'Done!'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Ingredients checklist */}
        <Text style={styles.sectionLabel}>Ingredients</Text>
        {ingredients.map(ing => {
          const checked = checkedIngs.has(ing.key);
          return (
            <TouchableOpacity
              key={ing.key}
              style={styles.checkRow}
              onPress={() => toggleIng(ing.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
              <View style={styles.checkContent}>
                <Text style={[styles.checkText, checked && styles.checkTextDone]}>
                  <Text style={styles.checkQty}>{ing.quantity} </Text>
                  {ing.name}
                </Text>
                {ing.isSubstitution && ing.originalIngredientName && (
                  <Text style={styles.swapNote}>
                    Swapped from {ing.originalIngredientName}
                  </Text>
                )}
                {ing.key.startsWith('added-') && (
                  <Text style={styles.addedNote}>Added in your riff</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Directions */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionLabel}>Directions</Text>
          {directions.map((dir, idx) => {
            const isDone = checkedSteps.has(idx);
            const isActive = idx === currentStep;
            return (
              <TouchableOpacity
                key={dir.key}
                style={styles.stepRow}
                onPress={() => toggleStep(idx)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.stepNum,
                  isDone && styles.stepNumDone,
                  isActive && styles.stepNumActive,
                ]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={13} color={colors.white} />
                  ) : (
                    <Text style={[
                      styles.stepNumText,
                      isActive && styles.stepNumTextActive,
                    ]}>{idx + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepText,
                  isDone && styles.stepTextDone,
                ]}>
                  {dir.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cookedBtn} onPress={handleFinish} activeOpacity={0.8}>
          <Text style={styles.cookedBtnText}>I Cooked This!</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  // Dark header
  darkHeader: {
    backgroundColor: colors.charcoal,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: 14,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  headerCenter: { flex: 1, alignItems: 'center' },
  modeLabel: {
    fontSize: 10, fontWeight: '600', color: colors.amberDeep,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: 'DMSerifDisplay', fontSize: 20, color: colors.white, marginTop: 2,
  },
  riffBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(217,119,6,0.15)', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  riffBtnText: { fontSize: 12, fontWeight: '600', color: colors.amberDeep },

  // Progress bar
  progressBar: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: spacing.xl, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  progressTrack: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.amberDeep, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  // Content
  content: { flex: 1 },
  contentInner: { paddingHorizontal: spacing.xl, paddingTop: 20 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.barkLight,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },

  // Ingredient checklist
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: 'rgba(45,41,38,0.04)',
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(45,41,38,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.sageDeep, borderColor: colors.sageDeep,
  },
  checkContent: { flex: 1 },
  checkText: { fontSize: 14, color: colors.charcoal },
  checkTextDone: {
    textDecorationLine: 'line-through', color: colors.barkLighter,
  },
  checkQty: { fontWeight: '600', color: colors.sageDeep },
  swapNote: { fontSize: 10, color: colors.amberDeep, marginTop: 2 },
  addedNote: { fontSize: 10, color: colors.sageDeep, marginTop: 2 },

  // Steps
  stepsSection: { marginTop: 28 },
  stepRow: {
    flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start',
  },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(45,41,38,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumActive: { backgroundColor: colors.amberDeep },
  stepNumDone: { backgroundColor: colors.sageDeep },
  stepNumText: { fontSize: 13, fontWeight: '600', color: colors.barkLighter },
  stepNumTextActive: { color: colors.white },
  stepText: { flex: 1, fontSize: 14, color: colors.charcoal, lineHeight: 22 },
  stepTextDone: { color: colors.barkLighter },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.xl, paddingBottom: 34, paddingTop: 12,
    backgroundColor: colors.cream,
    borderTopWidth: 1, borderTopColor: 'rgba(45,41,38,0.06)',
  },
  cookedBtn: {
    backgroundColor: colors.amberDeep, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  cookedBtnText: { fontSize: 16, fontWeight: '600', color: colors.white },
});
