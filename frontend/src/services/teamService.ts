import apiClient from "../lib/apiClient";

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";

export interface TeamMemberDto {
  id: string;
  memberUserId: string;
  role: TeamRole;
  status: "INVITED" | "ACTIVE" | "REMOVED";
  invitedAt?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  member: { id: string; email: string; name: string | null };
}

export async function getTeamLimits(): Promise<{
  planTier: string;
  seatLimit: number;
  seatsUsed: number;
  seatsAvailable: number;
}> {
  const res = await apiClient.get("/team/limits");
  return res.data as {
    planTier: string;
    seatLimit: number;
    seatsUsed: number;
    seatsAvailable: number;
  };
}

export async function getTeamMembers(): Promise<TeamMemberDto[]> {
  const { data } = await apiClient.get<{ members: TeamMemberDto[] }>(
    "/team/members"
  );
  return data.members;
}

export async function inviteTeamMember(
  email: string,
  role: TeamRole = "MEMBER"
): Promise<{ invited: boolean; added: boolean; inviteLink?: string }> {
  try {
    const { data } = await apiClient.post("/team/invite", { email, role });
    return data;
  } catch (err: unknown) {
    const msg =
      typeof err === "object" && err !== null
        ? (err as { response?: { data?: { error?: string } } }).response?.data
            ?.error || "Failed to invite member"
        : "Failed to invite member";
    throw new Error(msg);
  }
}

export async function acceptTeamInvite(token: string): Promise<void> {
  await apiClient.post(`/team/invite/${encodeURIComponent(token)}/accept`);
}

export async function removeTeamMember(memberUserId: string): Promise<void> {
  await apiClient.delete(`/team/members/${encodeURIComponent(memberUserId)}`);
}
