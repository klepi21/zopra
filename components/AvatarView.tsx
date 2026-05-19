import React from 'react';
import { StyleSheet, View, ViewStyle, Image } from 'react-native';
import { Zap, Brain, Shield, Wind, Flame, Swords, User } from './AppIcon';

interface AvatarViewProps {
  avatarUrl: string | null;
  size?: number;
  style?: any;
}

export default function AvatarView({ avatarUrl, size = 50, style }: AvatarViewProps) {
  const isHttpUrl = avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'));

  if (isHttpUrl) {
    const radius = size / 2;
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
          style,
        ]}
      />
    );
  }

  let heroId = '';
  let colors = ['#00C2A8', '#16213E']; // Accent and Surface fallbacks

  if (avatarUrl) {
    try {
      const data = JSON.parse(avatarUrl);
      if (data) {
        if (Array.isArray(data.colors)) {
          colors = data.colors;
        }
        heroId = data.id || '';
      }
    } catch {
      // not JSON
    }
  }

  const radius = size / 2;
  const iconSize = size * 0.55;

  let IconComponent = User;
  switch (heroId) {
    case 'zeus':
      IconComponent = Zap;
      break;
    case 'athena':
      IconComponent = Brain;
      break;
    case 'achilles':
      IconComponent = Shield;
      break;
    case 'pegasus':
      IconComponent = Wind;
      break;
    case 'medusa':
      IconComponent = Flame;
      break;
    case 'minotaur':
      IconComponent = Swords;
      break;
    default:
      IconComponent = User;
  }

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors[0],
        },
        style,
      ]}
    >
      <IconComponent size={iconSize} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
