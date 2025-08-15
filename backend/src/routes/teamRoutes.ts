import { Router } from "express";
import {
  acceptMemberInvite,
  deleteMember,
  deleteInvite,
  getLimits,
  getMembers,
  inviteMember,
} from "../controllers/teamController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

router.get("/limits", getLimits);
router.get("/members", getMembers);
router.post("/invite", inviteMember);
router.post("/invite/:token/accept", acceptMemberInvite);
router.delete("/invites/:email", deleteInvite);
router.delete("/members/:memberUserId", deleteMember);

export default router;

