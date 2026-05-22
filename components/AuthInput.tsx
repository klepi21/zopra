import React, { useState } from 'react';
import { View, TextInput, TextInputProps, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface AuthInputProps extends TextInputProps {
  icon: keyof typeof Feather.glyphMap;
  isPassword?: boolean;
}

export default function AuthInput({ icon, isPassword, style, ...props }: AuthInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(isPassword);

  return (
    <View style={[styles.container, isFocused && styles.focusedContainer, style]}>
      <Feather name={icon} size={20} color={isFocused ? '#00C2A8' : '#6b7280'} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholderTextColor="#6b7280"
        secureTextEntry={isSecure}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {isPassword && (
        <TouchableOpacity onPress={() => setIsSecure(!isSecure)} style={styles.eyeIcon}>
          <Feather name={isSecure ? 'eye' : 'eye-off'} size={20} color="#6b7280" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1322',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  focusedContainer: {
    borderColor: '#00C2A8',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
});
