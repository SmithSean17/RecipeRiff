import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import type { RiffIngredientCardProps } from '../types';

export default function RiffIngredientCard({
  ingredient, originalQuantity, isRemoved,
  onAdjustQuantity, onSetQuantity, onSwap, onRemove, onUndo,
}: RiffIngredientCardProps) {
  const [showStepper, setShowStepper] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Quantity is "modified" if it differs from the original and the card isn't swapped/added
  const isQtyModified = !ingredient.isSubstitution
    && !ingredient.key.startsWith('added-')
    && ingredient.quantity !== originalQuantity;

  function closeStepper() {
    setShowStepper(false);
    inputRef.current?.blur();
  }

  if (isRemoved) {
    return (
      <View style={[styles.card, styles.removedCard]}>
        <View style={styles.cardTop}>
          <View style={styles.cardMain}>
            <Text style={[styles.qty, styles.removedText]}>{ingredient.quantity}</Text>
            <Text style={[styles.name, styles.removedText]}>{ingredient.name}</Text>
          </View>
          <TouchableOpacity style={[styles.actionBtn, styles.undoBtn]} onPress={onUndo}>
            <Ionicons name="arrow-undo" size={14} color={colors.amberDeep} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isSwapped = ingredient.isSubstitution;
  const isAdded = ingredient.key.startsWith('added-');
  // Use amber styling when swapped OR qty modified
  const useAmber = isSwapped || isQtyModified;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => { if (showStepper) closeStepper(); }}
      style={[
        styles.card,
        isSwapped && styles.swappedCard,
        isAdded && styles.addedCard,
        isQtyModified && !isSwapped && !isAdded && styles.qtyModifiedCard,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          {showStepper ? (
            <View style={[styles.stepper, useAmber && styles.amberStepper]}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => onAdjustQuantity(-1)}
              >
                <Ionicons name="remove" size={14} color={useAmber ? colors.amberDeep : colors.sageDeep} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={[styles.stepValue, useAmber && { color: colors.amberDeep }]}
                value={ingredient.quantity}
                onChangeText={onSetQuantity}
                onBlur={closeStepper}
                selectTextOnFocus
                autoFocus
                returnKeyType="done"
                onSubmitEditing={closeStepper}
              />
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => onAdjustQuantity(1)}
              >
                <Ionicons name="add" size={14} color={useAmber ? colors.amberDeep : colors.sageDeep} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.tappableQty,
                useAmber && styles.amberQty,
              ]}
              onPress={() => setShowStepper(true)}
            >
              <Text style={[
                styles.qty,
                useAmber && { color: colors.amberDeep },
              ]}>
                {ingredient.quantity || '\u2014'}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.name}>{ingredient.name}</Text>
        </View>
        <View style={styles.actions}>
          {!isAdded && (
            <TouchableOpacity style={[styles.actionBtn, styles.swapBtn]} onPress={onSwap}>
              <Ionicons name="swap-horizontal" size={14} color={colors.sageDeep} />
            </TouchableOpacity>
          )}
          {(isSwapped || isQtyModified) && !isAdded ? (
            <TouchableOpacity style={[styles.actionBtn, styles.undoBtn]} onPress={onUndo}>
              <Ionicons name="arrow-undo" size={14} color={colors.amberDeep} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={onRemove}>
              <Ionicons name="close" size={14} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {isSwapped && ingredient.originalIngredientName && (
        <View style={styles.swapInfo}>
          <Text style={styles.swapOriginal}>{ingredient.originalIngredientName}</Text>
          <Ionicons name="arrow-forward" size={11} color={colors.amberDeep} />
          <Text style={styles.swapNew}>{ingredient.name}</Text>
        </View>
      )}
      {isQtyModified && !isSwapped && (
        <View style={styles.swapInfo}>
          <Text style={styles.swapOriginal}>{originalQuantity}</Text>
          <Ionicons name="arrow-forward" size={11} color={colors.amberDeep} />
          <Text style={styles.swapNew}>{ingredient.quantity}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(45,41,38,0.05)',
  },
  swappedCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.amberDeep,
    backgroundColor: 'rgba(217,119,6,0.03)',
  },
  qtyModifiedCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.amberDeep,
    backgroundColor: 'rgba(217,119,6,0.03)',
  },
  addedCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.sageDeep,
    backgroundColor: 'rgba(94,140,74,0.03)',
  },
  removedCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    opacity: 0.4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tappableQty: {
    backgroundColor: 'rgba(94,140,74,0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(94,140,74,0.3)',
  },
  amberQty: {
    backgroundColor: 'rgba(217,119,6,0.08)',
    borderColor: 'rgba(217,119,6,0.3)',
  },
  qty: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.sageDeep,
  },
  name: {
    fontSize: 15,
    color: colors.charcoal,
    flexShrink: 1,
  },
  removedText: {
    textDecorationLine: 'line-through',
    color: colors.barkLighter,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(45,41,38,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapBtn: {
    backgroundColor: 'rgba(94,140,74,0.08)',
  },
  undoBtn: {
    backgroundColor: 'rgba(217,119,6,0.08)',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(94,140,74,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  amberStepper: {
    backgroundColor: 'rgba(217,119,6,0.08)',
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.sageDeep,
    paddingHorizontal: 6,
    minWidth: 44,
    textAlign: 'center',
  },
  swapInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  swapOriginal: {
    fontSize: 11,
    color: colors.barkLighter,
    textDecorationLine: 'line-through',
  },
  swapNew: {
    fontSize: 11,
    color: colors.amberDeep,
  },
});
