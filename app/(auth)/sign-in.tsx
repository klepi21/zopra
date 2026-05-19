import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <Text style={styles.title}>ZOPRA</Text>
              <Text style={styles.subtitle}>Συνδεθείτε για να παίξετε</Text>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Διεύθυνση Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Εισάγετε το email σας"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Κωδικός Πρόσβασης</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Εισάγετε τον κωδικό σας"
                  placeholderTextColor="#666"
                  secureTextEntry
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#121212" />
                ) : (
                  <Text style={styles.buttonText}>Σύνδεση</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Δεν έχετε λογαριασμό; </Text>
                <Link href="/(auth)/sign-up" asChild>
                  <TouchableOpacity>
                    <Text style={styles.linkText}>Εγγραφή</Text>
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
    backgroundColor: '#121212',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFE81F',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 232, 31, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 2,
    borderColor: '#5E239D',
  },
  button: {
    backgroundColor: '#FFE81F',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#FFE81F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: '#121212',
    fontSize: 18,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '600',
  },
  linkText: {
    color: '#FFE81F',
    fontSize: 15,
    fontWeight: '900',
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
