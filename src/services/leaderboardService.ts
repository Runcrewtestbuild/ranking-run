import api from './api';
import type {
  LeaderboardCategory,
  LeaderboardResponse,
  LeaderboardScope,
  RankingSummaryItem,
} from '../types/leaderboard';

class LeaderboardService {
  async getLeaderboard(
    category: LeaderboardCategory,
    scope: LeaderboardScope = 'global',
    limit = 50,
  ): Promise<LeaderboardResponse> {
    const sp = new URLSearchParams();
    sp.set('scope', scope);
    sp.set('limit', String(limit));
    return api.get<LeaderboardResponse>(
      `/leaderboard/weekly/${category}?${sp.toString()}`,
    );
  }

  async getMyRankingSummary(): Promise<RankingSummaryItem[]> {
    // Use my-rank endpoint for the default category
    try {
      const res = await api.get<RankingSummaryItem>('/leaderboard/my-rank/distance');
      return [res];
    } catch {
      return [];
    }
  }
}

export const leaderboardService = new LeaderboardService();
