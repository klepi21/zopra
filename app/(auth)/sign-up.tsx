import React, { useState } from 'react';
import { useSignUp } from '@clerk/clerk-expo';
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!isLoaded || !signUp || !setActive) return;
    if (!email || !password) {
      setError('Παρακαλώ συμπληρώστε όλα τα πεδία');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      // Prepare email address verification
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Η εγγραφή απέτυχε');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
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
          {!pendingVerification ? (
            <>
              <Text style={styles.title}>Δημιουργία Λογαριασμού</Text>
              <Text style={styles.subtitle}>Εγγραφείτε για να παίξετε ZOPRA</Text>

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
                  placeholder="Δημιουργήστε έναν κωδικό"
                  placeholderTextColor="#666"
                  secureTextEntry
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#121212" />
                ) : (
                  <Text style={styles.buttonText}>Εγγραφή</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Έχετε ήδη λογαριασμό; </Text>
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
    backgroundColor: '#0B0E17',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FF4D4D',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 77, 77, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0AEC0',
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
  button: {
    backgroundColor: '#FF4D4D',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#A0AEC0',
    fontSize: 15,
    fontWeight: '600',
  },
  linkText: {
    color: '#00C2A8',
    fontSize: 15,
    fontWeight: '900',
  },
});
