/**
 * @file PaymentPage.tsx
 * @description Payment page for subscription management and billing.
 * Provides subscription plans, payment processing, and billing information.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 * - ../contexts/AuthContext: For user authentication state.
 * - ../services/paymentService: For payment processing.
 *
 * @exports
 * - PaymentPage: The main payment page component.
 */
import { loadStripe } from "@stripe/stripe-js";
import { ArrowRight, Check } from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { StripeConfig } from "../services/paymentService";
import {
  createCheckoutSession,
  getStripeConfig,
} from "../services/paymentService";

const pricingTiers = [
  {
    name: "Starter",
    price: "$89",
    pricePeriod: "/mo",
    priceId: "starter_monthly",
    features: [
      "Continuous AI Visibility Tracking",
      "LLM-Ready Content Analysis",
      "Sentence-Level Citation Monitoring",
      "Competitor GEO Benchmarking",
      "AI Content Rewriting Tool",
    ],
    description: "Paid Monthly",
  },
  {
    name: "Growth",
    price: "$299",
    pricePeriod: "/mo",
    priceId: "growth_monthly",
    features: [
      "Continuous AI Visibility Tracking",
      "LLM-Ready Content Analysis",
      "Sentence-Level Citation Monitoring",
      "Competitor GEO Benchmarking",
      "AI Content Rewriting Tool",
    ],
    popular: true,
    description: "Paid Annually",
  },
  {
    name: "Scale",
    price: "$499",
    pricePeriod: "/mo",
    priceId: "scale_monthly",
    features: [
      "Everything in Pro, plus:",
      "Custom GEO Implementations",
      "Dedicated Account Manager",
      "API Access & Integrations",
    ],
    description: "For large-scale or custom needs",
  },
];

const PaymentPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    setIsLoading(priceId);
    try {
      const cfg = await getStripeConfig();
      const priceMap: Record<string, string | undefined> = {
        starter_monthly:
          (
            cfg as unknown as {
              starterMonthly?: string;
              monthlyPriceId?: string;
            }
          ).starterMonthly || (cfg as StripeConfig).monthlyPriceId,
        growth_monthly:
          (
            cfg as unknown as {
              growthMonthly?: string;
              monthlyPriceId?: string;
            }
          ).growthMonthly || (cfg as StripeConfig).monthlyPriceId,
        scale_monthly:
          (cfg as unknown as { scaleMonthly?: string; monthlyPriceId?: string })
            .scaleMonthly || (cfg as StripeConfig).monthlyPriceId,
      };
      const resolvedPriceId = priceMap[priceId] || priceId;
      const stripe = await loadStripe(
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
      );
      if (!stripe) {
        throw new Error("Stripe.js failed to load.");
      }
      const session = await createCheckoutSession(resolvedPriceId);
      await stripe.redirectToCheckout({ sessionId: session.sessionId });
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6 md:p-8 w-full">
          <div className="text-center mb-8">
            <img
              src="/Serplexity.png"
              alt="Serplexity"
              className="w-12 h-12 mx-auto mb-4"
            />
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-3 tracking-tight">
              Choose Your Plan
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Generative search is here—boost your visibility
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-white rounded-2xl shadow-lg border border-gray-200 p-8 group flex flex-col ${tier.popular ? "ring-2 ring-black relative" : ""}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-black text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-black mb-2">
                    {tier.name}
                  </h3>
                  <div className="text-3xl font-bold text-black mb-2">
                    {tier.price}
                    {tier.pricePeriod && (
                      <span className="text-sm font-medium text-gray-500">
                        {tier.pricePeriod}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{tier.description}</p>
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  {tier.features.map((feature, j) => (
                    <li
                      key={j}
                      className="flex items-start text-gray-700 text-sm"
                    >
                      <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout(tier.priceId as string)}
                  disabled={isLoading === tier.priceId}
                  className={`w-full py-3 px-6 rounded-full font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                    tier.popular
                      ? "bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                      : "border-2 border-gray-300 hover:border-gray-400 text-gray-800 bg-white shadow-md hover:shadow-lg active:shadow-inner hover:scale-[1.02] active:scale-[0.98]"
                  } ${isLoading === tier.priceId ? "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none" : ""}`}
                >
                  {isLoading === tier.priceId ? (
                    <>
                      <div
                        className={`animate-spin rounded-full h-3 w-3 border-2 ${tier.popular ? "border-white border-t-transparent" : "border-gray-800 border-t-transparent"}`}
                      ></div>
                    </>
                  ) : (
                    <>
                      {tier.price === "By Request"
                        ? "Contact Sales"
                        : "Get Started"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-center text-gray-600">
              Need to go back?{" "}
              <Link
                to="/overview"
                className="font-medium text-black hover:text-gray-700 transition-colors"
              >
                Return to Dashboard
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
