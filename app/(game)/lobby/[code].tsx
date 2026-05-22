import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useRoomStore } from '@/store/roomStore';
import { useUserStore } from '@/store/userStore';
import AvatarView from '@/components/AvatarView';
import * as Haptics from 'expo-haptics';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Share,
  Alert,
  Platform,
  Clipboard,
  Dimensions
} from 'react-native';
import { ArrowLeft, Copy, Users, CheckCircle, User, Share2 } from '@/components/AppIcon';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 24) / 3; // accounting for padding and gaps

export default function LobbyScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { profile } = useUserStore();
  const { roomState, toggleReady, leaveRoom, isLoading, setupSocketListeners, joinRoom } = useRoomStore();

  useEffect(() => {
    setupSocketListeners();
    // Auto-join if arriving via deep link without being in the room
    if (code && (!roomState || roomState.roomCode !== code)) {
      joinRoom(code).catch((err: any) => {
        Alert.alert('Σφάλμα', err.message || 'Αποτυχία σύνδεσης στο δωμάτιο');
        router.replace('/(game)/home');
      });
    }
  }, [code]);

  useEffect(() => {
    if (roomState?.status === 'STARTING' || roomState?.status === 'ROUND_ACTIVE') {
      router.replace('/(game)/play');
    }
  }, [roomState?.status]);

  const handleShare = async () => {
    try {
      const joinLink = Linking.createURL(`lobby/${code}`);
      await Share.share({
        message: `🕹️ Έλα να παίξουμε ZOPRA!\n\nΚωδικός Δωματίου: ${code}\n\nΑν έχεις την εφαρμογή, πάτα εδώ για να μπεις:\n${joinLink}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error('Error sharing:', err.message);
    }
  };

  const handleCopyCode = () => {
    if (code) {
      Clipboard.setString(code.toUpperCase());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Αντιγράφηκε!', 'Ο κωδικός δωματίου αντιγράφηκε στο πρόχειρο.');
    }
  };

  const handleToggleReady = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await toggleReady();
    } catch (err: any) {
      Alert.alert('Σφάλμα', err.message || 'Αποτυχία αλλαγής κατάστασης ετοιμότητας');
    }
  };

  const handleLeaveRoom = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await leaveRoom();
      router.replace('/(game)/home');
    } catch (err: any) {
      Alert.alert('Σφάλμα', err.message || 'Αποτυχία εξόδου από το δωμάτιο');
    }
  };

  const handleStartGame = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await useRoomStore.getState().startGame();
    } catch (err: any) {
      Alert.alert('Σφάλμα', err.message || 'Αποτυχία εκκίνησης παιχνιδιού');
    }
  };

  const handleSettingsInfo = () => {
    Alert.alert(
      'Ρυθμίσεις Δωματίου',
      'Οι ρυθμίσεις του παιχνιδιού (γύροι, χρόνος) ορίζονται κατά τη δημιουργία του δωματίου. Για να τις αλλάξετε, παρακαλούμε δημιουργήστε ένα νέο δωμάτιο.'
    );
  };

  if (!roomState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C2A8" />
        <Text style={styles.loadingText}>Φορτώνουμε το λόμπι...</Text>
      </View>
    );
  }

  const isHost = roomState.hostId === profile?.clerk_id;
  const playersList = Object.entries(roomState.players).map(([id, player]) => ({
    id,
    ...player,
  }));

  const myPlayerState = roomState.players[profile?.clerk_id || ''];
  const isReady = myPlayerState?.isReady || false;

  // Build grid data representing exactly 8 slots (padded with placeholders)
  const maxPlayers = 8;
  const gridData = [...playersList];
  while (gridData.length < maxPlayers) {
    gridData.push({
      id: `placeholder-${gridData.length}`,
      username: 'Περιμένει παίκτη...',
      avatarUrl: null,
      isReady: false,
      isPlaceholder: true
    } as any);
  }

  // Determine ready gender-based text helper
  const getReadyText = (username: string, readyState: boolean) => {
    if (!readyState) return 'Αναμονή';
    const nameLower = username.toLowerCase();
    if (
      nameLower.endsWith('a') || 
      nameLower.endsWith('η') || 
      nameLower.endsWith('α') || 
      nameLower.endsWith('ι') || 
      nameLower.endsWith('υ') ||
      nameLower.endsWith('ω')
    ) {
      return 'Έτοιμη';
    }
    return 'Έτοιμος';
  };

  return (
    <View style={styles.container}>
      {/* Upper Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleLeaveRoom}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>ZOPRA</Text>
          <Text style={styles.headerSubtitle}>ΛΟΜΠΙ ΠΑΙΧΝΙΔΙΟΥ</Text>
        </View>

        <View style={styles.playersCountPill}>
          <Users size={16} color="#00C2A8" style={{ marginRight: 6 }} />
          <Text style={styles.playersCountText}>{playersList.length}/{maxPlayers}</Text>
        </View>
      </View>

      {/* Main Container */}
      <View style={styles.mainContent}>
        {/* Room Code Card */}
        <View style={styles.codeCard}>
          <View style={styles.codeLabelRow}>
            <View style={styles.codeLabelLine} />
            <Text style={styles.codeLabel}>ΚΩΔΙΚΟΣ ΔΩΜΑΤΙΟΥ</Text>
            <View style={styles.codeLabelLine} />
          </View>
          
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{code?.toUpperCase()}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
              <Copy size={20} color="#00C2A8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.copyButton} onPress={handleShare}>
              <Share2 size={20} color="#00C2A8" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.codeHint}>Μοιράσου αυτόν τον κωδικό ή το link με τους φίλους σου!</Text>
        </View>

        {/* Small Diamond Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerDiamond}>✦</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 3-Column Players Grid */}
        <FlatList
          data={gridData}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          style={styles.gridScroll}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            if ('isPlaceholder' in item && item.isPlaceholder) {
              return (
                <View style={[styles.playerCard, styles.placeholderCard]}>
                  <View style={styles.placeholderAvatarBorder}>
                    <User size={30} color="#2F354A" />
                  </View>
                  <Text style={styles.placeholderName} numberOfLines={2}>
                    Περιμένει παίκτη...
                  </Text>
                </View>
              );
            }

            return (
              <Animated.View 
                entering={FadeIn.delay(index * 60)}
                style={styles.playerCard}
              >
                <View style={styles.avatarContainer}>
                  <AvatarView avatarUrl={item.avatarUrl} size={64} style={styles.avatarBorder} />
                  {item.isReady && (
                    <Animated.View 
                      entering={ZoomIn}
                      style={styles.checkmarkBadge}
                    >
                      <Text style={styles.checkmarkIcon}>✓</Text>
                    </Animated.View>
                  )}
                </View>
                <Text style={styles.playerName} numberOfLines={1}>{item.username}</Text>
                <Text 
                  style={[
                    styles.playerReadyText, 
                    item.isReady ? styles.statusReady : styles.statusWaiting
                  ]}
                >
                  {getReadyText(item.username, !!item.isReady)}
                </Text>
              </Animated.View>
            );
          }}
        />

        {/* Settings Panel */}
        <View style={styles.settingsPanel}>
          <View style={styles.settingsInfoRow}>
            <Users size={20} color="#00C2A8" style={{ marginRight: 10 }} />
            <View style={styles.settingsTexts}>
              <Text style={styles.settingsMainText}>Παιχνίδι: Κλασική Πρόκληση</Text>
              <Text style={styles.settingsSubText}>
                Γύροι: {roomState.totalRounds} • Χρόνος: {roomState.timePerCategory}δ.
              </Text>
            </View>
            {isHost && (
              <TouchableOpacity style={styles.changeBtn} onPress={handleSettingsInfo}>
                <Text style={styles.changeBtnText}>Αλλαγή</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Bottom Actions Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isReady ? styles.actionButtonActive : styles.actionButtonInactive
            ]}
            onPress={handleToggleReady}
          >
            <View style={styles.readyButtonContent}>
              <CheckCircle size={22} color={isReady ? '#FFFFFF' : '#FFFFFF'} style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>
                {isReady ? 'Έτοιμος!' : 'Έτοιμος!'}
              </Text>
            </View>
          </TouchableOpacity>

          {isHost && (
            <TouchableOpacity
              style={styles.hostStartButton}
              onPress={handleStartGame}
            >
              <Text style={styles.hostStartButtonText}>Εκκίνηση Παιχνιδιού</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FF4D4D',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
    lineHeight: 28,
  },
  headerSubtitle: {
    color: '#00C2A8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  playersCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  playersCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  codeCard: {
    alignItems: 'center',
    marginTop: 8,
  },
  codeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 4,
  },
  codeLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#00C2A8',
    opacity: 0.4,
  },
  codeLabel: {
    color: '#00C2A8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginHorizontal: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  codeText: {
    color: '#FF4D4D',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 8,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#00C2A8',
    backgroundColor: '#111422',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  codeHint: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E233C',
  },
  dividerDiamond: {
    color: '#00C2A8',
    fontSize: 10,
    marginHorizontal: 12,
    opacity: 0.6,
  },
  gridScroll: {
    flex: 1,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playerCard: {
    width: CARD_WIDTH,
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarBorder: {
    borderWidth: 2.5,
    borderColor: '#00C2A8',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#38A169',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#111422',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 12,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
  },
  playerReadyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusReady: {
    color: '#00C2A8',
  },
  statusWaiting: {
    color: '#A0AEC0',
  },
  placeholderCard: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: '#2F354A',
  },
  placeholderAvatarBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#2F354A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  placeholderName: {
    color: '#4A5568',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  settingsPanel: {
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 12,
  },
  settingsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsTexts: {
    flex: 1,
  },
  settingsMainText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  settingsSubText: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  changeBtn: {
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0B0E17',
  },
  changeBtnText: {
    color: '#00C2A8',
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    borderRadius: 20,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonInactive: {
    backgroundColor: '#FF4D4D',
    shadowColor: '#FF4D4D',
  },
  actionButtonActive: {
    backgroundColor: '#00C2A8',
    shadowColor: '#00C2A8',
  },
  readyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  hostStartButton: {
    backgroundColor: '#FF4D4D',
    borderRadius: 20,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF595E',
  },
  hostStartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
}) as any;
