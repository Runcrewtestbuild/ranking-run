import api from './api';
import type { Season, SeasonProgress } from '../types/season';

class SeasonService {
  async getCurrentSeason(): Promise<Season> {
    return api.get<Season>('/seasons/current');
  }

  async getMyProgress(): Promise<SeasonProgress | null> {
    try {
      // First get current season to obtain season_id
      const season = await this.getCurrentSeason();
      if (!season?.id) return null;
      // Then get user's rank in that season
      return api.get<SeasonProgress>(`/seasons/${season.id}/my-rank`);
    } catch {
      return null;
    }
  }
}

export const seasonService = new SeasonService();
