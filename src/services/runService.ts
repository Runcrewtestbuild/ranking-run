import api from './api';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  UploadChunkRequest,
  UploadChunkResponse,
  CompleteRunRequest,
  RunCompleteResponse,
} from '../types/api';

export const runService = {
  /**
   * Create a new running session. Called when the user taps "Start Running".
   * If network is unavailable, the client should generate a local UUID
   * and register the session when connectivity returns.
   */
  async createSession(
    request: CreateSessionRequest,
  ): Promise<CreateSessionResponse> {
    return api.post<CreateSessionResponse>('/runs/sessions', request);
  },

  /**
   * Upload a GPS data chunk to the server.
   * Called every 1km or 5 minutes during a run, in the background.
   * This should never block the running experience.
   */
  async uploadChunk(
    sessionId: string,
    request: UploadChunkRequest,
  ): Promise<UploadChunkResponse> {
    return api.post<UploadChunkResponse>(
      `/runs/sessions/${sessionId}/chunks`,
      request,
    );
  },

  /**
   * Mark a running session as complete and submit the final summary.
   * This is a two-step process: the final chunk is uploaded first,
   * then this endpoint is called with the full session summary.
   */
  async completeRun(
    sessionId: string,
    request: CompleteRunRequest,
  ): Promise<RunCompleteResponse> {
    return api.post<RunCompleteResponse>(
      `/runs/sessions/${sessionId}/complete`,
      request,
    );
  },

  /**
   * Batch upload previously failed chunks.
   * Called when the app detects missing chunks after run completion
   * or on app restart.
   */
  async uploadChunksBatch(
    sessionId: string,
    chunks: UploadChunkRequest[],
  ): Promise<{
    received_sequences: number[];
    failed_sequences: number[];
  }> {
    return api.post<{
      received_sequences: number[];
      failed_sequences: number[];
    }>(`/runs/sessions/${sessionId}/chunks/batch`, {
      session_id: sessionId,
      chunks,
    });
  },

  /**
   * Recover an incomplete session (e.g., after app crash).
   * The server reconstructs the run from whatever chunks it has received.
   */
  async recoverSession(
    sessionId: string,
    data: {
      finished_at: string;
      total_chunks: number;
      uploaded_chunk_sequences: number[];
    },
  ): Promise<{
    run_record_id: string;
    recovered_distance_meters: number;
    recovered_duration_seconds: number;
    missing_chunk_sequences: number[];
  }> {
    return api.post<{
      run_record_id: string;
      recovered_distance_meters: number;
      recovered_duration_seconds: number;
      missing_chunk_sequences: number[];
    }>(`/runs/sessions/${sessionId}/recover`, data);
  },

  /**
   * Discard an incomplete session and delete local chunk data.
   */
  async discardSession(sessionId: string): Promise<void> {
    await api.delete(`/runs/sessions/${sessionId}`);
  },

  /**
   * Upload a route snapshot image to the server.
   * Returns the public URL of the uploaded image.
   */
  async uploadRouteSnapshot(fileUri: string, target: 'image' | 'snapshot' = 'image'): Promise<string> {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() ?? 'route_snapshot.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpeg';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const type = mimeMap[ext] ?? 'image/jpeg';

    formData.append('file', {
      uri: fileUri,
      name: filename,
      type,
    } as unknown as Blob);

    const endpoint = target === 'snapshot' ? '/uploads/snapshot' : '/uploads/image';
    const result = await api.post<{ url: string }>(endpoint, formData);
    return result.url;
  },

  /**
   * Update the route thumbnail URL for a completed run record.
   * Called after the snapshot has been uploaded to the server.
   */
  async updateRouteThumbnail(runId: string, url: string): Promise<void> {
    await api.patch(`/runs/${runId}/thumbnail`, { url });
  },

  async generateRouteThumbnail(runId: string): Promise<void> {
    await api.post(`/runs/${runId}/generate-thumbnail`);
  },
};
