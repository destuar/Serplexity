import request from "supertest";
import Stripe from "stripe";

// --- Stripe mock setup (must load before app and controllers) ---
let mockStripeInstance: any;

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => {
    // Lazily create and memoise a single mock Stripe client
    mockStripeInstance = mockStripeInstance ?? {
      customers: { create: jest.fn() },
      checkout: { sessions: { create: jest.fn() } },
      webhooks: { constructEvent: jest.fn() },
    };
    return mockStripeInstance;
  });
});
// --------------------------------------------------------------

import app from "../app";
import { prisma } from "./setup";

// Helper to access the shared mock in tests if needed
/* eslint-disable @typescript-eslint/no-unused-vars */
const getStripeMock = () => mockStripeInstance;
/* eslint-enable */

describe("Payment Controller", () => {
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create test user and get auth token
    const registerRes = await request(app).post("/api/auth/register").send({
      email: "test@example.com",
      password: "TestPassword123",
      name: "Test User",
    });

    expect(registerRes.status).toBe(201);
    userToken = registerRes.body.accessToken;
    userId = registerRes.body.user.id;
  });

  describe("POST /api/payments/create-checkout-session", () => {
    it("should create a checkout session for authenticated user", async () => {
      const mockCustomer = { id: "cus_test123" };
      const mockSession = {
        id: "cs_test123",
        url: "https://checkout.stripe.com/pay/test123",
      };

      getStripeMock().customers.create.mockResolvedValue(mockCustomer as any);
      getStripeMock().checkout.sessions.create.mockResolvedValue(
        mockSession as any,
      );

      const response = await request(app)
        .post("/api/payments/create-checkout-session")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          priceId: "price_test123",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        sessionId: "cs_test123",
        url: "https://checkout.stripe.com/pay/test123",
      });

      // Verify customer was created
      expect(getStripeMock().customers.create).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        metadata: { userId },
      });

      // Verify checkout session was created
      expect(getStripeMock().checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ["card"],
        mode: "subscription",
        customer: "cus_test123",
        line_items: [
          {
            price: "price_test123",
            quantity: 1,
          },
        ],
        success_url: expect.stringContaining("/dashboard?payment_success=true"),
        cancel_url: expect.stringContaining("/payment?payment_cancelled=true"),
      });

      // Verify user was updated with Stripe customer ID
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(updatedUser?.stripeCustomerId).toBe("cus_test123");
    });

    it("should reuse existing Stripe customer for user with stripeCustomerId", async () => {
      // First, update user with existing Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: "cus_existing123" },
      });

      const mockSession = {
        id: "cs_test456",
        url: "https://checkout.stripe.com/pay/test456",
      };

      getStripeMock().checkout.sessions.create.mockResolvedValue(
        mockSession as any,
      );

      const response = await request(app)
        .post("/api/payments/create-checkout-session")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          priceId: "price_test456",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        sessionId: "cs_test456",
        url: "https://checkout.stripe.com/pay/test456",
      });

      // Verify customer creation was NOT called
      expect(getStripeMock().customers.create).not.toHaveBeenCalled();

      // Verify checkout session used existing customer
      expect(getStripeMock().checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing123",
        }),
      );
    });

    it("should reject unauthenticated requests", async () => {
      const response = await request(app)
        .post("/api/payments/create-checkout-session")
        .send({
          priceId: "price_test123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Authorization header missing or incorrect format",
      );
    });

    it("should validate request body schema", async () => {
      const response = await request(app)
        .post("/api/payments/create-checkout-session")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          invalidField: "invalid",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.any(String),
            path: expect.any(Array),
          }),
        ]),
      );
    });

    it("should handle missing priceId", async () => {
      const response = await request(app)
        .post("/api/payments/create-checkout-session")
        .set("Authorization", `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Required",
            path: ["priceId"],
          }),
        ]),
      );
    });

    it("should handle Stripe customer creation error", async () => {
      getStripeMock().customers.create.mockRejectedValue(
        new Error("Stripe error"),
      );

      const response = await request(app)
        .post("/api/payments/create-checkout-session")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          priceId: "price_test123",
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to create checkout session.");
      expect(response.body.details).toBe("Stripe error");
    });

    it("should handle Stripe session creation error", async () => {
      const mockCustomer = { id: "cus_test123" };
      getStripeMock().customers.create.mockResolvedValue(mockCustomer as any);
      getStripeMock().checkout.sessions.create.mockRejectedValue(
        new Error("Session error"),
      );

      const response = await request(app)
        .post("/api/payments/create-checkout-session")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          priceId: "price_test123",
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to create checkout session.");
      expect(response.body.details).toBe("Session error");
    });
  });

  describe("GET /api/payments/config", () => {
    it("should return Stripe configuration", async () => {
      const response = await request(app)
        .get("/api/payments/config")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("monthlyPriceId");
      expect(response.body).toHaveProperty("annualPriceId");
    });
  });

  describe("POST /api/payments/webhook", () => {
    it("should handle checkout.session.completed webhook", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_test123",
            subscription: "sub_test123",
          },
        },
      };

      getStripeMock().webhooks.constructEvent.mockReturnValue(mockEvent);

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: "cus_test123" },
      });

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "whsec_test_signature")
        .send("raw_webhook_data");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });

      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(updatedUser?.subscriptionStatus).toBe("active");
    });

    it("should handle customer.subscription.updated webhook", async () => {
      const mockEvent = {
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_test123",
            id: "sub_test123",
            status: "active",
          },
        },
      };

      getStripeMock().webhooks.constructEvent.mockReturnValue(mockEvent);

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: "cus_test123" },
      });

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "whsec_test_signature")
        .send("raw_webhook_data");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });

      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(updatedUser?.subscriptionStatus).toBe("active");
    });

    it("should handle customer.subscription.deleted webhook", async () => {
      const mockEvent = {
        type: "customer.subscription.deleted",
        data: {
          object: {
            customer: "cus_test123",
            id: "sub_test123",
          },
        },
      };

      getStripeMock().webhooks.constructEvent.mockReturnValue(mockEvent);

      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: "cus_test123",
          subscriptionStatus: "active",
        },
      });

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "whsec_test_signature")
        .send("raw_webhook_data");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });

      const deletedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(deletedUser?.subscriptionStatus).toBe("cancelled");
    });

    it("should handle unhandled webhook event types", async () => {
      const mockEvent = {
        type: "invoice.payment_succeeded",
        data: {
          object: { id: "inv_test123" },
        },
      };

      getStripeMock().webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "whsec_test_signature")
        .send("raw_webhook_data");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    });

    it("should reject webhooks with invalid signature", async () => {
      getStripeMock().webhooks.constructEvent.mockImplementation(() => {
        const error = new Error("Invalid signature");
        error.name = "SignatureVerificationError";
        throw error;
      });

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "invalid_signature")
        .send("raw_webhook_data");

      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook Error: Invalid signature");
    });

    it("should handle database errors during webhook processing", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_nonexistent",
            subscription: "sub_test123",
          },
        },
      };

      getStripeMock().webhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "whsec_test_signature")
        .send("raw_webhook_data");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Webhook handler failed.");
      expect(response.body.details).toContain(
        "No record was found for an update.",
      );
    });
  });
});
