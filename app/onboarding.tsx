import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Zap, Brain, Shield, Wind, Flame, Swords, User, LogOut, CheckCircle } from '@/components/AppIcon';

const PRESET_AVATARS = [
  { id: 'zeus', name: 'Δίας', emoji: '⚡', gradient: ['#FF4D4D', '#0F3460'] },
  { id: 'athena', name: 'Αθηνά', emoji: '🦉', gradient: ['#00C2A8', '#0F3460'] },
  { id: 'achilles', name: 'Αχιλλέας', emoji: '🛡️', gradient: ['#FF595E', '#0F3460'] },
  { id: 'pegasus', name: 'Πήγασος', emoji: '🦄', gradient: ['#6BCB77', '#0F3460'] },
  { id: 'medusa', name: 'Μέδουσα', emoji: '🐍', gradient: ['#FFB347', '#0F3460'] },
  { id: 'minotaur', name: 'Μινώταυρος', emoji: '🐂', gradient: ['#A0AEC0', '#0F3460'] },
];

export default function OnboardingScreen() {
  const { getToken, signOut } = useAuth();
  const { onboardUser, isLoading, error: storeError } = useUserStore();
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [error, setError] = useState<string | null>(null);

  const handleOnboard = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Παρακαλώ επιλέξτε ένα όνομα χρήστη');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('Το όνομα χρήστη πρέπει να είναι τουλάχιστον 3 χαρακτήρες');
      return;
    }

    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setError('Η συνεδρία έληξε. Παρακαλώ συνδεθείτε ξανά.');
        return;
      }

      const avatarUrl = JSON.stringify({
        id: selectedAvatar.id,
        emoji: selectedAvatar.emoji,
        colors: selectedAvatar.gradient,
      });

      await onboardUser(trimmedUsername, avatarUrl, token);
    } catch (err: any) {
      setError(err.message || 'Αποτυχία ολοκλήρωσης εγγραφής');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.innerContainer}>
          <Text style={styles.title}>Δημιουργία Προφίλ</Text>
          <Text style={styles.subtitle}>Επιλέξτε τον χαρακτήρα και το όνομά σας</Text>

          {(error || storeError) && (
            <Text style={styles.errorText}>{error || storeError}</Text>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Όνομα Χρήστη</Text>
            <TextInput
              style={styles.input}
              placeholder="π.χ. Achilles"
              placeholderTextColor="#A0AEC0"
              maxLength={15}
              autoCorrect={false}
              autoCapitalize="none"
              value={username}
              onChangeText={(val) => setUsername(val.replace(/[^a-zA-Z0-9_]/g, ''))}
            />
            <Text style={styles.inputHint}>Μόνο γράμματα, αριθμοί και κάτω παύλες</Text>
          </View>

          <Text style={styles.label}>Επιλογή Χαρακτήρα</Text>
          <View style={styles.avatarGridContainer}>
            <FlatList
              data={PRESET_AVATARS}
              numColumns={3}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              columnWrapperStyle={styles.row}
              renderItem={({ item }) => {
                const isSelected = selectedAvatar.id === item.id;
                let IconComponent = User;
                switch (item.id) {
                  case 'zeus': IconComponent = Zap; break;
                  case 'athena': IconComponent = Brain; break;
                  case 'achilles': IconComponent = Shield; break;
                  case 'pegasus': IconComponent = Wind; break;
                  case 'medusa': IconComponent = Flame; break;
                  case 'minotaur': IconComponent = Swords; break;
                }

                return (
                  <TouchableOpacity
                    style={[
                      styles.avatarWrapper,
                      isSelected && styles.avatarWrapperSelected,
                    ]}
                    onPress={() => setSelectedAvatar(item)}
                  >
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: isSelected ? '#00C2A8' : item.gradient[0] },
                      ]}
                    >
                      <IconComponent size={28} color="#FFFFFF" />
                    </View>
                    <Text style={styles.avatarName}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleOnboard}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Είσοδος στην Αρένα</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => signOut()}
            disabled={isLoading}
          >
            <View style={styles.signOutContent}>
              <LogOut size={16} color="#A0AEC0" style={{ marginRight: 6 }} />
              <Text style={styles.signOutButtonText}>Αποσύνδεση</Text>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF4D4D',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0AEC0',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF595E',
    backgroundColor: 'rgba(255, 89, 94, 0.1)',
    padding: 12,
    borderRadius: 16,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#FF595E',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 10,
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  input: {
    backgroundColor: '#16213E',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#0F3460',
  },
  inputHint: {
    color: '#A0AEC0',
    fontSize: 12,
    marginTop: 6,
    paddingLeft: 4,
  },
  avatarGridContainer: {
    marginBottom: 32,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#16213E',
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: '#0F3460',
  },
  avatarWrapperSelected: {
    borderColor: '#00C2A8',
    backgroundColor: '#16213E',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#FF4D4D',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  signOutButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  signOutContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '600',
  },
});
