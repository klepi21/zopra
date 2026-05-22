import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleNext = () => {
    if (currentIndex < 1) {
      scrollRef.current?.scrollTo({ x: width * (currentIndex + 1), animated: true });
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    await SecureStore.setItemAsync('hasSeenWelcome', 'true');
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      >
        {/* Page 1: Welcome */}
        <View style={styles.page}>
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoTop}>Z O P R A</Text>
              <Text style={styles.tagline}>♦ ΤΟ ΕΛΛΗΝΙΚΟ ΠΑΙΧΝΙΔΙ ΛΕΞΕΩΝ ♦</Text>
              
              {/* Big 3D styled text for O Z P */}
              <View style={styles.ozpContainer}>
                <Text style={styles.ozpTextLeft}>O</Text>
                <Text style={styles.ozpTextCenter}>Z</Text>
                <Text style={styles.ozpTextRight}>Π</Text>
              </View>
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.title}>Το παιχνίδι που ξέρεις και αγαπάς</Text>
              <Text style={styles.subtitle}>
                Βρες λέξεις που ταιριάζουν στην κατηγορία, ψήφισε τις καλύτερες και ανέβα στην κορυφή με την παρέα σου!
              </Text>
            </View>
          </View>
        </View>

        {/* Page 2: Rules */}
        <View style={styles.page}>
          <View style={styles.content}>
            <View style={styles.rulesHeader}>
              <View style={styles.letterBox}>
                <Text style={styles.letterText}>A</Text>
              </View>
              <Text style={styles.rulesTitle}>Πώς παίζεται;</Text>
            </View>

            <View style={styles.rulesList}>
              <RuleItem 
                icon="cpu" 
                number="1" 
                title="Αυτόματη επιλογή" 
                description="Το γράμμα επιλέγεται αυτόματα και τυχαία σε κάθε γύρο." 
              />
              <RuleItem 
                icon="clock" 
                number="2" 
                title="12 δευτερόλεπτα ανά κατηγορία" 
                description="Έχεις 12 δευτερόλεπτα για να σκεφτείς τη μοναδική σου απάντηση." 
              />
              <RuleItem 
                icon="award" 
                number="3" 
                title="Μοναδική απάντηση = 20 πόντοι" 
                description="Όσο πιο μοναδική είναι η απάντησή σου, τόσο περισσότεροι πόντοι!" 
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer / Controls */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <View style={styles.buttonContent}>
            <View style={styles.buttonIconCircle}>
              <Feather name="arrow-right" size={16} color="#FF3B5C" />
            </View>
            <Text style={styles.buttonText}>
              {currentIndex === 0 ? 'Ας Ξεκινήσουμε!' : 'Επόμενο'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.pagination}>
          {[0, 1].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function RuleItem({ icon, number, title, description }: { icon: any, number: string, title: string, description: string }) {
  return (
    <View style={styles.ruleCard}>
      <View style={styles.ruleIconContainer}>
        <Feather name={icon} size={28} color="#00C2A8" />
      </View>
      <View style={styles.ruleTextContainer}>
        <View style={styles.ruleTitleRow}>
          <View style={styles.ruleNumberCircle}>
            <Text style={styles.ruleNumber}>{number}</Text>
          </View>
          <Text style={styles.ruleItemTitle}>{title}</Text>
        </View>
        <Text style={styles.ruleItemDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  page: {
    width,
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoTop: {
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
    marginBottom: 40,
  },
  ozpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  ozpTextLeft: {
    fontSize: 120,
    fontWeight: '900',
    color: '#00C2A8',
    textShadowColor: 'rgba(0, 194, 168, 0.5)',
    textShadowOffset: { width: -4, height: 4 },
    textShadowRadius: 10,
    transform: [{ rotate: '-10deg' }],
  },
  ozpTextCenter: {
    fontSize: 140,
    fontWeight: '900',
    color: '#FF4D4D',
    textShadowColor: 'rgba(255, 77, 77, 0.5)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 10,
    zIndex: 10,
    marginHorizontal: -20,
  },
  ozpTextRight: {
    fontSize: 120,
    fontWeight: '900',
    color: '#00C2A8',
    textShadowColor: 'rgba(0, 194, 168, 0.5)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 10,
    transform: [{ rotate: '10deg' }],
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Rules styling
  rulesHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  letterBox: {
    width: 100,
    height: 100,
    backgroundColor: '#00C2A8',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#00C2A8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    transform: [{ rotate: '-5deg' }],
  },
  letterText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#ffffff',
  },
  rulesTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  rulesList: {
    gap: 16,
  },
  ruleCard: {
    flexDirection: 'row',
    backgroundColor: '#0f1322',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  ruleIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 194, 168, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  ruleTextContainer: {
    flex: 1,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ruleNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00C2A8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  ruleNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ruleItemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ruleItemDesc: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },

  // Footer styling
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
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
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#FF3B5C',
  },
  inactiveDot: {
    backgroundColor: '#374151',
  },
});
