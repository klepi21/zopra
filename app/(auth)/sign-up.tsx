import React, { useState } from 'react';
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import AuthInput from '../../components/AuthInput';
import PasswordStrength from '../../components/PasswordStrength';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: 'oauth_apple' });

  const handleOAuth = async (strategy: 'google' | 'apple') => {
    setIsLoading(true);
    setError(null);
    try {
      const flow = strategy === 'google' ? startGoogleFlow : startAppleFlow;
      const { createdSessionId, setActive: setOAuthActive } = await flow();

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
      }
    } catch (err: any) {
      console.error(`${strategy} OAuth error:`, err);
      setError(err.errors?.[0]?.message || `Αποτυχία σύνδεσης μέσω ${strategy === 'google' ? 'Google' : 'Apple'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    Keyboard.dismiss();
    if (!isLoaded || !signUp || !setActive) return;
    if (!email || !password) {
      setError('Παρακαλώ συμπληρώστε όλα τα πεδία');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signUp.create({
        username,
        emailAddress: email,
        password,
      });

      // Prepare email address verification
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Η εγγραφή απέτυχε');
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    Keyboard.dismiss();
    if (!isLoaded || !signUp || !setActive) return;
    if (!code) {
      setError('Παρακαλώ εισάγετε τον κωδικό επαλήθευσης');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        console.warn('Verification incomplete status:', result.status, 'Missing fields:', result.missingFields, 'Unverified fields:', result.unverifiedFields);
        const missing = result.missingFields && result.missingFields.length > 0
          ? ` (Missing: ${result.missingFields.join(', ')})`
          : '';
        setError(`Η επαλήθευση απέτυχε. Κατάσταση: ${result.status}${missing}.`);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Μη έγκυρος κωδικός επαλήθευσης');
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.innerContainer}>
          {!pendingVerification ? (
            <>
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Z O P R A</Text>
                <Text style={styles.tagline}>♦ ΤΟ ΕΛΛΗΝΙΚΟ ΠΑΙΧΝΙΔΙ ΛΕΞΕΩΝ ♦</Text>
              </View>

              <Text style={styles.pageTitle}>Εγγραφή</Text>
              <Text style={styles.subtitle}>Δημιούργησε τον λογαριασμό σου και ξεκίνα να παίζεις!</Text>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.formContainer}>
                <AuthInput
                  icon="user"
                  placeholder="Όνομα χρήστη"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                  style={styles.inputSpacing}
                />

                <AuthInput
                  icon="mail"
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.inputSpacing}
                />

                <AuthInput
                  icon="lock"
                  placeholder="Κωδικός πρόσβασης"
                  secureTextEntry
                  isPassword
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />

                <PasswordStrength password={password} />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={styles.buttonContent}>
                    <View style={styles.buttonIconCircle}>
                      <Ionicons name="arrow-forward" size={16} color="#FF4D4D" />
                    </View>
                    <Text style={styles.buttonText}>Εγγραφή</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ή</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.oauthContainer}>
                <TouchableOpacity
                  style={styles.oauthButton}
                  onPress={() => handleOAuth('apple')}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                  <Text style={styles.oauthButtonText}>Εγγραφή με Apple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.oauthButton}
                  onPress={() => handleOAuth('google')}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={styles.oauthButtonText}>Εγγραφή με Google</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Έχεις ήδη λογαριασμό; </Text>
                <Link href="/(auth)/sign-in" asChild>
                  <TouchableOpacity>
                    <Text style={styles.linkText}>Σύνδεση</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Επαλήθευση Email</Text>
              <Text style={styles.subtitle}>
                Στείλαμε έναν 6-ψήφιο κωδικό επαλήθευσης στο {email}
              </Text>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Κωδικός Επαλήθευσης</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Εισάγετε τον 6-ψήφιο κωδικό"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  value={code}
                  onChangeText={setCode}
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleVerify}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#121212" />
                ) : (
                  <Text style={styles.buttonText}>Επαλήθευση Κωδικού</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setPendingVerification(false)}
                disabled={isLoading}
              >
                <Text style={styles.backButtonText}>Επιστροφή στην Εγγραφή</Text>
              </TouchableOpacity>
            </>
          )}
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
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 54,
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
    fontSize: 12,
    color: '#00C2A8',
    fontWeight: '600',
    letterSpacing: 2,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  formContainer: {
    marginBottom: 8,
  },
  inputSpacing: {
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF3B5C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginTop: 16,
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
    paddingHorizontal: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1f2937',
  },
  dividerText: {
    color: '#6b7280',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  oauthContainer: {
    gap: 16,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1322',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 12,
  },
  oauthButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    color: '#00C2A8',
    fontSize: 14,
  },
  linkText: {
    color: '#00C2A8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#AEAEB2',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#111422',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 2,
    borderColor: '#1A1D2E',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#AEAEB2',
    fontSize: 14,
    fontWeight: '600',
  },
});
