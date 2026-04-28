// ============================================================
// Activity Feed Type Definitions
// ============================================================

export type ActivityType =
  | 'run_completed'
  | 'pr_achieved'
  | 'challenge_completed'
  | 'crew_joined'
  | 'streak_milestone'
  | 'post';

export type ReactionType = 'clap' | 'fire' | 'muscle' | 'party' | 'lightning' | 'heart';

export const REACTION_EMOJIS: Record<ReactionType, string> = {
  clap: '\uD83D\uDC4F',
  fire: '\uD83D\uDD25',
  muscle: '\uD83D\uDCAA',
  party: '\uD83C\uDF89',
  lightning: '\u26A1',
  heart: '\u2764\uFE0F',
};

export const REACTION_TYPES: ReactionType[] = [
  'clap',
  'fire',
  'muscle',
  'party',
  'lightning',
  'heart',
];

export interface ReactionSummary {
  clap: number;
  fire: number;
  muscle: number;
  party: number;
  lightning: number;
  heart: number;
  total: number;
}

export interface RunSummary {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  avgPaceSecondsPerKm: number;
  routePreview: [number, number][];
  thumbnailUrl: string | null;
}

export interface FeedActivity {
  id: string;
  userId: string;
  userNickname: string;
  userAvatarUrl: string | null;
  activityType: ActivityType;
  runRecord?: RunSummary;
  content?: string;
  imageUrls: string[];
  metadata: Record<string, unknown>;
  reactions: ReactionSummary;
  userReactions: ReactionType[];
  commentCount: number;
  createdAt: string;
}

export interface FeedComment {
  id: string;
  activityId: string;
  userId: string;
  userNickname: string;
  userAvatarUrl: string | null;
  parentId: string | null;
  content: string;
  replies?: FeedComment[];
  replyCount: number;
  createdAt: string;
}
