import { TeamRole } from "@prisma/client";
import { Request, Response } from "express";
import { getPrismaClient } from "../config/dbCache";
import {
  acceptInvite,
  addMemberByEmail,
  getSeatUsage,
  listMembers,
  removeMember,
} from "../services/teamService";

export const getLimits = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const prisma = await getPrismaClient();
  const usage = await getSeatUsage(prisma, req.user.id);
  res.json(usage);
};

export const getMembers = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const prisma = await getPrismaClient();
  const members = await listMembers(prisma, req.user.id);
  res.json({ members });
};

export const inviteMember = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const prisma = await getPrismaClient();
  const { email, role } = req.body as { email: string; role?: string };
  if (!email) return res.status(400).json({ error: "Email required" });
  const teamRole: TeamRole = role === "ADMIN" ? "ADMIN" : "MEMBER";
  const result = await addMemberByEmail(prisma, {
    ownerUserId: req.user.id,
    email: email.toLowerCase(),
    role: teamRole,
  });
  if (!result.ok)
    return res.status(result.code ?? 400).json({ error: result.error });
  const inviteLink = result.invited
    ? `${process.env.FRONTEND_URL || "http://localhost:3000"}/invite/accept?token=${result.token}`
    : undefined;
  res.json({
    ok: true,
    invited: !!result.invited,
    added: !!result.added,
    inviteLink,
  });
};

export const acceptMemberInvite = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const prisma = await getPrismaClient();
  const { token } = req.params as { token: string };
  const result = await acceptInvite(prisma, {
    token,
    userId: req.user.id,
    email: req.user.email,
  });
  if (!result.ok)
    return res.status(result.code ?? 400).json({ error: result.error });
  res.json({ ok: true });
};

export const deleteMember = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const prisma = await getPrismaClient();
  const { memberUserId } = req.params as { memberUserId: string };
  if (memberUserId === req.user.id)
    return res.status(400).json({ error: "Owner cannot remove self" });
  const result = await removeMember(prisma, {
    ownerUserId: req.user.id,
    memberUserId,
  });
  if (!result.ok)
    return res.status(400).json({ error: "Failed to remove member" });
  res.json({ ok: true });
};
