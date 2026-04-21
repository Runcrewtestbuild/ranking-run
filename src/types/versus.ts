// ============================================================
// Versus (1:1 Battle) Type Definitions
// ============================================================

export type VersusStatus = 'pending' | 'accepted' | 'active' | 'completed' | 'declined' | 'expired';

export type VersusMetric = 'distance' | 'count' | 'pace';

export type VersusDuration = 3 | 7 | 14;

export interface VersusParticipant {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  currentValue: number;
  runCount: number;
}

export interface VersusChallenge {
  id: string;
  metric: VersusMetric;
  durationDays: VersusDuration;
  status: VersusStatus;
  challenger: VersusParticipant;
  opponent: VersusParticipant;
  startedAt: string | null;
  endsAt: string | null;
  createdAt: string;
  winnerId: string | null;
}

export interface VersusCreateRequest {
  opponentId: string;
  metric: VersusMetric;
  durationDays: VersusDuration;
}

export interface VersusStats {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
}

export const VERSUS_METRIC_LABELS: Record<VersusMetric, string> = {
  distance: '\uAC70\uB9AC',
  count: '\uD69F\uC218',
  pace: '\uD398\uC774\uC2A4',
};

export const VERSUS_DURATION_LABELS: Record<VersusDuration, string> = {
  3: '3\uC77C',
  7: '1\uC8FC\uC77C',
  14: '2\uC8FC\uC77C',
};

export const VERSUS_STATUS_LABELS: Record<VersusStatus, string> = {
  pending: '\uB300\uAE30 \uC911',
  accepted: '\uC218\uB77D\uB428',
  active: '\uC9C4\uD589 \uC911',
  completed: '\uC885\uB8CC',
  declined: '\uAC70\uC808',
  expired: '\uB9CC\uB8CC',
};
