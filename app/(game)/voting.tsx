import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useRoomStore } from '@/store/roomStore';
import { useUserStore } from '@/store/userStore';
import { soundManager } from '@/utils/soundManager';
import { translateCategory } from '@/utils/localization';
import * as Haptics from 'expo-haptics';
import Animated, { 
  FadeIn, 
  FadeOut, 
  Layout, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming 
} from 'react-native-reanimated';
import { ThumbsUp, ThumbsDown, CheckCircle, AlertTriangle, Trophy, Timer, ArrowLeft, RefreshCw, Star, Crown } from '@/components/AppIcon';

// Count-up Animated Score Component
function AnimatedScore({ score, style }: { score: number; style: any }) {
  const [displayScore, setDisplayScore] = useState(process.env.NODE_ENV === 'test' ? score : 0);

  useEffect(() => {
    let start = 0;
    const end = score;
    if (start === end) {
      setDisplayScore(end);
      return;
    }
    const duration = 1000;
    const stepTime = Math.abs(Math.floor(duration / end)) || 20;
    
    let timer = setInterval(() => {
      start += Math.ceil(end / 20); // increment in 20 steps
      if (start >= end) {
        clearInterval(timer);
        setDisplayScore(end);
      } else {
        setDisplayScore(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [score]);

  return <Text style={style}>{displayScore} pts</Text>;
}

// Sweep Scanline AI animation
function AIScanner() {
  const translateY = useSharedValue(-20);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(140, { duration: 1200 }),
        withTiming(-20, { duration: 1200 })
      ),
      -1,
      false
    );
  }, []);

  const scannerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <View style={styles.scannerWrapper}>
      <View style={styles.scannerBox}>
        <Animated.View style={[styles.scanLine, scannerStyle]} />
        <RefreshCw size={48} color="#00C2A8" style={styles.scannerIcon} />
      </View>
      <Text style={styles.scannerText}>Το AI αξιολογεί τις απαντήσεις...</Text>
    </View>
  );
}

