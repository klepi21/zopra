import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mock react-native-reanimated completely manually to avoid native worklet dependency resolution issues
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    default: View,
    View: View,
    Text: View,
    ScrollView: View,
    Image: View,
    FadeIn: {
      delay: () => ({}),
    },
    FadeOut: {},
    Layout: {
      springify: () => ({}),
    },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: () => ({}),
    withSpring: (val: any) => val,
    withTiming: (val: any) => val,
    withSequence: (...args: any[]) => args[0],
    withRepeat: (val: any) => val,
  };
});

// Mock react-native-worklets
jest.mock('react-native-worklets', () => {
  return {};
});

import VotingScreen from '../app/(game)/voting';

// Mock soundManager
jest.mock('@/utils/soundManager', () => ({
  soundManager: {
    playSound: jest.fn().mockResolvedValue(true),
    unloadAll: jest.fn().mockResolvedValue(true),
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

// Mock @clerk/clerk-expo
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({
    getToken: jest.fn().mockResolvedValue('mock-token'),
  }),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(true),
  notificationAsync: jest.fn().mockResolvedValue(true),
  ImpactFeedbackStyle: { Light: 0, Medium: 1, Heavy: 2 },
  NotificationFeedbackType: { Success: 0, Warning: 1, Error: 2 },
}));

// Mock Zustand stores
const mockCastVote = jest.fn();
const mockResetRoom = jest.fn();

let mockRoomState: any = null;
let mockProfileState: any = { clerk_id: 'host_id', username: 'zeus_player' };

jest.mock('@/store/roomStore', () => ({
  useRoomStore: () => ({
    roomState: mockRoomState,
    castVote: mockCastVote,
    resetRoom: mockResetRoom,
  }),
}));

jest.mock('@/store/userStore', () => ({
  useUserStore: () => ({
    profile: mockProfileState,
    fetchProfile: jest.fn().mockResolvedValue({}),
  }),
}));

describe('VotingScreen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoomState = null;
  });

  it('should render loading spinner if roomState is missing', () => {
    const { getByTestId } = render(<VotingScreen />);
    expect(getByTestId('voting-loading-indicator')).toBeTruthy();
  });

  it('should render validating status correctly', () => {
    mockRoomState = {
      status: 'VALIDATING',
      categories: ['Όνομα'],
      currentCategoryIndex: 0,
      timerStartedAt: Date.now(),
    };

    const { getByText } = render(<VotingScreen />);
    expect(getByText('Το AI αξιολογεί τις απαντήσεις...')).toBeTruthy();
  });

  it('should render voting list and support casting votes', () => {
    mockRoomState = {
      roomCode: 'ABCDEF',
      status: 'VOTING',
      categories: ['Όνομα'],
      currentCategoryIndex: 0,
      letter: 'Α',
      timerStartedAt: Date.now(),
      players: {
        host_id: { username: 'zeus_player', score: 10, connected: true },
        guest_id: { username: 'athena_player', score: 5, connected: true },
      },
      answers: {
        0: {
          guest_id: { raw: 'ΑΝΝΑ', normalized: 'ΑΝΝΑ', approved: true, votes: {} },
        },
      },
    };

    const { getByText } = render(<VotingScreen />);

    // Renders active category info
    expect(getByText('Όνομα')).toBeTruthy();
    expect(getByText('ATHENA_PLAYER')).toBeTruthy();
    expect(getByText('ΑΝΝΑ')).toBeTruthy();
    expect(getByText('Έγκριση AI')).toBeTruthy();

    // Renders action buttons
    const acceptBtn = getByText('ΑΠΟΔΟΧΗ');
    fireEvent.press(acceptBtn);

    expect(mockCastVote).toHaveBeenCalledWith(0, 'guest_id', true);
  });

  it('should render final leaderboard in FINISHED status', () => {
    mockRoomState = {
      roomCode: 'ABCDEF',
      status: 'FINISHED',
      hostId: 'host_id',
      currentRound: 5,
      totalRounds: 5,
      players: {
        host_id: { username: 'zeus_player', score: 25, connected: true },
        guest_id: { username: 'athena_player', score: 15, connected: true },
      },
    };

    const { getByText } = render(<VotingScreen />);

    expect(getByText('ΠΑΙΧΝΙΔΙ ΤΕΛΕΙΩΣΕ!')).toBeTruthy();
    expect(getByText('zeus_player')).toBeTruthy();
    expect(getByText('25 pts')).toBeTruthy();
    expect(getByText('athena_player')).toBeTruthy();
    expect(getByText('15 pts')).toBeTruthy();

    // Host should see play again button
    const playAgainBtn = getByText('ΠΑΙΞΤΕ ΞΑΝΑ');
    fireEvent.press(playAgainBtn);
    expect(mockResetRoom).toHaveBeenCalled();
  });
});
