import apiClient from "../lib/apiClient";

export type DeviceType = "WEB" | "MOBILE" | "DESKTOP" | "OTHER";

export interface SessionDto {
  id: string;
  deviceType: DeviceType;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
}

export async function fetchMySessions(): Promise<SessionDto[]> {
  const { data } = await apiClient.get<{ sessions: SessionDto[] }>(
    "/auth/sessions"
  );
  return data.sessions;
}

export async function revokeMySession(sessionId: string): Promise<void> {
  await apiClient.post(
    `/auth/sessions/${encodeURIComponent(sessionId)}/revoke`
  );
}
