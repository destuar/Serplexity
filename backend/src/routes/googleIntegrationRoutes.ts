import { Router } from "express";
import {
  revokeGoogleTokens,
  startGoogleAuth,
} from "../controllers/googleIntegrationController";
import { authenticate } from "../middleware/authMiddleware";
import { addCompanyContext, requireCompany } from "../middleware/companyMiddleware";

const router = Router();
router.use(authenticate);
router.use(addCompanyContext);
router.use(requireCompany);

router.get("/auth", startGoogleAuth); // /api/integrations/google/auth?provider=ga4|gsc
router.post("/revoke", revokeGoogleTokens);

export default router;
