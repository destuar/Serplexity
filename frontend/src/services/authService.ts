import apiClient from "../lib/apiClient";

export type DeviceType = "WEB" | "MOBILE" | "DESKTOP" | "OTHER";

export interface SessionDto {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  location: string;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
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

