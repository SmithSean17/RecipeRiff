import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import StarRating from '../../components/StarRating';
import { useVariations } from '../../hooks/useVariations';
import { colors, spacing, radius } from '../../theme';
import type { RecipesStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RecipesStackParamList, 'SaveRiff'>;

export default function SaveRiffScreen({ navigation, route }: Props) {
  const { recipe, ingredients, directions } = route.params;
  const { finishCooking } = useVariations();

  const [label, setLabel] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Compute changes summary
  const changes: Array<{ type: 'swap' | 'add' | 'remove'; text: string }> = [];
  for (const ing of ingredients) {
    if (ing.isSubstitution && ing.originalIngredientName) {
      changes.push({
        type: 'swap',
        text: `Swapped ${ing.originalIngredientName} \u2192 ${ing.name}`,
      });
    }
    if (ing.key.startsWith('added-')) {
      changes.push({
        type: 'add',
        text: `Added ${ing.quantity} ${ing.name}`,
      });
    }
  }

  async function handleSave(): Promise<void> {
    if (!label.trim()) {
      Alert.alert('Name required', 'Give your riff a name (e.g., "Chocolate banana version")');
      return;
    }

    setSaving(true);
    try {
      await finishCooking({
        recipeId: recipe.id,
        label: label.trim(),
        variationNotes: notes.trim() || null,
        ingredients: ingredients.map(i => ({
          quantity: i.quantity.trim() || null,
          name: i.name.trim(),
          isSubstitution: i.isSubstitution,
          originalIngredientName: i.originalIngredientName,
        })),
        directions: directions
          .filter(d => d.text.trim())
          .map((d, idx) => ({
            stepNumber: idx + 1,
            text: d.text.trim(),
          })),
        rating: rating || null,
        cookLogNotes: notes.trim() || null,
      });

      Alert.alert('Riff saved!', 'Your cook and riff have been saved.', [
        {
          text: 'OK',
          onPress: () => {
            // Pop back to recipe detail
            navigation.popToTop();
          },
        },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip(): void {
    Alert.alert(
      "Don't save riff?",
      'Your ingredient changes will be lost.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: "Don't Save",
          style: 'destructive',
          onPress: () => navigation.popToTop(),
        },
      ]
    );
  }

  const dotColor = (type: 'swap' | 'add' | 'remove') => {
    if (type === 'swap') return colors.amberDeep;
    if (type === 'add') return colors.sageDeep;
    return colors.danger;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Dark header */}
      <View style={styles.darkHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.6)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.modeLabel}>Save your riff</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Celebrate area */}
      <View style={styles.celebrate}>
        <Text style={styles.celebrateEmoji}>🍞</Text>
        <Text style={styles.celebrateTitle}>Nice riff!</Text>
        <Text style={styles.celebrateSub}>Save this version for next time</Text>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.formInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Rating */}
          <Text style={styles.formLabel}>How was it?</Text>
          <View style={styles.ratingWrap}>
            <StarRating value={rating} onChange={setRating} size={32} />
          </View>

          {/* Name */}
          <Text style={styles.formLabel}>Name this riff</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder='e.g., "Choco coconut version"'
            placeholderTextColor={colors.barkLighter}
          />

          {/* Notes */}
          <Text style={styles.formLabel}>Tips & notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="What worked? What would you change next time?"
            placeholderTextColor={colors.barkLighter}
            multiline
          />

          {/* Changes summary */}
          {changes.length > 0 && (
            <View style={styles.changesSummary}>
              <Text style={styles.changesSummaryTitle}>Your changes</Text>
              {changes.map((c, i) => (
                <View key={i} style={styles.changeItem}>
                  <View style={[styles.changeDot, { backgroundColor: dotColor(c.type) }]} />
                  <Text style={styles.changeText}>{c.text}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Bottom buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Riff</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip — don't save</Text>
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
    paddingHorizontal: spacing.xl, paddingVertical: 10,
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

  // Celebrate
  celebrate: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: spacing.xl, paddingTop: 20, paddingBottom: 28,
    alignItems: 'center',
  },
  celebrateEmoji: { fontSize: 48, marginBottom: 8 },
  celebrateTitle: {
    fontFamily: 'DMSerifDisplay', fontSize: 24, color: colors.white,
  },
  celebrateSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  // Form
  formScroll: {
    flex: 1, backgroundColor: colors.cream,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -16,
  },
  formInner: { padding: 24, paddingTop: 28 },
  formLabel: {
    fontSize: 11, fontWeight: '600', color: colors.barkLight,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  ratingWrap: { alignItems: 'center', marginBottom: 24 },
  input: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, paddingHorizontal: 16,
    fontSize: 15, color: colors.charcoal,
    borderWidth: 1.5, borderColor: 'rgba(45,41,38,0.08)',
    marginBottom: 20,
  },
  notesInput: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, paddingHorizontal: 16,
    fontSize: 14, color: colors.charcoal,
    borderWidth: 1.5, borderColor: 'rgba(45,41,38,0.08)',
    minHeight: 80, textAlignVertical: 'top',
    marginBottom: 20,
  },

  // Changes summary
  changesSummary: {
    backgroundColor: 'rgba(45,41,38,0.03)', borderRadius: 12,
    padding: 14, paddingHorizontal: 16,
  },
  changesSummaryTitle: {
    fontSize: 11, fontWeight: '600', color: colors.barkLight,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  changeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  changeDot: { width: 6, height: 6, borderRadius: 3 },
  changeText: { fontSize: 13, color: colors.charcoal },

  // Bottom
  bottomBar: {
    paddingHorizontal: 24, paddingBottom: 34, paddingTop: 12,
    backgroundColor: colors.cream,
    borderTopWidth: 1, borderTopColor: 'rgba(45,41,38,0.06)',
  },
  saveBtn: {
    backgroundColor: colors.amberDeep, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: colors.white },
  skipBtn: { alignItems: 'center', padding: 12, marginTop: 4 },
  skipText: { fontSize: 14, color: colors.barkLight },
});