export default function VotingScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { roomState, castVote, resetRoom, nextRound } = useRoomStore();
  const { profile, fetchProfile } = useUserStore();

  const [timeLeft, setTimeLeft] = useState(0);
  const [submittingVotes, setSubmittingVotes] = useState<Record<string, boolean>>({});

  // Sync countdown timer
  useEffect(() => {
    if (!roomState || roomState.status !== 'VOTING') return;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - roomState.timerStartedAt) / 1000);
      const remaining = Math.max(0, (roomState.votingTimeLimit || 30) - elapsed);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [roomState?.currentCategoryIndex, roomState?.status]);

  // Handle redirection
  useEffect(() => {
    if (!roomState) return;

    if (roomState.status === 'ROUND_ACTIVE' || roomState.status === 'STARTING') {
      router.replace('/(game)/play');
    } else if (roomState.status === 'WAITING') {
      router.replace(`/(game)/lobby/${roomState.roomCode}`);
    }
  }, [roomState?.status]);

  // Play win fanfare + refresh stats when game finishes
  useEffect(() => {
    if (roomState?.status === 'FINISHED') {
      soundManager.playSound('win').catch(() => {});
      // Silently re-fetch the user profile to update stats (wins, games_played, total_score)
      getToken().then((token) => {
        if (token) fetchProfile(token, { silent: true });
      }).catch(() => {});

      // Ask for App Store review if the whole game is finished (not just a round)
      if (roomState.currentRound >= roomState.totalRounds) {
        setTimeout(async () => {
          try {
            if (await StoreReview.hasAction()) {
              await StoreReview.requestReview();
            }
          } catch (e) {
            console.log('Store review prompt failed', e);
          }
        }, 3000); // Wait 3 seconds so they can see their final score first
      }
    }
  }, [roomState?.status]);

  // Play evaluating sound
  useEffect(() => {
    if (roomState?.status === 'VALIDATING' || roomState?.status === 'SCORING') {
      soundManager.playSound('evaluating').catch(() => {});
    }
  }, [roomState?.status]);

  if (!roomState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator testID="voting-loading-indicator" size="large" color="#00C2A8" />
        <Text style={styles.loadingText}>Φορτώνουμε...</Text>
      </View>
    );
  }

  // 1. SCORING / VALIDATING STATE
  if (roomState.status === 'VALIDATING' || roomState.status === 'SCORING') {
    return (
      <View style={styles.loadingContainer}>
        <AIScanner />
      </View>
    );
  }

  // 2. FINISHED STATE LEADERBOARD
  if (roomState.status === 'FINISHED') {
    const playersList = Object.keys(roomState.players).map((pId) => ({
      id: pId,
      ...roomState.players[pId],
    })).sort((a, b) => (b.score || 0) - (a.score || 0));

    const isHost = roomState.hostId === profile?.clerk_id;
    const isGameFinished = roomState.currentRound >= roomState.totalRounds;

    const handleNextAction = async () => {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (isGameFinished) {
          await resetRoom();
        } else {
          await nextRound();
        }
      } catch (err: any) {
        Alert.alert('Σφάλμα', err.message || 'Αποτυχία μετάβασης');
      }
    };

    return (
      <View style={styles.container}>
        <View style={styles.finishedHeader}>
          <Trophy size={40} color="#FF4D4D" style={{ marginBottom: 12 }} />
          <Text style={styles.finishedTitle}>{isGameFinished ? 'ΠΑΙΧΝΙΔΙ ΤΕΛΕΙΩΣΕ!' : 'ΤΕΛΟΣ ΓΥΡΟΥ!'}</Text>
          <Text style={styles.finishedSubtitle}>
            {isGameFinished ? 'Τελική Κατάταξη' : `Κατάταξη Γύρου ${roomState.currentRound}`}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.leaderboardScroll}>
          {playersList.map((player, idx) => {
            const isSelf = player.id === profile?.clerk_id;
            const isWinner = idx === 0;
            return (
              <Animated.View 
                entering={FadeIn.delay(idx * 100)}
                layout={Layout.springify()}
                key={player.id} 
                style={[
                  styles.playerRow, 
                  isSelf && styles.playerRowSelf,
                  isWinner && styles.playerRowWinner
                ]}
              >
                <View style={styles.playerRankContainer}>
                  {isWinner ? (
                    <Crown size={22} color="#00C2A8" />
                  ) : (
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  )}
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.username}</Text>
                  {player.id === roomState.hostId && (
                    <Text style={styles.hostBadge}>HOST</Text>
                  )}
                </View>
                <AnimatedScore score={player.score || 0} style={styles.playerScore} />
              </Animated.View>
            );
          })}
        </ScrollView>

        <View style={styles.actionContainer}>
          {isHost ? (
            <TouchableOpacity style={styles.lobbyBtn} onPress={handleNextAction}>
              <Text style={styles.lobbyBtnText}>{isGameFinished ? 'ΠΑΙΞΤΕ ΞΑΝΑ' : 'ΕΠΟΜΕΝΟΣ ΓΥΡΟΣ'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingBadge}>
              <ActivityIndicator size="small" color="#00C2A8" style={{ marginRight: 8 }} />
              <Text style={styles.waitingBadgeText}>
                Αναμονή για τον οικοδεσπότη...
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // 3. VOTING INTERFACE
  const currentCategoryIndex = roomState.currentCategoryIndex;
  const currentCategory = translateCategory(roomState.categories[currentCategoryIndex] || '');
  const myUserId = profile?.clerk_id || '';

  const answersMap = roomState.answers[currentCategoryIndex] || {};
  const allPlayersAnswers = Object.keys(roomState.players)
    .filter((pId) => roomState.players[pId].connected)
    .map((pId) => {
      const ansObj = answersMap[pId] || { raw: '', normalized: '', approved: false, votes: {} };
      const hasAnswer = !!ansObj.raw && ansObj.raw.trim().length > 0;
      return {
        userId: pId,
        username: roomState.players[pId].username,
        answer: hasAnswer ? ansObj.raw : '(Καμία απάντηση)',
        approved: ansObj.approved,
        votes: ansObj.votes || {},
        isMe: pId === myUserId,
        hasAnswer,
      };
    })
    .sort((a, b) => {
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      return 0;
    });

  const handleVote = async (targetUserId: string, vote: boolean) => {
    setSubmittingVotes((prev) => ({ ...prev, [targetUserId]: true }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      await castVote(currentCategoryIndex, targetUserId, vote);
    } catch (err: any) {
      Alert.alert('Σφάλμα', err.message || 'Αποτυχία υποβολής ψήφου');
    } finally {
      setSubmittingVotes((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header (Progress and Timer) */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            ΑΞΙΟΛΟΓΗΣΗ {currentCategoryIndex + 1} ΑΠΟ {roomState.categories.length}
          </Text>
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${((currentCategoryIndex + 1) / roomState.categories.length) * 100}%` }
              ]} 
            />
          </View>
        </View>

        <View style={[styles.timerContainer, timeLeft <= 5 && styles.timerUrgent]}>
          <Timer size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.timerText}>{timeLeft}s</Text>
        </View>
      </View>

      {/* Main Category Header Card */}
      <View style={styles.categoryCard}>
        <Text style={styles.categoryLabel}>ΚΑΤΗΓΟΡΙΑ</Text>
        <Text style={styles.categoryName}>{currentCategory}</Text>
        <Text style={styles.letterLabel}>Γράμμα: {roomState.letter}</Text>
      </View>

      {/* Scrollable Answers List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {allPlayersAnswers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Δεν βρέθηκαν απαντήσεις.</Text>
          </View>
        ) : (
          allPlayersAnswers.map((item) => {
            const hasVoted = item.votes[myUserId] !== undefined;
            const currentVote = item.votes[myUserId];
            const isPending = submittingVotes[item.userId];

            return (
              <Animated.View 
                entering={FadeIn}
                layout={Layout.springify()}
                key={item.userId} 
                style={[styles.card, item.isMe && styles.myCard]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.username, item.isMe && styles.myUsername]}>
                    {item.isMe ? 'Η ΑΠΑΝΤΗΣΗ ΜΟΥ' : item.username.toUpperCase()}
                  </Text>

                  {/* AI Status Badge or No Answer Badge */}
                  {item.hasAnswer ? (
                    <View style={[
                      styles.aiBadge, 
                      item.approved ? styles.aiApproved : styles.aiRejected
                    ]}>
                      {item.approved ? (
                        <CheckCircle size={13} color="#00C2A8" style={{ marginRight: 4 }} />
                      ) : (
                        <AlertTriangle size={13} color="#FF4D4D" style={{ marginRight: 4 }} />
                      )}
                      <Text style={[
                        styles.aiBadgeText, 
                        item.approved ? styles.aiApprovedText : styles.aiRejectedText
                      ]}>
                        {item.approved ? 'Έγκριση AI' : 'Απόρριψη AI'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.aiBadge, styles.noAnswerBadge]}>
                      <AlertTriangle size={13} color="#FF595E" style={{ marginRight: 4 }} />
                      <Text style={[styles.aiBadgeText, styles.noAnswerBadgeText]}>
                        0 ΠΟΝΤΟΙ
                      </Text>
                    </View>
                  )}
                </View>

                {/* Submitted Word */}
                <Text style={[styles.submittedWord, !item.hasAnswer && styles.noAnswerText]}>
                  {item.answer}
                </Text>

                {/* Voting Row */}
                {!item.isMe && item.hasAnswer && (
                  <View style={styles.voteRow}>
                    <TouchableOpacity
                      disabled={isPending}
                      style={[
                        styles.voteBtn,
                        styles.rejectBtn,
                        hasVoted && currentVote === false && styles.rejectActiveBtn
                      ]}
                      onPress={() => handleVote(item.userId, false)}
                    >
                      <ThumbsDown 
                        size={16} 
                        color={hasVoted && currentVote === false ? '#FFFFFF' : '#FF4D4D'} 
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[
                        styles.voteBtnText,
                        styles.rejectBtnText,
                        hasVoted && currentVote === false && styles.voteActiveBtnText
                      ]}>
                        ΑΠΟΡΡΙΨΗ
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={isPending}
                      style={[
                        styles.voteBtn,
                        styles.acceptBtn,
                        hasVoted && currentVote === true && styles.acceptActiveBtn
                      ]}
                      onPress={() => handleVote(item.userId, true)}
                    >
                      <ThumbsUp 
                        size={16} 
                        color={hasVoted && currentVote === true ? '#FFFFFF' : '#00C2A8'} 
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[
                        styles.voteBtnText,
                        styles.acceptBtnText,
                        hasVoted && currentVote === true && styles.voteActiveBtnText
                      ]}>
                        ΑΠΟΔΟΧΗ
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#A0AEC0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#0F3460',
  },
  progressContainer: {
    flex: 1,
    marginRight: 20,
  },
  progressText: {
    color: '#FF4D4D',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#16213E',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0F3460',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF4D4D',
    borderRadius: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#16213E',
    borderWidth: 2,
    borderColor: '#0F3460',
  },
  timerUrgent: {
    borderColor: '#FF4D4D',
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  categoryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16213E',
    marginHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#0F3460',
    marginVertical: 16,
  },
  categoryLabel: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  categoryName: {
    color: '#00C2A8',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  letterLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#A0AEC0',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#16213E',
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
    borderColor: '#0F3460',
    marginBottom: 16,
  },
  myCard: {
    borderColor: '#00C2A8',
    backgroundColor: 'rgba(0, 194, 168, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  username: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  myUsername: {
    color: '#00C2A8',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  aiApproved: {
    backgroundColor: 'rgba(0, 194, 168, 0.1)',
    borderColor: '#00C2A8',
  },
  aiRejected: {
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    borderColor: '#FF4D4D',
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  aiApprovedText: {
    color: '#00C2A8',
  },
  aiRejectedText: {
    color: '#FF4D4D',
  },
  noAnswerBadge: {
    backgroundColor: 'rgba(255, 89, 94, 0.1)',
    borderColor: '#FF595E',
  },
  noAnswerBadgeText: {
    color: '#FF595E',
  },
  noAnswerText: {
    color: '#55627E',
    fontStyle: 'italic',
    fontSize: 20,
  },
  submittedWord: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 16,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voteBtn: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
  },
  rejectBtn: {
    borderColor: '#FF4D4D',
    backgroundColor: 'transparent',
  },
  rejectActiveBtn: {
    backgroundColor: '#FF4D4D',
  },
  acceptBtn: {
    borderColor: '#00C2A8',
    backgroundColor: 'transparent',
  },
  acceptActiveBtn: {
    backgroundColor: '#00C2A8',
  },
  voteBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  rejectBtnText: {
    color: '#FF4D4D',
  },
  acceptBtnText: {
    color: '#00C2A8',
  },
  voteActiveBtnText: {
    color: '#FFFFFF',
  },
  finishedHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  finishedTitle: {
    color: '#FF4D4D',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },
  finishedSubtitle: {
    color: '#A0AEC0',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  leaderboardScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213E',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0F3460',
    marginBottom: 12,
  },
  playerRowSelf: {
    borderColor: '#FF4D4D',
    backgroundColor: 'rgba(255, 77, 77, 0.05)',
  },
  playerRowWinner: {
    borderColor: '#00C2A8',
    backgroundColor: 'rgba(0, 194, 168, 0.05)',
  },
  playerRankContainer: {
    width: 36,
  },
  rankText: {
    color: '#A0AEC0',
    fontSize: 16,
    fontWeight: '900',
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  hostBadge: {
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    color: '#00C2A8',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  playerScore: {
    color: '#00C2A8',
    fontSize: 18,
    fontWeight: '900',
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
    alignItems: 'center',
  },
  lobbyBtn: {
    backgroundColor: '#FF4D4D',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lobbyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0F3460',
  },
  waitingBadgeText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '800',
  },
  scannerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerBox: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#16213E',
    borderWidth: 3,
    borderColor: '#0F3460',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#00C2A8',
    shadowColor: '#00C2A8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  scannerIcon: {
    opacity: 0.8,
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
