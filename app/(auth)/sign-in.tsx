import React, { useState } from 'react';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
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

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false);
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

  const handleSignIn = async () => {
    if (!isLoaded || !signIn || !setActive) return;
    if (!email || !password) {
      setError('Παρακαλώ συμπληρώστε όλα τα πεδία');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else if (result.status === 'needs_second_factor') {
        // Find the active strategy
        const factor = result.supportedSecondFactors?.find(
          (f) => f.strategy === 'email_code' || f.strategy === 'phone_code' || f.strategy === 'totp'
        );

        if (factor) {
          if (factor.strategy === 'email_code' || factor.strategy === 'phone_code') {
            // Trigger Clerk to send the code to email/SMS
            await signIn.prepareSecondFactor({ strategy: factor.strategy });
          }
          setPendingSecondFactor(true);
        } else {
          setError('Δεν βρέθηκε υποστηριζόμενη στρατηγική επαλήθευσης.');
        }
      } else {
        console.warn('Sign in status incomplete:', result.status);
        setError('Η σύνδεση απέτυχε. Κατάσταση: ' + result.status);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Η σύνδεση απέτυχε');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!isLoaded || !signIn || !setActive) return;
    if (!code) {
      setError('Παρακαλώ εισάγετε τον κωδικό επαλήθευσης');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find the active/available second factor strategy (email_code, totp, phone_code)
      const strategy = signIn.supportedSecondFactors?.find(
        (f) => f.strategy === 'email_code' || f.strategy === 'totp' || f.strategy === 'phone_code'
      )?.strategy || 'totp';

      const result = await signIn.attemptSecondFactor({
        strategy: strategy as any,
        code,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setError('Η επαλήθευση απέτυχε. Κατάσταση: ' + result.status);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Μη έγκυρος κωδικός επαλήθευσης');
    } finally {
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
          {!pendingSecondFactor ? (
            <>
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Z O P R A</Text>
                <Text style={styles.tagline}>♦ ΤΟ ΕΛΛΗΝΙΚΟ ΠΑΙΧΝΙΔΙ ΛΕΞΕΩΝ ♦</Text>
              </View>
              
              <Text style={styles.pageTitle}>Σύνδεση</Text>
              <Text style={styles.subtitle}>Καλώς ήρθες πίσω! Συνδέσου για να συνεχίσεις.</Text>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.formContainer}>
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
                
                <TouchableOpacity style={styles.forgotPasswordContainer}>
                  <Text style={styles.forgotPasswordText}>Ξέχασες τον κωδικό σου;</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={styles.buttonContent}>
                    <View style={styles.buttonIconCircle}>
                      <Ionicons name="arrow-forward" size={16} color="#FF4D4D" />
                    </View>
                    <Text style={styles.buttonText}>Σύνδεση</Text>
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
                  <Text style={styles.oauthButtonText}>Σύνδεση με Apple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.oauthButton}
                  onPress={() => handleOAuth('google')}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={styles.oauthButtonText}>Σύνδεση με Google</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Δεν έχεις λογαριασμό; </Text>
                <Link href="/(auth)/sign-up" asChild>
                  <TouchableOpacity>
                    <Text style={styles.linkText}>Δημιούργησε έναν!</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Επαλήθευση</Text>
              <Text style={styles.subtitle}>Εισάγετε τον κωδικό επαλήθευσης από τον authenticator ή SMS</Text>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Κωδικός Επαλήθευσης</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Εισάγετε τον κωδικό 2FA"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  value={code}
                  onChangeText={setCode}
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleVerify2FA}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#121212" />
                ) : (
                  <Text style={styles.buttonText}>Επαλήθευση 2FA</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setPendingSecondFactor(false)}
                disabled={isLoading}
              >
                <Text style={styles.backButtonText}>Επιστροφή στη Σύνδεση</Text>
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#00C2A8',
    fontSize: 13,
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
