/**
 * @file companyMiddleware.ts
 * @description Middleware to handle company context selection for authenticated users
 */

import { Request, Response, NextFunction } from "express";

/**
 * Middleware that adds companyId to req.user based on:
 * 1. X-Company-Id header (preferred)
 * 2. query parameter companyId
 * 3. First company in user.companies array (fallback)
 */
export const addCompanyContext = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next();
  }

  // Ensure companies array exists
  if (!req.user.companies || !Array.isArray(req.user.companies)) {
    req.user.companies = [];
  }

  // Get company ID from header, query, or use first company as default
  const requestedCompanyId = 
    req.headers['x-company-id'] as string ||
    req.query.companyId as string ||
    (req.user.companies.length > 0 ? req.user.companies[0].id : null);

  if (requestedCompanyId) {
    // Verify user has access to this company
    const userCompanyIds = req.user.companies.map(c => c.id);
    if (userCompanyIds.includes(requestedCompanyId)) {
      // Add companyId to user object for backward compatibility
      req.user.companyId = requestedCompanyId;
    } else {
      // If requested company ID doesn't match user companies, log warning
      console.warn(`[Company Middleware] User ${req.user.id} requested company ${requestedCompanyId} but only has access to: ${userCompanyIds.join(', ')}`);
    }
  } else if (req.user.companies.length === 0) {
    // No companies found - this might be expected for new users
    console.warn(`[Company Middleware] User ${req.user.id} has no companies available`);
  }

  next();
};

/**
 * Middleware that requires a valid company context
 */
export const requireCompany = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.companyId) {
    return res.status(400).json({ 
      error: "Company context required",
      message: "Please provide a company ID via X-Company-Id header or select a company"
    });
  }
  next();
};