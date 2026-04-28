import api from './api';
import type { PaginatedResponse } from '../types/api';
import type { FeedActivity, FeedComment, ReactionSummary, ReactionType } from '../types/feed';

class FeedService {
  async getFeed(page: number, perPage: number): Promise<{ data: FeedActivity[]; has_next: boolean }> {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('per_page', String(perPage));
    const res = await api.get<{
      data: Array<{
        id: string;
        user: { id: string; nickname: string | null; avatar_url: string | null };
        activity_type: string;
        content: string | null;
        image_urls: string[];
        metadata: Record<string, unknown> | null;
        run_summary: {
          id: string;
          distance_meters: number;
          duration_seconds: number;
          avg_pace_seconds_per_km: number | null;
          course_title: string | null;
          route_thumbnail_url: string | null;
          route_preview: number[][] | null;
        } | null;
        reactions_summary: Record<string, number>;
        user_reactions: string[];
        created_at: string;
      }>;
      total_count: number;
      page: number;
      per_page: number;
    }>(`/feed?${sp.toString()}`);

    const activities: FeedActivity[] = (res.data ?? []).map((a) => ({
      id: a.id,
      userId: a.user.id,
      userNickname: a.user.nickname ?? '',
      userAvatarUrl: a.user.avatar_url,
      activityType: a.activity_type as FeedActivity['activityType'],
      content: a.content ?? undefined,
      imageUrls: a.image_urls,
      metadata: a.metadata ?? {},
      runRecord: a.run_summary
        ? {
            id: a.run_summary.id,
            distanceMeters: a.run_summary.distance_meters,
            durationSeconds: a.run_summary.duration_seconds,
            avgPaceSecondsPerKm: a.run_summary.avg_pace_seconds_per_km ?? 0,
            routePreview: (a.run_summary.route_preview ?? []) as [number, number][],
            thumbnailUrl: a.run_summary.route_thumbnail_url,
          }
        : undefined,
      reactions: {
        clap: a.reactions_summary.clap ?? 0,
        fire: a.reactions_summary.fire ?? 0,
        muscle: a.reactions_summary.muscle ?? 0,
        party: a.reactions_summary.party ?? 0,
        lightning: a.reactions_summary.lightning ?? 0,
        heart: a.reactions_summary.heart ?? 0,
        total: a.reactions_summary.total ?? 0,
      },
      userReactions: a.user_reactions as ReactionType[],
      commentCount: (a as any).comment_count ?? 0,
      createdAt: a.created_at,
    }));

    const totalFetched = (page) * perPage + activities.length;
    return { data: activities, has_next: totalFetched < res.total_count };
  }

  async getUserActivities(
    userId: string,
    page: number,
    perPage = 20,
  ): Promise<PaginatedResponse<FeedActivity>> {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('per_page', String(perPage));
    return api.get<PaginatedResponse<FeedActivity>>(
      `/feed/users/${userId}?${sp.toString()}`,
    );
  }

  async createActivity(
    content: string,
    imageUrls?: string[],
  ): Promise<FeedActivity> {
    return api.post<FeedActivity>('/feed/activities', {
      content,
      image_urls: imageUrls ?? [],
    });
  }

  async addReaction(activityId: string, type: ReactionType): Promise<void> {
    return api.post(`/feed/activities/${activityId}/reactions`, { reaction_type: type });
  }

  async removeReaction(activityId: string, type: ReactionType): Promise<void> {
    return api.delete(`/feed/activities/${activityId}/reactions/${type}`);
  }

  async getReactions(activityId: string): Promise<ReactionSummary> {
    return api.get<ReactionSummary>(`/feed/activities/${activityId}/reactions`);
  }

  async getComments(
    activityId: string,
    page: number = 0,
  ): Promise<{ data: FeedComment[]; totalCount: number; hasNext: boolean }> {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('per_page', '20');
    const res = await api.get<{
      data: Array<{
        id: string;
        activity_id: string;
        user_id: string;
        user_nickname: string;
        user_avatar_url: string | null;
        parent_id: string | null;
        content: string;
        replies: any[];
        reply_count: number;
        created_at: string;
      }>;
      total_count: number;
      page: number;
      per_page: number;
    }>(`/feed/activities/${activityId}/comments?${sp.toString()}`);

    const comments: FeedComment[] = (res.data ?? []).map((c) => ({
      id: c.id,
      activityId: c.activity_id,
      userId: c.user_id,
      userNickname: c.user_nickname ?? '',
      userAvatarUrl: c.user_avatar_url,
      parentId: c.parent_id,
      content: c.content,
      replies: (c.replies ?? []).map((r: any) => ({
        id: r.id,
        activityId: r.activity_id,
        userId: r.user_id,
        userNickname: r.user_nickname ?? '',
        userAvatarUrl: r.user_avatar_url,
        parentId: r.parent_id,
        content: r.content,
        replyCount: 0,
        createdAt: r.created_at,
      })),
      replyCount: c.reply_count ?? 0,
      createdAt: c.created_at,
    }));

    const totalFetched = page * 20 + comments.length;
    return {
      data: comments,
      totalCount: res.total_count,
      hasNext: totalFetched < res.total_count,
    };
  }

  async addComment(
    activityId: string,
    content: string,
    parentId?: string,
  ): Promise<FeedComment> {
    const endpoint = parentId
      ? `/feed/activities/${activityId}/comments/${parentId}/replies`
      : `/feed/activities/${activityId}/comments`;
    const res = await api.post<{
      id: string;
      activity_id: string;
      user_id: string;
      user_nickname: string;
      user_avatar_url: string | null;
      parent_id: string | null;
      content: string;
      reply_count: number;
      created_at: string;
    }>(endpoint, { content });
    return {
      id: res.id,
      activityId: res.activity_id,
      userId: res.user_id,
      userNickname: res.user_nickname ?? '',
      userAvatarUrl: res.user_avatar_url,
      parentId: res.parent_id,
      content: res.content,
      replyCount: res.reply_count ?? 0,
      createdAt: res.created_at,
    };
  }

  async deleteComment(activityId: string, commentId: string): Promise<void> {
    return api.delete(`/feed/activities/${activityId}/comments/${commentId}`);
  }
}

export const feedService = new FeedService();
