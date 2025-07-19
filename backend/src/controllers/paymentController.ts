/**
 * @file paymentController.ts
 * @description This file contains the controllers for handling all payment-related operations.
 * It manages the creation of Stripe checkout sessions, retrieves Stripe configuration, and processes incoming webhooks
 * to keep user subscription statuses synchronized with the database. This is a critical component for the application's
 * monetization and billing system.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - stripe: The official Stripe Node.js library for interacting with the Stripe API.
 * - zod: For schema validation of request bodies.
 * - ../config/env: Environment variable configuration.
 * - ../config/db: The singleton Prisma client instance for database interactions.
 *
 * @exports
 * - createCheckoutSession: Controller for creating a new Stripe checkout session.
 * - getStripeConfig: Controller for retrieving the Stripe configuration (price IDs).
 * - stripeWebhook: Controller for handling incoming Stripe webhooks.
 */
import { Request, Response } from "express";
import Stripe from "stripe";
import env from "../config/env";
import { getDbClient } from "../config/database";
import { z } from "zod";

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = env;

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error("Missing Stripe environment variables");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Zod schema for request body validation
const createCheckoutSessionSchema = z.object({
  priceId: z.string(),
});

export const createCheckoutSession = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const { priceId } = createCheckoutSessionSchema.parse(req.body);

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${env.FRONTEND_URL}/dashboard?payment_success=true`,
      cancel_url: `${env.FRONTEND_URL}/payment?payment_cancelled=true`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res
      .status(500)
      .json({
        error: "Failed to create checkout session.",
        details: error.message,
      });
  }
};

export const getStripeConfig = (req: Request, res: Response) => {
  res.json({
    monthlyPriceId: env.STRIPE_MONTHLY_PRICE_ID,
    annualPriceId: env.STRIPE_ANNUAL_PRICE_ID,
  });
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err: any) {
    console.error(`Error verifying webhook signature: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer && session.subscription) {
          await prisma.user.update({
            where: { stripeCustomerId: session.customer.toString() },
            data: { subscriptionStatus: "active" },
          });
        }
        break;

      case "customer.subscription.updated":
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        if (subscriptionUpdated.customer) {
          await prisma.user.update({
            where: {
              stripeCustomerId: subscriptionUpdated.customer.toString(),
            },
            data: { subscriptionStatus: subscriptionUpdated.status },
          });
        }
        break;

      case "customer.subscription.deleted":
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        if (subscriptionDeleted.customer) {
          await prisma.user.update({
            where: {
              stripeCustomerId: subscriptionDeleted.customer.toString(),
            },
            data: { subscriptionStatus: "cancelled" },
          });
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Error handling Stripe webhook event:", error);
    res
      .status(500)
      .json({ error: "Webhook handler failed.", details: error.message });
  }
};
