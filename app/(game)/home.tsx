import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useUserStore, UserProfile } from '@/store/userStore';
import { useRoomStore } from '@/store/roomStore';
import { useSoundStore } from '@/store/soundStore';
import { useRouter } from 'expo-router';
import AvatarView from '@/components/AvatarView';
import AdBanner from '@/components/AdBanner';
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.log('expo-image-picker load failed');
}
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  ScrollView,
  FlatList
} from 'react-native';
import {
  LogOut,
  Settings,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Lock,
  Trophy,
  Target,
  Home,
  User,
  Zap,
  Brain,
  Shield,
  Wind,
  Flame,
  Swords,
  Volume2,
  VolumeX,
  Award
} from '@/components/AppIcon';

const PRESET_AVATARS = [
  { id: 'zeus', name: 'Δίας', emoji: '⚡', gradient: ['#FF4D4D', '#0F3460'] },
  { id: 'athena', name: 'Αθηνά', emoji: '🦉', gradient: ['#00C2A8', '#0F3460'] },
  { id: 'achilles', name: 'Αχιλλέας', emoji: '🛡️', gradient: ['#FF595E', '#0F3460'] },
  { id: 'pegasus', name: 'Πήγασος', emoji: '🦄', gradient: ['#6BCB77', '#0F3460'] },
  { id: 'medusa', name: 'Μέδουσα', emoji: '🐍', gradient: ['#FFB347', '#0F3460'] },
  { id: 'minotaur', name: 'Μινώταυρος', emoji: '🐂', gradient: ['#A0AEC0', '#0F3460'] },
];

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const { profile, setProfile, reset: resetUserStore } = useUserStore();
  const { createRoom, joinRoom, isLoading, error: roomError, setupSocketListeners } = useRoomStore();
  const { isMuted, toggleMute } = useSoundStore();

  const [activeTab, setActiveTab] = useState<'HOME' | 'LEADERBOARD' | 'PROFILE' | 'SETTINGS'>('HOME');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Custom game configurations for creation
  const [totalRounds, setTotalRounds] = useState(1);
  const [timePerCategory, setTimePerCategory] = useState(12);

  // Modals Visibility
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  // Leaderboard State
  const [leaderboardData, setLeaderboardData] = useState<UserProfile[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [hasMoreLeaderboard, setHasMoreLeaderboard] = useState(true);

  // Profile State
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [isMatchesLoading, setIsMatchesLoading] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  // Fetch Leaderboard
  const fetchLeaderboard = async (page = 1, append = false) => {
    if (isLeaderboardLoading && page === 1) return; // Prevent concurrent fetch of same page
    if (page === 1) setIsLeaderboardLoading(true);
    
    try {
      const token = await getToken();
      if (!token) return;
      const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';
      const res = await fetch(`${SERVER_URL}/api/users/leaderboard?page=${page}&limit=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length < 20) {
          setHasMoreLeaderboard(false);
        }
        
        if (append) {
          setLeaderboardData((prev) => {
            // Filter out duplicates just in case
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = data.filter((d: UserProfile) => !existingIds.has(d.id));
            return [...prev, ...newItems];
          });
        } else {
          setLeaderboardData(data);
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      if (page === 1) setIsLeaderboardLoading(false);
    }
  };

  const fetchMatches = async () => {
    setIsMatchesLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';
      const res = await fetch(`${SERVER_URL}/api/users/matches`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentMatches(data);
      }
    } catch (e) {
      console.error('Error fetching matches:', e);
    } finally {
      setIsMatchesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'LEADERBOARD') {
      setLeaderboardPage(1);
      setHasMoreLeaderboard(true);
      fetchLeaderboard(1, false);
    } else if (activeTab === 'PROFILE') {
      fetchMatches();
    }
  }, [activeTab]);

  const handleSignOut = async () => {
    try {
      resetUserStore();
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleUpdateUsername = async () => {
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Το όνομα χρήστη πρέπει να έχει τουλάχιστον 2 χαρακτήρες');
      return;
    }
    setIsUpdatingUsername(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';
      const res = await fetch(`${SERVER_URL}/api/users/username`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError('Αυτό το όνομα χρήστη χρησιμοποιείται ήδη');
      } else if (!res.ok) {
        setError(data.error || 'Αποτυχία ενημέρωσης ονόματος χρήστη');
      } else {
        setProfile(data);
        setIsEditingUsername(false);
        setNewUsername('');
      }
    } catch (err: any) {
      setError(err.message || 'Σφάλμα σύνδεσης');
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleCreateRoom = async () => {
    setError(null);
    try {
      const room = await createRoom({ totalRounds, timePerCategory });
      setupSocketListeners();
      setIsCreateModalVisible(false);
      router.push(`/(game)/lobby/${room.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Αποτυχία δημιουργίας δωματίου');
    }
  };

  const handleJoinRoom = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setError('Παρακαλώ εισάγετε έναν έγκυρο κωδικό 6 χαρακτήρων');
      return;
    }

    setError(null);
    try {
      const room = await joinRoom(code);
      setupSocketListeners();
      setIsJoinModalVisible(false);
      router.push(`/(game)/lobby/${room.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Αποτυχία σύνδεσης στο δωμάτιο');
    }
  };

  const handleUpdateAvatar = async (avatarPreset: typeof PRESET_AVATARS[0]) => {
    setIsUpdatingAvatar(true);
    try {
      const token = await getToken();
      if (!token) return;

      const avatarUrl = JSON.stringify({
        id: avatarPreset.id,
        emoji: avatarPreset.emoji,
        colors: avatarPreset.gradient,
      });

      const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: profile?.username,
          avatar_url: avatarUrl,
        }),
      });

      if (res.ok) {
        const updatedProfile = await res.json();
        setProfile(updatedProfile);
      }
    } catch (err) {
      console.error('Error updating avatar:', err);
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handlePickAndUploadPhoto = async () => {
    setIsUpdatingAvatar(true);
    setError(null);
    try {
      if (!ImagePicker || !ImagePicker.requestMediaLibraryPermissionsAsync) {
        setError('Ο επιλογέας φωτογραφιών δεν είναι διαθέσιμος. Παρακαλώ επανεκκινήστε το Expo Go ή κάντε native build.');
        setIsUpdatingAvatar(false);
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Απαιτείται άδεια πρόσβασης στη βιβλιοθήκη φωτογραφιών');
        setIsUpdatingAvatar(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsUpdatingAvatar(false);
        return;
      }

      const asset = result.assets[0];
      if (!user) {
        setError('Ο χρήστης Clerk δεν είναι συνδεδεμένος');
        setIsUpdatingAvatar(false);
        return;
      }

      const base64Data = asset.base64;
      if (!base64Data) {
        setError('Αποτυχία ανάγνωσης δεδομένων εικόνας');
        setIsUpdatingAvatar(false);
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const fileData = `data:${mimeType};base64,${base64Data}`;

      const freshUser = await user.setProfileImage({
        file: fileData,
      });

      const token = await getToken();
      if (!token) return;

      const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: profile?.username,
          avatar_url: freshUser.publicUrl || user.imageUrl,
        }),
      });

      if (res.ok) {
        const updatedProfile = await res.json();
        setProfile(updatedProfile);
      }
    } catch (err: any) {
      console.error('Error uploading profile picture:', err);
      setError(err.message || 'Αποτυχία μεταφόρτωσης εικόνας');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const activeError = error || roomError;

  const gamesPlayed = profile?.games_played ?? 0;
  const wins = profile?.wins ?? 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const totalScoreFormatted = (profile?.total_score ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // Parse current user avatar id
  let currentAvatarId = '';
  if (profile?.avatar_url) {
    try {
      const parsed = JSON.parse(profile.avatar_url);
      currentAvatarId = parsed.id || '';
    } catch {
      // not JSON
    }
  }

  // Render the current active page content
  const renderContent = () => {
    switch (activeTab) {
      case 'HOME':
        return (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <Text style={styles.logoText}>ZOPRA</Text>
              <View style={styles.logoSubtitleRow}>
                <View style={styles.subtitleLine} />
                <Text style={styles.logoSubtitleText}>Όνομα, Ζώο, Πράγμα</Text>
                <View style={styles.subtitleLine} />
              </View>
            </View>

            {/* Hero Illustration */}
            <View style={styles.heroContainer}>
              <Image
                source={require('@/assets/images/mainscreenimage.png')}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Create Game Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setError(null);
                  setIsCreateModalVisible(true);
                }}
                disabled={isLoading}
              >
                <View style={styles.actionButtonContent}>
                  <View style={styles.plusCircleContainer}>
                    <Text style={styles.plusSign}>+</Text>
                  </View>
                  <Text style={styles.actionButtonText}>Δημιουργία Παιχνιδιού</Text>
                </View>
              </TouchableOpacity>

              {/* Join Game Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setError(null);
                  setRoomCode('');
                  setIsJoinModalVisible(true);
                }}
              >
                <View style={styles.actionButtonContent}>
                  <Lock size={20} color="#FFFFFF" style={styles.lockIcon} />
                  <Text style={styles.actionButtonText}>Είσοδος με Κωδικό</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Stats Panel */}
            <View style={styles.statsPanel}>
              <View style={styles.statItem}>
                <Trophy size={28} color="#00C2A8" />
                <Text style={styles.statValue}>{gamesPlayed}</Text>
                <Text style={styles.statLabel}>Παιχνίδια Παίχτηκαν</Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statItem}>
                <Target size={28} color="#00C2A8" />
                <Text style={styles.statValue}>{winRate}%</Text>
                <Text style={styles.statLabel}>Ποσοστό Νικών</Text>
              </View>
            </View>
            
            {/* Banner Ad */}
            <AdBanner />
            
          </ScrollView>
        );

      case 'LEADERBOARD':
        return (
          <View style={styles.pageContainer}>
            <View style={styles.pageHeader}>
              <Trophy size={36} color="#00C2A8" style={{ marginBottom: 8 }} />
              <Text style={styles.pageTitle}>Παγκόσμια Κατάταξη</Text>
              <Text style={styles.pageSubtitle}>Ταξινόμηση ανά Ποσοστό Νικών</Text>
            </View>

            {isLeaderboardLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00C2A8" />
              </View>
            ) : (
              <FlatList
                data={[...leaderboardData].sort((a, b) => {
                  const aRate = (a.games_played ?? 0) > 0 ? (a.wins ?? 0) / (a.games_played ?? 1) : 0;
                  const bRate = (b.games_played ?? 0) > 0 ? (b.wins ?? 0) / (b.games_played ?? 1) : 0;
                  if (bRate !== aRate) return bRate - aRate;
                  return (b.total_score ?? 0) - (a.total_score ?? 0);
                })}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.leaderboardList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => {
                  const isSelf = item.clerk_id === profile?.clerk_id;
                  const gp = item.games_played ?? 0;
                  const w = item.wins ?? 0;
                  const wr = gp > 0 ? Math.round((w / gp) * 100) : 0;
                  const scoreFormatted = (item.total_score ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                  return (
                    <View style={[styles.leaderboardRow, isSelf && styles.leaderboardRowSelf]}>
                      <Text style={[styles.leaderboardRank, index < 3 && styles.leaderboardTopRank]}>
                        #{index + 1}
                      </Text>
                      <AvatarView avatarUrl={item.avatar_url} size={36} style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.leaderboardName, isSelf && styles.leaderboardNameSelf]} numberOfLines={1}>
                          {item.username} {isSelf && '(Εσείς)'}
                        </Text>
                        <Text style={{ color: '#A0AEC0', fontSize: 11, fontWeight: '700' }}>
                          {gp} αγώνες · {wr}% νίκες
                        </Text>
                      </View>
                      <Text style={styles.leaderboardScore}>{scoreFormatted} ✦</Text>
                    </View>
                  );
                }}
                onEndReached={() => {
                  if (hasMoreLeaderboard && !isLeaderboardLoading) {
                    const nextPage = leaderboardPage + 1;
                    setLeaderboardPage(nextPage);
                    fetchLeaderboard(nextPage, true);
                  }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                  hasMoreLeaderboard && leaderboardData.length > 0 ? (
                    <ActivityIndicator size="small" color="#00C2A8" style={{ marginVertical: 16 }} />
                  ) : null
                )}
              />
            )}
            
            {/* Banner Ad */}
            <AdBanner />
            
          </View>
        );

      case 'PROFILE': {
        return (
          <ScrollView contentContainerStyle={styles.profileScrollContent} showsVerticalScrollIndicator={false}>
            {/* Header: Logo and Settings Gear */}
            <View style={styles.profileHeaderBar}>
              <View>
                <Text style={styles.logoTopSmall}>Z O P R A</Text>
                <Text style={styles.taglineSmall}>♦ ΤΟ ΕΛΛΗΝΙΚΟ ΠΑΙΧΝΙΔΙ ΛΕΞΕΩΝ ♦</Text>
              </View>
              <TouchableOpacity
                style={styles.settingsGearBtn}
                onPress={() => setActiveTab('SETTINGS')}
              >
                <Settings size={22} color="#A0AEC0" />
              </TouchableOpacity>
            </View>

            {/* Avatar & Score */}
            <View style={styles.profileHeaderSection}>
              <View style={styles.avatarContainer}>
                <AvatarView avatarUrl={profile?.avatar_url || null} size={110} style={styles.largeAvatar} />
                <TouchableOpacity
                  style={styles.editAvatarBtn}
                  onPress={handlePickAndUploadPhoto}
                  disabled={isUpdatingAvatar}
                >
                  {isUpdatingAvatar ? (
                    <ActivityIndicator size="small" color="#0B0F19" />
                  ) : (
                    <User size={16} color="#0B0F19" /> 
                  )}
                </TouchableOpacity>
              </View>
              
              {error && (
                <Text style={{ color: '#FF595E', fontSize: 12, marginBottom: 12, textAlign: 'center', fontWeight: '700' }}>
                  {error}
                </Text>
              )}
              
              <Text style={styles.profileUsernameText}>{profile?.username || 'Παίκτης'}</Text>
              <View style={styles.pointsContainerLarge}>
                <Text style={styles.diamondIconLarge}>✦</Text>
                <Text style={styles.profileScoreSub}>{totalScoreFormatted}</Text>
              </View>
            </View>

            {/* 2x2 Stats Grid */}
            <View style={styles.statsGrid2x2}>
              {/* Wins */}
              <View style={styles.statBox2x2}>
                <View style={styles.statBoxHeader}>
                  <Trophy size={28} color="#00C2A8" />
                  <View style={styles.statBoxTextCol}>
                    <Text style={styles.statBoxLabel}>Νίκες</Text>
                    <Text style={[styles.statBoxVal, { color: '#00C2A8' }]}>{wins}</Text>
                  </View>
                </View>
              </View>

              {/* Games */}
              <View style={styles.statBox2x2}>
                <View style={styles.statBoxHeader}>
                  <User size={28} color="#A0AEC0" />
                  <View style={styles.statBoxTextCol}>
                    <Text style={styles.statBoxLabel}>Παιχνίδια</Text>
                    <Text style={[styles.statBoxVal, { color: '#FFFFFF' }]}>{gamesPlayed}</Text>
                  </View>
                </View>
              </View>

              {/* Total Score */}
              <View style={styles.statBox2x2}>
                <View style={styles.statBoxHeader}>
                  <Flame size={28} color="#FF3B5C" />
                  <View style={styles.statBoxTextCol}>
                    <Text style={styles.statBoxLabel}>Σύνολο Πόντων</Text>
                    <Text style={[styles.statBoxVal, { color: '#FF3B5C' }]}>{totalScoreFormatted}</Text>
                  </View>
                </View>
              </View>

              {/* Win Rate */}
              <View style={styles.statBox2x2}>
                <View style={styles.statBoxHeader}>
                  <Target size={28} color="#00C2A8" />
                  <View style={styles.statBoxTextCol}>
                    <Text style={styles.statBoxLabel}>Νίκη %</Text>
                    <Text style={[styles.statBoxVal, { color: '#00C2A8' }]}>{winRate}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Username Change Section */}
            <View style={{ width: '100%', marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ marginRight: 8, fontSize: 16 }}>✏️</Text>
                <Text style={styles.sectionTitle}>Αλλαγή Ονόματος</Text>
              </View>
              
              <View style={{ backgroundColor: '#111422', borderWidth: 1.5, borderColor: '#1E233C', borderRadius: 20, padding: 16 }}>
                {isEditingUsername ? (
                  <View>
                    <Text style={{ color: '#A0AEC0', fontSize: 12, fontWeight: '800', marginBottom: 8, letterSpacing: 1 }}>ΝΕΟ ΟΝΟΜΑ ΧΡΗΣΤΗ</Text>
                    <TextInput
                      value={newUsername}
                      onChangeText={setNewUsername}
                      placeholder={profile?.username || 'Νέο όνομα...'}
                      placeholderTextColor="#55627E"
                      autoFocus
                      maxLength={20}
                      style={{
                        backgroundColor: '#0B0E17',
                        borderWidth: 1.5,
                        borderColor: '#00C2A8',
                        borderRadius: 12,
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '800',
                        padding: 12,
                        marginBottom: 12,
                      }}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#1E233C', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                        onPress={() => { setIsEditingUsername(false); setNewUsername(''); setError(null); }}
                      >
                        <Text style={{ color: '#A0AEC0', fontSize: 13, fontWeight: '800' }}>Ακύρωση</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#00C2A8', borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: isUpdatingUsername ? 0.6 : 1 }}
                        onPress={handleUpdateUsername}
                        disabled={isUpdatingUsername}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                          {isUpdatingUsername ? 'Αποθήκευση...' : 'Αποθήκευση'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ color: '#A0AEC0', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>ΟΝΟΜΑ ΧΡΗΣΤΗ</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>{profile?.username || 'Παίκτης'}</Text>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#1E233C', borderWidth: 1.5, borderColor: '#3A4268', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
                      onPress={() => { setIsEditingUsername(true); setNewUsername(profile?.username || ''); }}
                    >
                      <Text style={{ color: '#00C2A8', fontSize: 12, fontWeight: '800' }}>Αλλαγή</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Match History Section */}
            <View style={styles.matchHistoryHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ marginRight: 8, fontSize: 16 }}>🕒</Text>
                <Text style={styles.sectionTitle}>Πρόσφατα Παιχνίδια</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>Προβολή όλων {'>'}</Text>
              </TouchableOpacity>
            </View>

            {isMatchesLoading ? (
              <ActivityIndicator size="small" color="#00C2A8" style={{ marginVertical: 20 }} />
            ) : recentMatches.length === 0 ? (
              <View style={styles.noMatchesCard}>
                <Text style={styles.noMatchesText}>Δεν υπάρχουν πρόσφατοι αγώνες.</Text>
              </View>
            ) : (
              <View style={styles.matchListContainer}>
                {recentMatches.map((match, index) => {
                  const isWinner = match.rank === 1;
                  const formattedDate = new Date(match.finished_at).toLocaleDateString('el-GR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });
                  const formattedTime = new Date(match.finished_at).toLocaleTimeString('el-GR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <TouchableOpacity key={match.room_id || index} style={styles.newMatchCard}>
                      <View style={styles.newMatchCardLeft}>
                        {/* Game Icon */}
                        <View style={[styles.opponentAvatar, { backgroundColor: isWinner ? '#1e3a8a' : '#831843' }]}>
                          <Swords size={20} color="#FFFFFF" />
                        </View>
                        
                        <View style={{ marginLeft: 12 }}>
                          <Text style={styles.opponentNameText}>Δωμάτιο: {match.code}</Text>
                          <Text style={[styles.matchResultText, { color: isWinner ? '#00C2A8' : '#FF3B5C' }]}>
                            {isWinner ? `Νίκη (1ος/${match.playersCount})` : `Ήττα (${match.rank}ος/${match.playersCount})`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.newMatchCardRight}>
                        <Text style={[styles.matchScoreText, { color: isWinner ? '#00C2A8' : '#FF3B5C' }]}>
                          +{match.myScore} ✦
                        </Text>
                        <View style={styles.matchDateCol}>
                          <Text style={styles.matchDateText}>{formattedDate}</Text>
                          <Text style={styles.matchDateText}>{formattedTime}</Text>
                        </View>
                        <Text style={styles.matchChevron}>{'>'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        );
      }

      case 'SETTINGS':
        return (
          <View style={styles.pageContainer}>
            <View style={styles.pageHeader}>
              <Settings size={36} color="#00C2A8" style={{ marginBottom: 8 }} />
              <Text style={styles.pageTitle}>Ρυθμίσεις</Text>
              <Text style={styles.pageSubtitle}>Διαχείριση λογαριασμού ZOPRA</Text>
            </View>

            <View style={styles.settingsContent}>
              <View style={styles.settingCard}>
                <Text style={styles.settingCardTitle}>Στοιχεία Λογαριασμού</Text>
                <View style={styles.settingCardRow}>
                  <Text style={styles.settingCardLabel}>Όνομα χρήστη:</Text>
                  <Text style={styles.settingCardValue}>{profile?.username}</Text>
                </View>
                <View style={styles.settingCardRow}>
                  <Text style={styles.settingCardLabel}>Clerk ID:</Text>
                  <Text style={styles.settingCardValue} numberOfLines={1} ellipsizeMode="middle">
                    {profile?.clerk_id}
                  </Text>
                </View>
              </View>

              <View style={[styles.settingCard, { marginTop: 16 }]}>
                <Text style={styles.settingCardTitle}>Εφέ Ήχου & Δονήσεις</Text>
                <View style={styles.settingCardRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isMuted ? (
                      <VolumeX size={20} color="#FF595E" style={{ marginRight: 8 }} />
                    ) : (
                      <Volume2 size={20} color="#00C2A8" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.settingCardLabel}>Ήχος Παιχνιδιού:</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      isMuted ? styles.toggleButtonOff : styles.toggleButtonOn
                    ]}
                    onPress={toggleMute}
                  >
                    <Text style={styles.toggleButtonText}>
                      {isMuted ? 'Ανενεργός' : 'Ενεργός'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={[styles.signOutButton, { marginTop: 24 }]} onPress={handleSignOut}>
                <LogOut size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.signOutButtonText}>Αποσύνδεση λογαριασμού</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Profile / Header Row */}
      {activeTab === 'HOME' && (
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <View style={styles.profileTextContainer}>
              <Text style={styles.username}>{profile?.username || 'Παίκτης'}</Text>
              <View style={styles.pointsContainer}>
                <Text style={styles.pointsText}>{totalScoreFormatted}</Text>
                <Text style={styles.diamondIcon}>✦</Text>
              </View>
            </View>
            <AvatarView avatarUrl={profile?.avatar_url || null} size={48} style={styles.avatarBorder} />
          </View>
        </View>
      )}

      {/* Main Page Area */}
      <View style={{ flex: 1, paddingBottom: 72 }}>
        {renderContent()}
      </View>

      {/* MODAL: Join Room */}
      <Modal
        visible={isJoinModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsJoinModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <Text style={styles.modalTitle}>Είσοδος με Κωδικό</Text>
              <Text style={styles.modalSubtitle}>Εισάγετε τον 6-ψήφιο κωδικό δωματίου για να παίξετε</Text>

              {activeError && (
                <View style={styles.errorContainer}>
                  <AlertTriangle size={18} color="#FF595E" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{activeError}</Text>
                </View>
              )}

              <TextInput
                style={styles.modalInput}
                placeholder="ΚΩΔΙΚΟΣ 6 ΧΑΡΑΚΤΗΡΩΝ"
                placeholderTextColor="#A0AEC0"
                autoCapitalize="characters"
                maxLength={6}
                autoCorrect={false}
                value={roomCode}
                onChangeText={setRoomCode}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setIsJoinModalVisible(false)}
                >
                  <Text style={styles.modalBtnTextCancel}>Ακύρωση</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnConfirm]}
                  onPress={handleJoinRoom}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalBtnTextConfirm}>Σύνδεση</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* MODAL: Create Game Customization */}
      <Modal
        visible={isCreateModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Δημιουργία Παιχνιδιού</Text>
            <Text style={styles.modalSubtitle}>Επιλέξτε τις ρυθμίσεις του παιχνιδιού σας</Text>

            {activeError && (
              <View style={styles.errorContainer}>
                <AlertTriangle size={18} color="#FF595E" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{activeError}</Text>
              </View>
            )}

            <View style={styles.settingOptionRow}>
              <Text style={styles.settingOptionLabel}>Συνολικοί Γύροι:</Text>
              <View style={styles.optionGroup}>
                {[1, 3, 5, 7].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.optionBtn, totalRounds === num && styles.optionBtnActive]}
                    onPress={() => setTotalRounds(num)}
                  >
                    <Text style={[styles.optionText, totalRounds === num && styles.optionTextActive]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingOptionRow}>
              <Text style={styles.settingOptionLabel}>Χρόνος ανά Κατηγορία:</Text>
              <View style={styles.optionGroup}>
                {[12, 30, 60].map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.optionBtn, timePerCategory === sec && styles.optionBtnActive]}
                    onPress={() => setTimePerCategory(sec)}
                  >
                    <Text style={[styles.optionText, timePerCategory === sec && styles.optionTextActive]}>
                      {sec}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setIsCreateModalVisible(false)}
                disabled={isLoading}
              >
                <Text style={styles.modalBtnTextCancel}>Ακύρωση</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleCreateRoom}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnTextConfirm}>Δημιουργία</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Bottom Tab Navigation Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('HOME')}>
          <Home size={22} color={activeTab === 'HOME' ? '#00C2A8' : '#A0AEC0'} />
          <Text style={[styles.tabLabel, activeTab === 'HOME' && styles.tabLabelActive]}>Αρχική</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('LEADERBOARD')}>
          <Trophy size={22} color={activeTab === 'LEADERBOARD' ? '#00C2A8' : '#A0AEC0'} />
          <Text style={[styles.tabLabel, activeTab === 'LEADERBOARD' && styles.tabLabelActive]}>Κατάταξη</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('PROFILE')}>
          <User size={22} color={activeTab === 'PROFILE' ? '#00C2A8' : '#A0AEC0'} />
          <Text style={[styles.tabLabel, activeTab === 'PROFILE' && styles.tabLabelActive]}>Προφίλ</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('SETTINGS')}>
          <Settings size={22} color={activeTab === 'SETTINGS' ? '#00C2A8' : '#A0AEC0'} />
          <Text style={[styles.tabLabel, activeTab === 'SETTINGS' && styles.tabLabelActive]}>Ρυθμίσεις</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E17',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
    paddingBottom: 12,
    alignItems: 'flex-end',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileTextContainer: {
    marginRight: 12,
    alignItems: 'flex-end',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pointsText: {
    color: '#00C2A8',
    fontSize: 14,
    fontWeight: '800',
  },
  diamondIcon: {
    color: '#00C2A8',
    fontSize: 12,
    marginLeft: 4,
  },
  avatarBorder: {
    borderWidth: 2,
    borderColor: '#00C2A8',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  logoText: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FF4D4D',
    letterSpacing: 8,
    textTransform: 'uppercase',
  },
  logoSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    width: '100%',
  },
  subtitleLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#00C2A8',
    opacity: 0.8,
  },
  logoSubtitleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00C2A8',
    letterSpacing: 2,
    marginHorizontal: 12,
  },
  heroContainer: {
    width: 250,
    height: 250,
    marginVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  actionsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 28,
  },
  actionButton: {
    backgroundColor: '#FF4D4D',
    borderRadius: 20,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#FF4D4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCircleContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  plusSign: {
    color: '#FF4D4D',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  lockIcon: {
    marginRight: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1A1D2E',
    borderRadius: 24,
    paddingVertical: 20,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00C2A8',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 4,
    fontWeight: '600',
  },
  statsDivider: {
    width: 1.5,
    height: '60%',
    backgroundColor: '#1A1D2E',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#0E111E',
    borderTopWidth: 1.5,
    borderTopColor: '#1A1D2E',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 12 : 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A0AEC0',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#00C2A8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111422',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#21263F',
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#A0AEC0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 89, 94, 0.1)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FF595E',
    width: '100%',
  },
  errorText: {
    color: '#FF595E',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#090A10',
    borderRadius: 16,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#21263F',
    marginBottom: 24,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#1C1F30',
  },
  modalBtnConfirm: {
    backgroundColor: '#FF4D4D',
  },
  modalBtnTextCancel: {
    color: '#A0AEC0',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnTextConfirm: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  settingOptionRow: {
    width: '100%',
    marginBottom: 20,
  },
  settingOptionLabel: {
    fontSize: 15,
    color: '#A0AEC0',
    fontWeight: '700',
    marginBottom: 8,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  optionBtn: {
    flex: 1,
    backgroundColor: '#090A10',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#21263F',
    alignItems: 'center',
  },
  optionBtnActive: {
    borderColor: '#00C2A8',
    backgroundColor: '#111422',
  },
  optionText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#00C2A8',
  },
  signOutButton: {
    flexDirection: 'row',
    backgroundColor: '#FF4D4D',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  pageContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  pageHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#A0AEC0',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardList: {
    paddingBottom: 40,
  },
  leaderboardRow: {
    flexDirection: 'row',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  leaderboardRowSelf: {
    borderColor: '#00C2A8',
    backgroundColor: 'rgba(0, 194, 168, 0.08)',
  },
  leaderboardRank: {
    fontSize: 16,
    fontWeight: '900',
    color: '#A0AEC0',
    width: 40,
  },
  leaderboardTopRank: {
    color: '#FF4D4D',
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  leaderboardNameSelf: {
    fontWeight: '900',
  },
  leaderboardScore: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00C2A8',
  },
  profileScrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  // Profile Header Row 
  profileHeaderBar: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: -20,
  },
  logoTopSmall: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FF4D4D',
    letterSpacing: 4,
    textShadowColor: 'rgba(255, 77, 77, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  taglineSmall: {
    fontSize: 8,
    color: '#00C2A8',
    fontWeight: '600',
    letterSpacing: 1,
  },
  settingsGearBtn: {
    backgroundColor: '#111422',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E233C',
  },

  profileHeaderSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  largeAvatar: {
    borderWidth: 3,
    borderColor: '#00C2A8',
    shadowColor: '#00C2A8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00C2A8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0F19',
  },
  profileUsernameText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pointsContainerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  diamondIconLarge: {
    color: '#00C2A8',
    fontSize: 16,
    marginRight: 6,
  },
  profileScoreSub: {
    fontSize: 18,
    color: '#00C2A8',
    fontWeight: '800',
    textAlign: 'center',
  },

  // 2x2 Stats Grid
  statsGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
    width: '100%',
  },
  statBox2x2: {
    width: '48%',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1A1D2E',
    borderRadius: 16,
    padding: 16,
  },
  statBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBoxTextCol: {
    flex: 1,
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#A0AEC0',
    fontWeight: '600',
  },
  statBoxVal: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  // Match History
  matchHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#00C2A8',
    fontSize: 13,
    fontWeight: '700',
  },
  matchListContainer: {
    width: '100%',
    backgroundColor: '#111422',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1A1D2E',
    overflow: 'hidden',
  },
  newMatchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D2E',
  },
  newMatchCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  opponentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opponentNameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  matchResultText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  newMatchCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchScoreText: {
    fontSize: 16,
    fontWeight: '900',
    marginRight: 16,
  },
  matchDateCol: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  matchDateText: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '600',
  },
  matchChevron: {
    color: '#A0AEC0',
    fontSize: 16,
    fontWeight: '700',
  },
  avatarSelectionContainer: {
    width: '100%',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 24,
    padding: 20,
  },
  avatarSelectTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  avatarSelectSub: {
    fontSize: 12,
    color: '#A0AEC0',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  avatarPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarPickerWrapper: {
    width: '30%',
    backgroundColor: '#090A10',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#21263F',
    paddingVertical: 12,
    alignItems: 'center',
  },
  avatarPickerWrapperSelected: {
    borderColor: '#00C2A8',
    backgroundColor: 'rgba(0, 194, 168, 0.08)',
  },
  avatarPickerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarPickerName: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  settingsContent: {
    flex: 1,
    width: '100%',
    marginTop: 12,
  },
  settingCard: {
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    padding: 20,
  },
  settingCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  settingCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingCardLabel: {
    color: '#A0AEC0',
    fontWeight: '700',
    fontSize: 14,
  },
  settingCardValue: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    maxWidth: '60%',
  },
  uploadPhotoBtn: {
    backgroundColor: '#00C2A8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    shadowColor: '#00C2A8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadPhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  toggleButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonOn: {
    backgroundColor: '#00C2A8',
  },
  toggleButtonOff: {
    backgroundColor: '#1E233C',
    borderWidth: 1,
    borderColor: '#3A4268',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  achievementsScroll: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 8,
  },
  achievementCard: {
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    width: 120,
    padding: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  achievementCardLocked: {
    borderColor: '#141727',
    opacity: 0.5,
  },
  achievementIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achievementTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementTitleLocked: {
    color: '#7F8FA4',
  },
  achievementDesc: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  noMatchesCard: {
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMatchesText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '700',
  },
  matchCard: {
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchCardRight: {
    alignItems: 'flex-end',
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeGold: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  rankBadgeNormal: {
    backgroundColor: '#1E233C',
    borderWidth: 1.5,
    borderColor: '#3A4268',
  },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  rankBadgeTextGold: {
    color: '#FFD700',
  },
  rankBadgeTextNormal: {
    color: '#FFFFFF',
  },
  matchCode: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  matchDate: {
    color: '#7F8FA4',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  matchScore: {
    color: '#00C2A8',
    fontSize: 16,
    fontWeight: '900',
  },
  matchPlayers: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
