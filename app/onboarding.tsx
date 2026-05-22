import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AuthInput from '../components/AuthInput';

const PRESET_AVATARS = [
  { id: '1', name: 'Boy1', emoji: '🧑', gradient: ['#1e3a8a', '#0f172a'] },
  { id: '2', name: 'Girl1', emoji: '👩', gradient: ['#831843', '#0f172a'] },
  { id: '3', name: 'Boy2', emoji: '👦', gradient: ['#14532d', '#0f172a'] },
  { id: '4', name: 'Girl2', emoji: '👱‍♀️', gradient: ['#7c2d12', '#0f172a'] },
  { id: '5', name: 'Girl3', emoji: '👧', gradient: ['#0f766e', '#0f172a'] },
  { id: '6', name: 'Boy3', emoji: '👨', gradient: ['#4c1d95', '#0f172a'] },
];

export default function OnboardingScreen() {
  const { getToken, signOut } = useAuth();
  const { onboardUser, isLoading, error: storeError } = useUserStore();
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[4]); // Default to the 5th one to match screenshot
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
          
          <View style={styles.headerContainer}>
            <Text style={styles.logoTop}>Z O P R A</Text>
            <Text style={styles.tagline}>♦ ΤΟ ΕΛΛΗΝΙΚΟ ΠΑΙΧΝΙΔΙ ΛΕΞΕΩΝ ♦</Text>
          </View>

          {/* Progress Tracker */}
          <View style={styles.progressTracker}>
            <View style={styles.progressCircleCompleted}>
              <Feather name="check" size={14} color="#0B0F19" />
            </View>
            <View style={styles.progressLineCompleted} />
            <View style={styles.progressCircleCompleted}>
              <Feather name="check" size={14} color="#0B0F19" />
            </View>
            <View style={styles.progressLinePending} />
            <View style={styles.progressCircleCurrent}>
              <Text style={styles.progressCircleText}>3</Text>
            </View>
          </View>

          <Text style={styles.title}>Πώς σε λένε;</Text>
          <Text style={styles.subtitle}>Διάλεξε ένα avatar και γράψε το όνομά σου για να ξεκινήσουμε!</Text>

          {(error || storeError) && (
            <Text style={styles.errorText}>{error || storeError}</Text>
          )}

          <View style={styles.avatarGridContainer}>
            <FlatList
              data={PRESET_AVATARS}
              numColumns={3}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              columnWrapperStyle={styles.row}
              renderItem={({ item }) => {
                const isSelected = selectedAvatar.id === item.id;
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
                        { backgroundColor: item.gradient[0] },
                      ]}
                    >
                      <Text style={{fontSize: 40}}>{item.emoji}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.checkmarkBadge}>
                        <Feather name="check" size={12} color="#0B0F19" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <AuthInput
              icon="user"
              placeholder="Όνομα χρήστη"
              maxLength={15}
              autoCorrect={false}
              autoCapitalize="none"
              value={username}
              onChangeText={(val) => setUsername(val.replace(/[^a-zA-Z0-9_]/g, ''))}
            />
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Feather name="shield" size={20} color="#0B0F19" />
              </View>
              <Text style={styles.featureTitle}>Ασφαλές</Text>
              <Text style={styles.featureDesc}>και διασκεδαστικό</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Feather name="users" size={20} color="#0B0F19" />
              </View>
              <Text style={styles.featureTitle}>Παίξε με φίλους</Text>
              <Text style={styles.featureDesc}>και χιλιάδες παίκτες</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Feather name="award" size={20} color="#0B0F19" />
              </View>
              <Text style={styles.featureTitle}>Κέρδισε πόντους</Text>
              <Text style={styles.featureDesc}>και ανέβα επίπεδο</Text>
            </View>
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
                <View style={styles.buttonIconCircle}>
                  <Feather name="check" size={16} color="#FF3B5C" />
                </View>
                <Text style={styles.buttonText}>Είμαι Έτοιμος!</Text>
              </View>
            )}
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoTop: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FF4D4D',
    marginBottom: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 77, 77, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 10,
    color: '#00C2A8',
    fontWeight: '600',
    letterSpacing: 2,
  },
  
  // Progress Tracker
  progressTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressCircleCompleted: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00C2A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleCurrent: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressLineCompleted: {
    width: 40,
    height: 2,
    backgroundColor: '#00C2A8',
    marginHorizontal: 4,
  },
  progressLinePending: {
    width: 40,
    height: 2,
    backgroundColor: '#374151',
    marginHorizontal: 4,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  errorText: {
    color: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 16,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  avatarGridContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  row: {
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16213E',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarWrapperSelected: {
    borderColor: '#00C2A8',
    shadowColor: '#00C2A8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#00C2A8',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0F19',
  },
  inputContainer: {
    marginBottom: 32,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00C2A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  featureDesc: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF3B5C',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 24,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIconCircle: {
    backgroundColor: '#FFFFFF',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
