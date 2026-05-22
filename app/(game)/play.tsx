import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoomStore } from '@/store/roomStore';
import { useUserStore } from '@/store/userStore';
import { GreekKeyboard } from '@/components/GreekKeyboard';
import { soundManager } from '@/utils/soundManager';
import { translateCategory } from '@/utils/localization';
import AvatarView from '@/components/AvatarView';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {
  User,
  PawPrint,
  Package,
  Globe,
  Building2,
  Briefcase,
  CheckCircle,
  HelpCircle,
  ArrowLeft,
  Trophy,
  Palette,
  Leaf,
  Food
} from '@/components/AppIcon';

// Helper to match Category to Lucide Icon
function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase().trim();
  switch (normalized) {
    case 'name':
    case 'όνομα':
      return User;
    case 'animal':
    case 'ζώο':
      return PawPrint;
    case 'thing':
    case 'πράγμα':
      return Package;
    case 'country':
    case 'χώρα':
      return Globe;
    case 'city':
    case 'πόλη':
      return Building2;
    case 'profession':
    case 'επάγγελμα':
      return Briefcase;
    case 'color':
    case 'χρώμα':
      return Palette;
    case 'plant':
    case 'φυτό':
      return Leaf;
    case 'food':
    case 'φαγητό':
      return Food;
    default:
      return HelpCircle;
  }
}

