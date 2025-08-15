import { PrismaClient, TeamMemberStatus, TeamRole } from "@prisma/client";
import crypto from "crypto";
import env from "../config/env";
import logger from "../utils/logger";
import { sendTeamInviteEmail } from "./mailerService";

export function getSeatLimitForPlan(planTier?: string | null): number {
  switch (planTier) {
    case "SCALE":
      return 15;
    case "GROWTH":
      return 5;
    case "STARTER":
    default:
      return 1;
  }
}

export async function getSeatUsage(prisma: PrismaClient, ownerUserId: string) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { billingSettings: { select: { planTier: true } } },
  });
  const planTier = owner?.billingSettings?.planTier ?? "STARTER";
  const seatLimit = getSeatLimitForPlan(planTier);
  const members = await prisma.teamMember.count({
    where: { ownerUserId, status: TeamMemberStatus.ACTIVE },
  });
  const seatsUsed = 1 + members; // owner + active members
  return {
    planTier,
    seatLimit,
    seatsUsed,
    seatsAvailable: Math.max(0, seatLimit - seatsUsed),
  };
}

export async function listMembers(prisma: PrismaClient, ownerUserId: string) {
  return prisma.teamMember.findMany({
    where: {
      ownerUserId,
      status: { in: [TeamMemberStatus.INVITED, TeamMemberStatus.ACTIVE] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      memberUserId: true,
      role: true,
      status: true,
      invitedAt: true,
      acceptedAt: true,
      createdAt: true,
      member: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function addMemberByEmail(
  prisma: PrismaClient,
  params: { ownerUserId: string; email: string; role: TeamRole }
) {
  const { seatLimit, seatsUsed } = await getSeatUsage(
    prisma,
    params.ownerUserId
  );
  if (seatsUsed >= seatLimit) {
    return {
      ok: false as const,
      code: 403 as const,
      error: "Seat limit reached",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: params.email },
  });
  if (existingUser) {
    // Disallow a user from joining multiple workspaces (owners)
    const otherMembership = await prisma.teamMember.findFirst({
      where: {
        memberUserId: existingUser.id,
        status: TeamMemberStatus.ACTIVE,
        ownerUserId: { not: params.ownerUserId },
      },
    });
    if (otherMembership) {
      return {
        ok: false as const,
        code: 409 as const,
        error: "This user has already joined another workspace",
      };
    }
    const existingMembership = await prisma.teamMember.findUnique({
      where: {
        ownerUserId_memberUserId: {
          ownerUserId: params.ownerUserId,
          memberUserId: existingUser.id,
        },
      },
    });
    if (
      existingMembership &&
      existingMembership.status === TeamMemberStatus.ACTIVE
    ) {
      return {
        ok: true as const,
        added: false as const,
        invited: false as const,
      };
    }
    // Require invite acceptance even for existing accounts
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await prisma.teamInvite.create({
      data: {
        ownerUserId: params.ownerUserId,
        email: params.email,
        role: params.role,
        token,
        expiresAt,
      },
    });
    const inviteLink = `${env.FRONTEND_URL || "http://localhost:3000"}/invite/accept?token=${token}`;
    try {
      await sendTeamInviteEmail({
        toEmail: params.email,
        ownerName: (
          await prisma.user.findUnique({
            where: { id: params.ownerUserId },
            select: { name: true },
          })
        )?.name,
        inviteLink,
      });
    } catch (_e) {
      // non-fatal
    }
    return {
      ok: true as const,
      added: false as const,
      invited: true as const,
      token,
    };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.teamInvite.create({
    data: {
      ownerUserId: params.ownerUserId,
      email: params.email,
      role: params.role,
      token,
      expiresAt,
    },
  });
  const inviteLink = `${env.FRONTEND_URL || "http://localhost:3000"}/invite/accept?token=${token}`;
  let emailSent = false;
  let emailError: string | undefined;
  
  try {
    await sendTeamInviteEmail({
      toEmail: params.email,
      ownerName: (
        await prisma.user.findUnique({
          where: { id: params.ownerUserId },
          select: { name: true },
        })
      )?.name,
      inviteLink,
    });
    emailSent = true;
  } catch (e) {
    emailError = e instanceof Error ? e.message : String(e);
    logger.warn("[teamService] Failed to send invite email", { 
      email: params.email, 
      error: emailError 
    });
  }
  
  return {
    ok: true as const,
    added: false as const,
    invited: true as const,
    emailSent,
    emailError,
    token,
  };
}

export async function acceptInvite(
  prisma: PrismaClient,
  params: { token: string; userId: string; email: string }
) {
  const invite = await prisma.teamInvite.findUnique({
    where: { token: params.token },
  });
  if (!invite)
    return {
      ok: false as const,
      code: 404 as const,
      error: "Invite not found",
    };
  if (invite.consumedAt)
    return { ok: false as const, code: 410 as const, error: "Invite consumed" };
  if (invite.expiresAt < new Date())
    return { ok: false as const, code: 410 as const, error: "Invite expired" };
  if (invite.email.toLowerCase() !== params.email.toLowerCase())
    return {
      ok: false as const,
      code: 403 as const,
      error: "Invite email mismatch",
    };

  const { seatLimit, seatsUsed } = await getSeatUsage(
    prisma,
    invite.ownerUserId
  );
  if (seatsUsed >= seatLimit) {
    return {
      ok: false as const,
      code: 403 as const,
      error: "Seat limit reached",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamMember.upsert({
      where: {
        ownerUserId_memberUserId: {
          ownerUserId: invite.ownerUserId,
          memberUserId: params.userId,
        },
      },
      create: {
        ownerUserId: invite.ownerUserId,
        memberUserId: params.userId,
        role: invite.role,
        status: TeamMemberStatus.ACTIVE,
        invitedAt: invite.createdAt,
        acceptedAt: new Date(),
      },
      update: {
        status: TeamMemberStatus.ACTIVE,
        role: invite.role,
        acceptedAt: new Date(),
        removedAt: null,
      },
    });
    await tx.teamInvite.update({
      where: { token: params.token },
      data: { consumedAt: new Date() },
    });
  });
  return { ok: true as const };
}

export async function removeMember(
  prisma: PrismaClient,
  params: { ownerUserId: string; memberUserId: string }
) {
  await prisma.teamMember.updateMany({
    where: {
      ownerUserId: params.ownerUserId,
      memberUserId: params.memberUserId,
      status: TeamMemberStatus.ACTIVE,
    },
    data: { status: TeamMemberStatus.REMOVED, removedAt: new Date() },
  });
  return { ok: true as const };
}
