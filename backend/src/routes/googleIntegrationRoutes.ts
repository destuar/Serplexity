import { Router } from "express";
import {
  revokeGoogleTokens,
  startGoogleAuth,
} from "../controllers/googleIntegrationController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();
router.use(authenticate);

router.get("/auth", startGoogleAuth); // /api/integrations/google/auth?provider=ga4|gsc
router.post("/revoke", revokeGoogleTokens);

export default router;
