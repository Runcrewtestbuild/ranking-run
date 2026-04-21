import api from './api';
import type { PaginatedResponse } from '../types/api';
import type {
  VersusChallenge,
  VersusCreateRequest,
  VersusStats,
} from '../types/versus';

class VersusService {
  async getActiveBattles(): Promise<VersusChallenge[]> {
    const res = await api.get<{ data: VersusChallenge[] }>('/versus?status=active');
    return Array.isArray(res) ? res : (res.data ?? []);
  }

  async getPendingBattles(): Promise<VersusChallenge[]> {
    const res = await api.get<{ data: VersusChallenge[] }>('/versus?status=pending');
    return Array.isArray(res) ? res : (res.data ?? []);
  }

  async getBattleHistory(
    page: number,
    perPage: number,
  ): Promise<PaginatedResponse<VersusChallenge>> {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('per_page', String(perPage));
    return api.get<PaginatedResponse<VersusChallenge>>(
      `/versus/history?${sp.toString()}`,
    );
  }

  async getBattle(battleId: string): Promise<VersusChallenge> {
    return api.get<VersusChallenge>(`/versus/${battleId}`);
  }

  async createBattle(req: VersusCreateRequest): Promise<VersusChallenge> {
    return api.post<VersusChallenge>('/versus', req);
  }

  async acceptBattle(battleId: string): Promise<VersusChallenge> {
    return api.post<VersusChallenge>(`/versus/${battleId}/accept`);
  }

  async declineBattle(battleId: string): Promise<void> {
    return api.post(`/versus/${battleId}/decline`);
  }

  async getMyStats(): Promise<VersusStats> {
    return api.get<VersusStats>('/versus/stats');
  }
}

export const versusService = new VersusService();
