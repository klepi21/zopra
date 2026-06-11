import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useRoomStore, PublicRoom } from '@/store/roomStore';
import { Globe, Users, ArrowLeft, RefreshCw } from '@/components/AppIcon';

export default function PublicRoomsScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { fetchPublicRooms, fetchOnlineCount, joinRoom, setupSocketListeners } = useRoomStore();

  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const [roomList, count] = await Promise.all([
        fetchPublicRooms(token),
        fetchOnlineCount(token),
      ]);
      setRooms(roomList);
      setOnlineCount(count);
    } catch (err: any) {
      setError('Αδύνατη η φόρτωση δωματίων. Δοκίμασε ξανά.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []); // Remove dependencies to prevent infinite loop

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh every 10 seconds while screen is open
  useEffect(() => {
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async (code: string) => {
    setJoiningCode(code);
    setError(null);
    try {
      const room = await joinRoom(code);
      setupSocketListeners();
      router.push(`/(game)/lobby/${room.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Αποτυχία σύνδεσης στο δωμάτιο');
      setJoiningCode(null);
    }
  };

  const renderRoom = ({ item }: { item: PublicRoom }) => {
    const isFull = item.playerCount >= item.maxPlayers;
    const isJoining = joiningCode === item.code;

    return (
      <View style={styles.roomCard}>
        <View style={styles.roomCardLeft}>
          <View style={styles.hostBadge}>
            <Globe size={16} color="#00C2A8" />
          </View>
          <View style={styles.roomInfo}>
            <Text style={styles.hostName} numberOfLines={1}>
              {item.hostName}
            </Text>
            <Text style={styles.roomMeta}>
              {item.totalRounds} {item.totalRounds === 1 ? 'γύρος' : 'γύροι'} · {item.timePerCategory}s ανά κατηγορία
            </Text>
          </View>
        </View>
        <View style={styles.roomCardRight}>
          <View style={styles.playerCount}>
            <Users size={12} color={isFull ? '#FF595E' : '#A0AEC0'} />
            <Text style={[styles.playerCountText, isFull && styles.playerCountFull]}>
              {item.playerCount}/{item.maxPlayers}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.joinBtn, (isFull || !!joiningCode) && styles.joinBtnDisabled]}
            onPress={() => handleJoin(item.code)}
            disabled={isFull || !!joiningCode}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.joinBtnText}>{isFull ? 'Γεμάτο' : 'Είσοδος'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Δημόσια Παιχνίδια</Text>
          {onlineCount > 0 && (
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{onlineCount} online</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => loadData()}>
          <RefreshCw size={18} color="#A0AEC0" />
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Room list */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#00C2A8" />
          <Text style={styles.loadingText}>Αναζήτηση παιχνιδιών...</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.code}
          renderItem={renderRoom}
          contentContainerStyle={[styles.listContent, rooms.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadData();
              }}
              tintColor="#00C2A8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎮</Text>
              <Text style={styles.emptyTitle}>Κανένα δημόσιο παιχνίδι</Text>
              <Text style={styles.emptySubtitle}>
                Δεν υπάρχει κανένα ανοιχτό παιχνίδι αυτή τη στιγμή.{'\n'}
                Δημιούργησε ένα και περίμενε τους παίκτες!
              </Text>
              <TouchableOpacity style={styles.createHintBtn} onPress={() => router.back()}>
                <Text style={styles.createHintBtnText}>Δημιούργησε Παιχνίδι</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D2E',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#111422',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E233C',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 194, 168, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 168, 0.3)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C2A8',
    marginRight: 5,
  },
  onlineText: {
    color: '#00C2A8',
    fontSize: 11,
    fontWeight: '700',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#111422',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E233C',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 89, 94, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 89, 94, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#FF595E',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyList: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '600',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  roomCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hostBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 194, 168, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 194, 168, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
  },
  hostName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  roomMeta: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
  },
  roomCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  playerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerCountText: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
  },
  playerCountFull: {
    color: '#FF595E',
  },
  joinBtn: {
    backgroundColor: '#00C2A8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  joinBtnDisabled: {
    backgroundColor: '#1E233C',
    opacity: 0.7,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  createHintBtn: {
    backgroundColor: '#FF4D4D',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  createHintBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
