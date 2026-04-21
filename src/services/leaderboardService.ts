import api from './api';
import type {
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardScope,
  RankingSummaryItem,
} from '../types/leaderboard';

function mapEntry(raw: any, idx: number): LeaderboardEntry {
  return {
    rank: raw.rank ?? idx + 1,
    userId: raw.user?.id ?? raw.user_id ?? '',
    nickname: raw.user?.nickname ?? raw.nickname ?? '',
    avatarUrl: raw.user?.avatar_url ?? raw.avatar_url ?? null,
    value: raw.value ?? 0,
    previousRank: raw.previous_rank ?? null,
    isCurrentUser: false,
  };
}

class LeaderboardService {
  async getLeaderboard(
    category: LeaderboardCategory,
    scope: LeaderboardScope = 'global',
    limit = 50,
  ): Promise<LeaderboardResponse> {
    const sp = new URLSearchParams();
    sp.set('scope', scope);
    sp.set('limit', String(limit));
    try {
      const res = await api.get<any>(
        `/leaderboard/weekly/${category}?${sp.toString()}`,
      );
      const entries = (res.data ?? []).map(mapEntry);
      const myRaw = res.my_ranking;
      const myEntry = myRaw ? mapEntry(myRaw, 0) : null;
      if (myEntry) myEntry.isCurrentUser = true;
      return {
        category,
        scope,
        entries,
        myEntry,
        updatedAt: res.period_end ?? new Date().toISOString(),
      };
    } catch {
      return { category, scope, entries: [], myEntry: null, updatedAt: new Date().toISOString() };
    }
  }

  async getMyRankingSummary(): Promise<RankingSummaryItem[]> {
    try {
      const res = await api.get<any>('/leaderboard/my-rank/distance');
      return [{
        category: 'weekly_distance',
        rank: res.rank ?? 0,
        previousRank: res.previous_rank ?? null,
        value: res.value ?? 0,
      }];
    } catch {
      return [];
    }
  }
}

export const leaderboardService = new LeaderboardService();
