// ============================================================
// Leaderboard Type Definitions
// ============================================================

export type LeaderboardCategory = 'weekly_distance' | 'monthly_count' | 'pace' | 'course';

export type LeaderboardScope = 'global' | 'nearby' | 'crew';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  value: number;
  previousRank: number | null;
  isCurrentUser: boolean;
}

export interface RankingSummaryItem {
  category: LeaderboardCategory;
  rank: number;
  previousRank: number | null;
  value: number;
}

export interface LeaderboardResponse {
  category: LeaderboardCategory;
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  updatedAt: string;
}

export const LEADERBOARD_CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  weekly_distance: '\uC8FC\uAC04\uAC70\uB9AC',
  monthly_count: '\uC6D4\uAC04\uD69F\uC218',
  pace: '\uD398\uC774\uC2A4',
  course: '\uCF54\uC2A4',
};

export const LEADERBOARD_SCOPE_LABELS: Record<LeaderboardScope, string> = {
  global: '\uC804\uCCB4',
  nearby: '\uB0B4 \uC8FC\uBCC0',
  crew: '\uD06C\uB8E8',
};
