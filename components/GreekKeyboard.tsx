import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface GreekKeyboardProps {
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onClear?: () => void;
}

const { width } = Dimensions.get('window');
const KEY_SPACING = 4;
const KEYBOARD_PADDING = 8;
const MAX_KEYBOARD_WIDTH = 500;
const actualWidth = Math.min(width, MAX_KEYBOARD_WIDTH);

export const GreekKeyboard: React.FC<GreekKeyboardProps> = ({
  onKeyPress,
  onBackspace,
  onClear,
}) => {
  const row1 = ['Ε', 'Ρ', 'Τ', 'Υ', 'Θ', 'Ι', 'Ο', 'Π'];
  const row2 = ['Α', 'Σ', 'Δ', 'Φ', 'Γ', 'Η', 'Ξ', 'Κ', 'Λ'];
  const row3 = ['Ζ', 'Χ', 'Ψ', 'Ω', 'Β', 'Ν', 'Μ'];

  const handlePress = (char: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onKeyPress(char);
  };

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onBackspace();
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (onClear) onClear();
  };

  const renderKey = (char: string, index: number, totalKeysInRow: number) => {
    const keyWidth = (actualWidth - (KEYBOARD_PADDING * 2) - (KEY_SPACING * (totalKeysInRow - 1))) / totalKeysInRow;
    return (
      <Pressable
        key={`${char}-${index}`}
        onPress={() => handlePress(char)}
        style={({ pressed }) => [
          styles.key,
          { width: keyWidth },
          pressed && styles.keyPressed,
        ]}
      >
        <Text style={styles.keyText}>{char}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.keyboardContainer}>
      {/* Row 1 */}
      <View style={styles.row}>
        {row1.map((char, index) => renderKey(char, index, row1.length))}
      </View>

      {/* Row 2 */}
      <View style={styles.row}>
        {row2.map((char, index) => renderKey(char, index, row2.length))}
      </View>

      {/* Row 3 with Backspace and optional Clear */}
      <View style={styles.row}>
        {onClear && (
          <Pressable
            testID="keyboard-clear-btn"
            onPress={handleClear}
            style={({ pressed }) => [
              styles.actionKey,
              pressed && styles.keyPressed,
              { flex: 1.5, marginRight: KEY_SPACING },
            ]}
          >
            <Text style={styles.actionKeyText}>CLEAR</Text>
          </Pressable>
        )}
        
        {row3.map((char, index) => renderKey(char, index, row3.length + (onClear ? 2 : 1.5)))}

        <Pressable
          testID="keyboard-backspace-btn"
          onPress={handleBackspace}
          style={({ pressed }) => [
            styles.actionKey,
            pressed && styles.keyPressed,
            { flex: onClear ? 1.5 : 1.8, marginLeft: KEY_SPACING },
          ]}
        >
          <Ionicons name="backspace-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    width: '100%',
    maxWidth: MAX_KEYBOARD_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: KEYBOARD_PADDING,
    paddingBottom: 24,
    backgroundColor: '#0B0E17',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  key: {
    height: 48,
    backgroundColor: '#111422',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  keyPressed: {
    backgroundColor: '#1E233C',
    transform: [{ scale: 0.95 }],
  },
  keyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  actionKey: {
    height: 48,
    backgroundColor: '#111422',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  actionKeyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