export default function PlayScreen() {
  const router = useRouter();
  const { roomState, submitAnswer, leaveRoom } = useRoomStore();
  const { profile } = useUserStore();

  const [currentAnswer, setCurrentAnswer] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startingCount, setStartingCount] = useState(3);
  const flatListRef = useRef<FlatList>(null);

  const progressWidth = useSharedValue(100);

  // Sync starting countdown timer
  useEffect(() => {
    if (!roomState || roomState.status !== 'STARTING') return;

    const updateStartingTimer = () => {
      const elapsed = Math.floor((Date.now() - roomState.timerStartedAt) / 1000);
      const remaining = Math.max(1, 3 - elapsed);
      setStartingCount(remaining);
    };

    updateStartingTimer();
    const interval = setInterval(updateStartingTimer, 250);

    return () => clearInterval(interval);
  }, [roomState?.status, roomState?.timerStartedAt]);

  useEffect(() => {
    if (roomState?.status === 'STARTING') {
      soundManager.playSound('tick').catch(() => { });
    }
  }, [startingCount, roomState?.status]);

  useEffect(() => {
    if (roomState?.status === 'ROUND_ACTIVE' && timeLeft > 0 && timeLeft <= 3) {
      soundManager.playSound('warning').catch(() => { });
    }
  }, [timeLeft, roomState?.status]);

  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  // Sync timer with server authoritative state
  useEffect(() => {
    if (!roomState || roomState.status !== 'ROUND_ACTIVE') return;

    setHasSubmitted(false);
    setCurrentAnswer('');

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - roomState.timerStartedAt) / 1000);
      const remaining = Math.max(0, roomState.timePerCategory - elapsed);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [roomState?.currentCategoryIndex, roomState?.status]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (roomState?.status === 'ROUND_ACTIVE' && timeLeft === 0 && !hasSubmitted && currentAnswer.trim().length > 0) {
      submitAnswer(currentAnswer).catch(() => {});
      setHasSubmitted(true);
    }
  }, [timeLeft, roomState?.status, hasSubmitted, currentAnswer]);

  // Animate Teal Progress Bar
  useEffect(() => {
    if (roomState?.status === 'ROUND_ACTIVE' && roomState.timePerCategory > 0) {
      const pct = (timeLeft / roomState.timePerCategory) * 100;
      progressWidth.value = withTiming(pct, { duration: 1000 });
    }
  }, [timeLeft, roomState?.timePerCategory]);

  // Handle automatic redirection
  useEffect(() => {
    if (!roomState) return;

    if (roomState.status === 'VOTING') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      router.replace('/(game)/voting');
    } else if (roomState.status === 'WAITING') {
      router.replace(`/(game)/lobby/${roomState.roomCode}`);
    }
  }, [roomState?.status]);

  // Auto-scroll to the current category tab
  useEffect(() => {
    if (roomState && roomState.status === 'ROUND_ACTIVE' &&
        typeof roomState.currentCategoryIndex === 'number' && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: roomState.currentCategoryIndex,
          animated: true,
          viewPosition: 0.5 // Centers the active tab on screen
        });
      }, 100); // small delay to ensure layout is ready
    }
  }, [roomState?.currentCategoryIndex, roomState?.status]);

  if (!roomState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C2A8" />
        <Text style={styles.loadingText}>Φορτώνουμε το παιχνίδι...</Text>
      </View>
    );
  }

  // 1. STARTING COUNTDOWN OVERLAY
  if (roomState.status === 'STARTING') {
    return (
      <View style={styles.countdownContainer}>
        <Animated.View entering={ZoomIn} key={startingCount} style={styles.countdownBubble}>
          <Text style={styles.countdownText}>{startingCount}</Text>
        </Animated.View>
        <Text style={styles.countdownSubtitle}>ΕΤΟΙΜΑΣΟΥ! Η ΛΕΞΗ ΞΕΚΙΝΑΕΙ ΑΠΟ</Text>
        <Text style={styles.startingLetter}>{roomState.letter}</Text>
      </View>
    );
  }

  const activeCategoryName = roomState.categories[roomState.currentCategoryIndex] || '';
  const currentCategoryLabel = translateCategory(activeCategoryName);


  const handleKeyPress = (char: string) => {
    if (hasSubmitted) return;
    if (currentAnswer.length >= 30) return;
    setCurrentAnswer((prev) => prev + char);
  };

  const handleBackspace = () => {
    if (hasSubmitted) return;
    setCurrentAnswer((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (hasSubmitted) return;
    setCurrentAnswer('');
  };

  const handleSubmit = async () => {
    if (hasSubmitted || currentAnswer.trim().length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    soundManager.playSound('success').catch(() => { });
    setHasSubmitted(true);

    try {
      await submitAnswer(currentAnswer);
    } catch (err: any) {
      setHasSubmitted(false);
      Alert.alert('Σφάλμα', err.message || 'Αποτυχία υποβολής απάντησης');
    }
  };

  const handleLeaveGame = async () => {
    Alert.alert(
      'Έξοδος από το παιχνίδι',
      'Είστε σίγουροι ότι θέλετε να αποχωρήσετε από το τρέχον παιχνίδι;',
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Έξοδος',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveRoom();
              router.replace('/(game)/home');
            } catch (err: any) {
              Alert.alert('Σφάλμα', err.message || 'Αποτυχία αποχώρησης');
            }
          }
        }
      ]
    );
  };

  // Get active answers & players sorted by score
  const activeAnswers = roomState.answers[roomState.currentCategoryIndex] || {};
  const sortedPlayers = Object.entries(roomState.players)
    .map(([pId, pState]) => ({
      id: pId,
      ...pState,
      hasAnswered: !!activeAnswers[pId],
    }))
    .sort((a, b) => b.score - a.score);

  // Format timer text as M:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      {/* Top Header Row */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleLeaveGame}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>ZOPRA</Text>
          <Text style={styles.logoSubtitle}>Όνομα, Ζώο, Πράγμα</Text>
        </View>

        <View style={styles.profileBox}>
          <AvatarView avatarUrl={profile?.avatar_url || null} size={32} style={styles.avatarBorder} />
          <View style={styles.profileText}>
            <Text style={styles.usernameText} numberOfLines={1}>{profile?.username || 'Εγώ'}</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>{profile?.total_score ?? 0}</Text>
              <Text style={styles.diamondText}>✦</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Timer Progress Bar */}
      <View style={styles.timerContainer}>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, progressBarStyle]} />
        </View>
        <Text style={styles.timerText}>{formattedTime}</Text>
      </View>

      {/* category instructions info */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>✦ Βρες μια λέξη που να ταιριάζει με την κατηγορία! ✦</Text>
      </View>

      {/* Scrollable Category Tabs */}
      <View style={styles.tabsWrapper}>
        <FlatList 
          ref={flatListRef}
          data={roomState.categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          keyExtractor={(item, index) => index.toString()}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            });
          }}
          renderItem={({ item: cat, index: idx }) => {
            const isCurrent = idx === roomState.currentCategoryIndex;
            const Icon = getCategoryIcon(cat);
            const label = translateCategory(cat);
            return (
              <View
                style={[
                  styles.tabItem,
                  isCurrent && styles.tabItemActive
                ]}
              >
                <Icon size={18} color={isCurrent ? '#FFFFFF' : '#A0AEC0'} style={{ marginRight: 6 }} />
                <Text style={[styles.tabText, isCurrent && styles.tabTextActive]}>
                  {label.toUpperCase()}
                </Text>
              </View>
            );
          }}
        />
      </View>

      {/* Two-Column Middle Section Layout */}
      <View style={styles.middleRow}>
        {/* Left Game Card */}
        <View style={styles.gameCard}>
          <Text style={styles.instructionText}>
            Βρες μια <Text style={styles.boldCategoryText}>{currentCategoryLabel.toUpperCase()}</Text> που αρχίζει από:
          </Text>
          <Text style={styles.targetLetterBig}>{roomState.letter}</Text>

          {/* Answer Input Box */}
          <View style={styles.inputContainer}>
            <Text style={[
              styles.spacedText,
              currentAnswer.length > 12 && { fontSize: 22, letterSpacing: 1 },
              currentAnswer.length > 16 && { fontSize: 17, letterSpacing: 0.5 },
              currentAnswer.length > 20 && { fontSize: 13, letterSpacing: 0 },
            ]}>
              {currentAnswer ? currentAnswer.split('').join(' ') : ''}
            </Text>
            {currentAnswer.length > 0 && !hasSubmitted && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✖</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submitting / Status feedback */}
          {hasSubmitted ? (
            <Animated.View entering={FadeIn} style={styles.statusFeedback}>
              <ActivityIndicator size="small" color="#00C2A8" style={{ marginRight: 6 }} />
              <Text style={styles.statusText}>Περιμένουμε να τελειώσουν όλοι...</Text>
            </Animated.View>
          ) : (
            <View style={styles.emptyStatusPlaceholder} />
          )}
        </View>

        {/* Right Players Sidebar */}
        <View style={styles.sidebar}>
          <ScrollView contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
            {sortedPlayers.map((player, index) => {
              const rank = index + 1;
              const isMe = player.id === profile?.clerk_id;

              return (
                <View
                  key={player.id}
                  style={[
                    styles.playerCard,
                    isMe && styles.myPlayerCard
                  ]}
                >
                  {/* Rank Badge */}
                  <View style={[
                    styles.rankBadge,
                    rank === 1 ? styles.rank1Badge : styles.rankOtherBadge
                  ]}>
                    <Text style={styles.rankBadgeText}>{rank}</Text>
                  </View>

                  <View style={styles.sidebarAvatarContainer}>
                    <AvatarView
                      avatarUrl={player.avatarUrl}
                      size={32}
                      style={StyleSheet.flatten([
                        styles.sidebarAvatar,
                        player.hasAnswered ? styles.sidebarAvatarActive : styles.sidebarAvatarInactive
                      ])}
                    />
                  </View>

                  <Text style={styles.playerNameText} numberOfLines={1}>
                    {player.username}
                  </Text>

                  <View style={styles.playerScoreRow}>
                    <Text style={styles.playerScoreText}>{player.score}</Text>
                    {rank === 1 ? (
                      <Trophy size={11} color="#ECC94B" />
                    ) : (
                      <Text style={styles.sidebarDiamondText}>✦</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Keyboard Container */}
      <GreekKeyboard
        onKeyPress={handleKeyPress}
        onBackspace={handleBackspace}
        onClear={handleClear}
      />

      {/* Footer Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (currentAnswer.trim().length === 0 || hasSubmitted) && styles.submitBtnDisabled
          ]}
          disabled={currentAnswer.trim().length === 0 || hasSubmitted}
          onPress={handleSubmit}
        >
          <View style={styles.submitBtnContent}>
            <CheckCircle size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.submitBtnText}>
              {hasSubmitted ? 'ΥΠΟΒΛΗΘΗΚΕ' : 'ΥΠΟΒΟΛΗ'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* AI Validation Overlay */}
      {roomState.status === 'VALIDATING' && (
        <Animated.View entering={FadeIn} style={[StyleSheet.absoluteFill, styles.validatingOverlay]}>
          <ActivityIndicator size="large" color="#00C2A8" style={{ transform: [{ scale: 1.2 }] }} />
          <Text style={styles.validatingOverlayTitle}>Έλεγχος Απαντήσεων...</Text>
          <Text style={styles.validatingOverlaySubtitle}>
            Η Τεχνητή Νοημοσύνη βαθμολογεί τις λέξεις σας.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E17',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0E17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#A0AEC0',
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  validatingOverlay: {
    backgroundColor: 'rgba(11, 14, 23, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  validatingOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 24,
    letterSpacing: 1,
  },
  validatingOverlaySubtitle: {
    color: '#00C2A8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  countdownContainer: {
    flex: 1,
    backgroundColor: '#0B0E17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownBubble: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 194, 168, 0.1)',
    borderWidth: 3,
    borderColor: '#00C2A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '900',
  },
  countdownSubtitle: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 2,
  },
  startingLetter: {
    color: '#FF4D4D',
    fontSize: 96,
    fontWeight: '900',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    color: '#FF4D4D',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    lineHeight: 26,
  },
  logoSubtitle: {
    color: '#00C2A8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 120,
  },
  avatarBorder: {
    borderWidth: 1.5,
    borderColor: '#00C2A8',
  },
  profileText: {
    marginLeft: 8,
  },
  usernameText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreText: {
    color: '#00C2A8',
    fontSize: 11,
    fontWeight: '800',
    marginRight: 2,
  },
  diamondText: {
    color: '#00C2A8',
    fontSize: 10,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#111422',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1E233C',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00C2A8',
    borderRadius: 4,
  },
  timerText: {
    color: '#FF4D4D',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 12,
    width: 38,
    textAlign: 'right',
  },
  infoBanner: {
    alignItems: 'center',
    marginVertical: 4,
  },
  infoBannerText: {
    color: '#718096',
    fontSize: 10,
    fontWeight: '700',
  },
  tabsWrapper: {
    marginVertical: 6,
  },
  tabsScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E233C',
    backgroundColor: '#111422',
  },
  tabItemActive: {
    borderColor: '#FF4D4D',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  middleRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginVertical: 6,
  },
  gameCard: {
    flex: 0.76,
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  instructionText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  boldCategoryText: {
    color: '#FF4D4D',
    fontWeight: '900',
  },
  targetLetterBig: {
    color: '#FFFFFF',
    fontSize: 54,
    fontWeight: '900',
    marginBottom: 16,
  },
  inputContainer: {
    width: '100%',
    height: 76,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00C2A8',
    backgroundColor: '#0B0E17',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  spacedText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },
  clearBtn: {
    position: 'absolute',
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E233C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#A0AEC0',
    fontSize: 10,
  },
  statusFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  statusText: {
    color: '#00C2A8',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyStatusPlaceholder: {
    height: 20,
    marginTop: 12,
  },
  sidebar: {
    flex: 0.24,
  },
  sidebarContent: {
    gap: 8,
  },
  playerCard: {
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    position: 'relative',
  },
  myPlayerCard: {
    borderColor: '#00C2A8',
  },
  rankBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  rank1Badge: {
    backgroundColor: '#FF4D4D',
  },
  rankOtherBadge: {
    backgroundColor: '#00C2A8',
  },
  rankBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  sidebarAvatarContainer: {
    marginBottom: 6,
  },
  sidebarAvatar: {
    borderWidth: 2,
  },
  sidebarAvatarActive: {
    borderColor: '#00C2A8',
  },
  sidebarAvatarInactive: {
    borderColor: '#1E233C',
  },
  playerNameText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  playerScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  playerScoreText: {
    color: '#00C2A8',
    fontSize: 9,
    fontWeight: '800',
    marginRight: 2,
  },
  sidebarDiamondText: {
    color: '#00C2A8',
    fontSize: 7,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: '#FF4D4D',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#1E233C',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
