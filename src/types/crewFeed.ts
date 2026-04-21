// ============================================================
// Crew Feed & Group Run Type Definitions
// ============================================================

export type CrewPostType = 'notice' | 'general' | 'run_share';

export interface CrewPostAuthor {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  role: string | null;
}

export interface EmbeddedRunStats {
  distanceMeters: number;
  durationSeconds: number;
  avgPaceSecondsPerKm: number;
  courseName: string | null;
  thumbnailUrl: string | null;
}

export interface CrewPost {
  id: string;
  crewId: string;
  postType: CrewPostType;
  author: CrewPostAuthor;
  title: string | null;
  content: string;
  imageUrls: string[];
  runStats: EmbeddedRunStats | null;
  isPinned: boolean;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  createdAt: string;
}

export interface UpcomingGroupRun {
  id: string;
  crewId: string;
  crewName: string;
  title: string;
  scheduledAt: string;
  location: string;
  distanceKm: number;
  participantCount: number;
  participantAvatars: string[];
  isLive: boolean;
  isJoined: boolean;
}

export interface CrewMiniCard {
  id: string;
  name: string;
  logoUrl: string | null;
  badgeColor: string;
  badgeIcon: string;
  unreadCount: number;
}

export interface DiscoverCrew {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  region: string | null;
  memberCount: number;
  badgeColor: string;
}
