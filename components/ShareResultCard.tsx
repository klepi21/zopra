import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { translateCategory } from '@/utils/localization';

// Off-screen card that gets captured to a PNG by react-native-view-shot
// and shared via expo-sharing when the game finishes.
// It is rendered absolutely positioned outside the visible screen area.

export interface ShareCardPlayer {
  id: string;
  username: string;
  score: number;
}

interface ShareResultCardProps {
  players: ShareCardPlayer[]; // already sorted by score, descending
  letter: string;
  totalRounds: number;
  // Winner's answers from the final round: [categoryName, word]
  winnerAnswers: Array<[string, string]>;
}

const MEDALS = ['🥇', '🥈', '🥉'];

const ShareResultCard = forwardRef<View, ShareResultCardProps>(
  ({ players, letter, totalRounds, winnerAnswers }, ref) => {
    const winner = players[0];

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>⚡ ZOPRA</Text>
          <View style={styles.letterBadge}>
            <Text style={styles.letterBadgeText}>Γράμμα: {letter}</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Όνομα, Ζώο, Πράγμα · {totalRounds} {totalRounds === 1 ? 'γύρος' : 'γύροι'}
        </Text>

        {/* Standings */}
        <View style={styles.standings}>
          {players.slice(0, 4).map((player, idx) => (
            <View
              key={player.id}
              style={[styles.playerRow, idx === 0 && styles.winnerRow]}
            >
              <Text style={styles.medal}>{MEDALS[idx] ?? `#${idx + 1}`}</Text>
              <Text
                style={[styles.playerName, idx === 0 && styles.winnerName]}
                numberOfLines={1}
              >
                {player.username}
              </Text>
              {idx === 0 && <Text style={styles.crownEmoji}>👑</Text>}
              <Text style={[styles.playerScore, idx === 0 && styles.winnerScore]}>
                {player.score}
              </Text>
            </View>
          ))}
        </View>

        {/* Winner's words from the final round */}
        {winnerAnswers.length > 0 && winner && (
          <View style={styles.answersSection}>
            <Text style={styles.answersTitle}>
              Οι λέξεις του νικητή ✍️
            </Text>
            {winnerAnswers.slice(0, 6).map(([category, word]) => (
              <View key={category} style={styles.answerRow}>
                <Text style={styles.answerCategory}>{translateCategory(category)}</Text>
                <Text style={styles.answerWord} numberOfLines={1}>{word}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer CTA */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Παίξε κι εσύ δωρεάν 🎮 ZOPRA</Text>
        </View>
      </View>
    );
  }
);

ShareResultCard.displayName = 'ShareResultCard';

export default ShareResultCard;

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: '#0B0E17',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#1E233C',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  letterBadge: {
    backgroundColor: 'rgba(255, 77, 77, 0.15)',
    borderWidth: 1.5,
    borderColor: '#FF4D4D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  letterBadgeText: {
    color: '#FF4D4D',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#55627E',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 18,
  },
  standings: {
    gap: 8,
    marginBottom: 18,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  winnerRow: {
    borderColor: '#00C2A8',
    backgroundColor: 'rgba(0, 194, 168, 0.08)',
  },
  medal: {
    fontSize: 18,
    marginRight: 10,
    width: 28,
  },
  playerName: {
    flex: 1,
    color: '#A0AEC0',
    fontSize: 15,
    fontWeight: '800',
  },
  winnerName: {
    color: '#FFFFFF',
  },
  crownEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  playerScore: {
    color: '#A0AEC0',
    fontSize: 16,
    fontWeight: '900',
  },
  winnerScore: {
    color: '#00C2A8',
  },
  answersSection: {
    backgroundColor: '#111422',
    borderWidth: 1.5,
    borderColor: '#1E233C',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  answersTitle: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  answerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  answerCategory: {
    color: '#55627E',
    fontSize: 13,
    fontWeight: '700',
  },
  answerWord: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    maxWidth: 180,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E233C',
    paddingTop: 14,
  },
  footerText: {
    color: '#00C2A8',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
