import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PasswordStrengthProps {
  password?: string;
}

export default function PasswordStrength({ password = '' }: PasswordStrengthProps) {
  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z\d]/.test(password);

  const passedChecks = [hasLength, hasLetter, hasNumber, hasSpecial].filter(Boolean).length;
  
  // Calculate strength text and color
  let strengthText = 'Αδύναμος';
  let strengthColor = '#ef4444'; // red

  if (passedChecks === 0) {
    strengthText = 'Πολύ Αδύναμος';
    strengthColor = '#6b7280';
  } else if (passedChecks === 1) {
    strengthText = 'Αδύναμος';
    strengthColor = '#ef4444';
  } else if (passedChecks === 2 || passedChecks === 3) {
    strengthText = 'Μέτριος';
    strengthColor = '#eab308'; // yellow
  } else if (passedChecks === 4) {
    strengthText = 'Ισχυρός';
    strengthColor = '#00C2A8'; // teal
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Ισχύς κωδικού: </Text>
        <Text style={[styles.headerValue, { color: strengthColor }]}>{strengthText}</Text>
      </View>
      
      <View style={styles.barsContainer}>
        {[1, 2, 3, 4].map((index) => {
          let backgroundColor = '#1f2937';
          if (index <= passedChecks) {
            backgroundColor = passedChecks === 1 ? '#ef4444' : 
                              passedChecks <= 3 ? '#eab308' : '#00C2A8';
          }
          return <View key={index} style={[styles.bar, { backgroundColor }]} />;
        })}
      </View>

      <View style={styles.checklist}>
        <ChecklistItem text="Τουλάχιστον 8 χαρακτήρες" isChecked={hasLength} />
        <ChecklistItem text="Ένα γράμμα" isChecked={hasLetter} />
        <ChecklistItem text="Ένας αριθμός" isChecked={hasNumber} />
      </View>
    </View>
  );
}

function ChecklistItem({ text, isChecked }: { text: string; isChecked: boolean }) {
  return (
    <View style={styles.checkItem}>
      <Feather name="check" size={16} color={isChecked ? '#00C2A8' : '#374151'} />
      <Text style={[styles.checkText, isChecked && styles.checkTextActive]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  headerLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  headerValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  barsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1f2937',
  },
  checklist: {
    gap: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    color: '#6b7280',
    fontSize: 12,
  },
  checkTextActive: {
    color: '#9ca3af',
  },
});
