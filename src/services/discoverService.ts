import api from './api';

// ---- DTOs ----

export interface TrendingActivity {
  id: string;
  user: { id: string; nickname: string; avatarUrl: string | null };
  activityType: string;
  content: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  runSummary: { distanceMeters: number; durationSeconds: number } | null;
}

export interface RecommendedRunner {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  totalDistanceMeters: number;
  totalRuns: number;
  avgPace: number | null;
  reason: string; // "similar_pace" | "mutual_follow" | "same_region"
  mutualCount: number | null;
}

export interface WeeklyHighlights {
  runnerCount: number;
  prCount: number;
  totalDistanceMeters: number;
  weekStart: string;
}

// ---- Service ----

class DiscoverService {
  async getTrending(limit = 10): Promise<TrendingActivity[]> {
    const res = await api.get<any>(`/feed/trending?limit=${limit}`);
    return (res.data ?? []).map((a: any) => ({
      id: a.id,
      user: { id: a.user.id, nickname: a.user.nickname, avatarUrl: a.user.avatar_url },
      activityType: a.activity_type,
      content: a.content,
      likeCount: Object.values(a.reactions_summary ?? {}).reduce(
        (s: number, v: any) => s + (typeof v === 'number' ? v : 0),
        0,
      ),
      commentCount: a.comment_count ?? 0,
      createdAt: a.created_at,
      runSummary: a.run_summary
        ? {
            distanceMeters: a.run_summary.distance_meters,
            durationSeconds: a.run_summary.duration_seconds,
          }
        : null,
    }));
  }

  async getRecommendedRunners(limit = 10): Promise<RecommendedRunner[]> {
    const res = await api.get<any[]>(`/users/recommended?limit=${limit}`);
    return (Array.isArray(res) ? res : []).map((r: any) => ({
      id: r.id,
      nickname: r.nickname,
      avatarUrl: r.avatar_url,
      totalDistanceMeters: r.total_distance_meters,
      totalRuns: r.total_runs,
      avgPace: r.avg_pace,
      reason: r.reason,
      mutualCount: r.mutual_count,
    }));
  }

  async getWeeklyHighlights(): Promise<WeeklyHighlights> {
    const res = await api.get<any>('/feed/highlights');
    return {
      runnerCount: res.runner_count ?? 0,
      prCount: res.pr_count ?? 0,
      totalDistanceMeters: res.total_distance_meters ?? 0,
      weekStart: res.week_start ?? '',
    };
  }
}

export const discoverService = new DiscoverService();
