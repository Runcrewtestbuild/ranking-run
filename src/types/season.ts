// ============================================================
// Season System Type Definitions
// ============================================================

export type SeasonTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  theme: string | null;
}

export interface SeasonProgress {
  seasonId: string;
  seasonName: string;
  tier: SeasonTier;
  currentPoints: number;
  nextTierPoints: number | null;
  totalRuns: number;
  totalDistanceMeters: number;
  rank: number;
  daysRemaining: number;
}

export const SEASON_TIER_LABELS: Record<SeasonTier, string> = {
  bronze: '\uBE0C\uB860\uC988',
  silver: '\uC2E4\uBC84',
  gold: '\uACE8\uB4DC',
  platinum: '\uD50C\uB798\uD2F0\uB118',
  diamond: '\uB2E4\uC774\uC544\uBAAC\uB4DC',
};

export const SEASON_TIER_COLORS: Record<SeasonTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#6EE7B7',
  diamond: '#60A5FA',
};

export const SEASON_TIER_ORDER: SeasonTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
];
