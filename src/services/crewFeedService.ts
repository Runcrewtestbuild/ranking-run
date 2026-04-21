import api from './api';
import type { PaginatedResponse } from '../types/api';
import type {
  CrewPost,
  UpcomingGroupRun,
  CrewMiniCard,
  DiscoverCrew,
  ScheduledRunDetail,
  ScheduledRunParticipant,
} from '../types/crewFeed';

class CrewFeedService {
  async getCrewPosts(
    crewId: string,
    page: number = 0,
    perPage: number = 20,
  ): Promise<{ data: CrewPost[]; has_next: boolean }> {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('per_page', String(perPage));
    const res = await api.get<{
      data: Array<{
        id: string;
        crew_id: string;
        author: { id: string; nickname: string | null; avatar_url: string | null };
        content: string;
        image_urls: string[] | null;
        is_pinned: boolean;
        post_type: string;
        run_record: {
          id: string;
          distance_meters: number | null;
          duration_seconds: number | null;
          pace_seconds_per_km: number | null;
        } | null;
        like_count: number;
        comment_count: number;
        created_at: string;
      }>;
      total_count: number;
    }>(`/crews/${crewId}/feed?${sp.toString()}`);

    const posts: CrewPost[] = (res.data ?? []).map((p) => ({
      id: p.id,
      crewId: p.crew_id,
      postType: p.post_type as CrewPost['postType'],
      author: {
        id: p.author.id,
        nickname: p.author.nickname ?? '',
        avatarUrl: p.author.avatar_url,
        role: null,
      },
      title: null,
      content: p.content,
      imageUrls: p.image_urls ?? [],
      runStats: p.run_record
        ? {
            distanceMeters: p.run_record.distance_meters ?? 0,
            durationSeconds: p.run_record.duration_seconds ?? 0,
            avgPaceSecondsPerKm: p.run_record.pace_seconds_per_km ?? 0,
            courseName: null,
            thumbnailUrl: null,
          }
        : null,
      isPinned: p.is_pinned,
      likeCount: p.like_count,
      commentCount: p.comment_count,
      isLiked: false,
      createdAt: p.created_at,
    }));

    const totalFetched = page * perPage + posts.length;
    return { data: posts, has_next: totalFetched < res.total_count };
  }

  async createCrewPost(
    crewId: string,
    data: { content: string; postType: string; imageUris?: string[] },
  ): Promise<CrewPost> {
    if (data.imageUris && data.imageUris.length > 0) {
      const formData = new FormData();
      formData.append('content', data.content);
      formData.append('post_type', data.postType);
      data.imageUris.forEach((uri, idx) => {
        const ext = uri.split('.').pop() ?? 'jpg';
        formData.append('images', {
          uri,
          name: `image_${idx}.${ext}`,
          type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        } as unknown as Blob);
      });
      return api.post<CrewPost>(`/crews/${crewId}/feed`, formData);
    }
    return api.post<CrewPost>(`/crews/${crewId}/feed`, {
      content: data.content,
      post_type: data.postType,
    });
  }

  async getUpcomingGroupRuns(crewId: string): Promise<UpcomingGroupRun[]> {
    const res = await api.get<{ data: UpcomingGroupRun[] }>(
      `/crews/${crewId}/scheduled-runs?status=upcoming&per_page=10`,
    );
    return Array.isArray(res) ? res : (res.data ?? []);
  }

  async joinGroupRun(runId: string): Promise<void> {
    return api.post(`/scheduled-runs/${runId}/rsvp`, { status: 'accepted' });
  }

  async leaveGroupRun(runId: string): Promise<void> {
    return api.post(`/scheduled-runs/${runId}/rsvp`, { status: 'declined' });
  }

  async getMyCrewCards(): Promise<CrewMiniCard[]> {
    // Backend returns full crew objects at /crews/my — map to mini cards
    const crews = await api.get<Array<{
      id: string;
      name: string;
      logo_image_url: string | null;
      member_count: number;
    }>>('/crews/my');
    return (Array.isArray(crews) ? crews : []).map((c: any) => ({
      id: c.id,
      name: c.name,
      logoUrl: c.logo_image_url ?? c.logo_url ?? null,
      badgeColor: c.badge_color ?? '#FF7A33',
      badgeIcon: c.badge_icon ?? '🏃',
      memberCount: c.member_count ?? 0,
      unreadCount: 0,
    }));
  }

  async getRecommendedCrews(limit: number = 10): Promise<DiscoverCrew[]> {
    // Use crews search/browse endpoint with sorting
    const res = await api.get<{ data: Array<{
      id: string;
      name: string;
      description: string | null;
      logo_image_url: string | null;
      cover_image_url: string | null;
      member_count: number;
      activity_region: string | null;
    }> }>(`/crews?sort=popular&per_page=${limit}`);
    const items = Array.isArray(res) ? res : (res.data ?? []);
    return items.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      logoUrl: c.logo_image_url ?? c.logo_url ?? null,
      memberCount: c.member_count ?? 0,
      region: c.activity_region ?? c.region ?? null,
      badgeColor: c.badge_color ?? '#FF7A33',
    }));
  }

  async getScheduledRunDetail(runId: string): Promise<ScheduledRunDetail> {
    const res = await api.get<any>(`/scheduled-runs/${runId}`);
    return {
      id: res.id,
      crewId: res.crew_id,
      crewName: res.crew_name ?? '',
      title: res.title ?? '',
      description: res.description ?? null,
      scheduledAt: res.scheduled_at,
      location: res.location ?? '',
      latitude: res.latitude ?? null,
      longitude: res.longitude ?? null,
      distanceKm: res.distance_km ?? 0,
      participantCount: res.participant_count ?? 0,
      participants: (res.participants ?? []).map((p: any) => ({
        id: p.id ?? p.user_id,
        nickname: p.nickname ?? '',
        avatarUrl: p.avatar_url ?? null,
        status: p.status ?? 'accepted',
      })),
      isJoined: res.is_joined ?? false,
      isLive: res.is_live ?? false,
      createdBy: res.created_by ?? '',
    };
  }

  async togglePostLike(crewId: string, postId: string): Promise<void> {
    return api.post(`/crews/${crewId}/feed/${postId}/like`);
  }
}

export const crewFeedService = new CrewFeedService();
