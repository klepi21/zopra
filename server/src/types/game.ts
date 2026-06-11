export interface PlayerState {
  username: string;
  avatarUrl: string;
  score: number;
  connected: boolean;
  backgrounded: boolean;
  backgroundCount: number;
  isReady?: boolean;
}

export interface PlayerAnswer {
  raw: string;
  normalized: string;
  submittedAt: number;
  approved?: boolean | null; // null = AI unavailable (no badge shown); true/false = AI verdict
  votes?: Record<string, boolean>;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  status: 'WAITING' | 'STARTING' | 'ROUND_ACTIVE' | 'VALIDATING' | 'VOTING' | 'SCORING' | 'FINISHED';
  currentRound: number;
  totalRounds: number;
  currentCategoryIndex: number;
  categories: string[];
  letter: string;
  timerStartedAt: number;
  scoring: { solo: number; unique: number; shared: number };
  timePerCategory: number;
  votingTimeLimit: number;
  players: Record<string, PlayerState>;
  answers: Record<string, Record<string, PlayerAnswer>>; // index -> userId -> answer
  isPublic?: boolean; // if true, room is listed in the public rooms browser
}
