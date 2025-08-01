/**
 * @file LandingPage.tsx
 * @description Main landing page component that serves as the entry point for the application.
 * Features hero section, product demonstrations, pricing, and call-to-action elements.
 *
 * @dependencies
 * - react: For component rendering and state management.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 * - ../components/landing/*: For landing page components.
 *
 * @exports
 * - LandingPage: The main landing page component.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { useAuth } from "../hooks/useAuth";
// import { FadeIn } from '../components/ui/FadeIn';
import { loadStripe } from "@stripe/stripe-js";
import DashboardPreviewCarousel from "../components/landing/DashboardPreviewCarousel";
import { Accordion } from "../components/ui/Accordion";
import { SlideIn } from "../components/ui/SlideIn";
import { useBlogPosts } from "../hooks/useBlogPosts";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { getCompanyLogo } from "../lib/logoService";
import { createCheckoutSession } from "../services/paymentService";
import {
  estimateReadTime,
  extractFirstCategory,
  formatBlogDate,
  stripHtmlTags,
  truncateText,
} from "../utils/blogUtils";

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const isMediumScreen = useMediaQuery("(min-width: 768px)");
  const {
    posts: blogPosts,
    loading: postsLoading,
    error: postsError,
  } = useBlogPosts({ limit: 3 });

  // Rotating text state
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const rotatingTexts = [
    "ChatGPT",
    "Perplexity",
    "Gemini",
    "Claude",
    "Copilot",
    "DeepSeek",
    "Grok",
  ];

  // Mobile detection hook
  const [isMobile, setIsMobile] = useState(false);

  // Track failed logo loads for fallback to PNG
  const [failedLogos, setFailedLogos] = useState<Set<number>>(new Set());

  // Get PNG fallback path for a logo
  const getPngFallback = (logoName: string) => {
    const pngMap: Record<string, string> = {
      ChatGPT: "/chatgpt_logo.png",
      Perplexity: "/perplexity_logo.png",
      Gemini: "/gemini_logo.png",
      Claude: "/claude_logo.png",
      Copilot: "/copilot-logo.png",
      DeepSeek: "/DeepSeek_logo.png",
      Grok: "/grok_logo.png",
    };
    return (
      pngMap[logoName] || logoConfig.find((l) => l.name === logoName)?.path
    );
  };

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    checkIsMobile();

    // Add resize listener
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Logo configuration with responsive PNG/SVG support
  const logoConfig = useMemo(
    () => [
      {
        name: "ChatGPT",
        path: isMobile ? "/chatgpt_logo.png" : "/chatgpt_logo.svg",
        height: { lg: "80px", md: "65px", sm: "50px" },
      },
      {
        name: "Perplexity",
        path: isMobile
          ? "/perplexity_logo.png"
          : "/logo-perplexity-1024x258.svg",
        height: { lg: "100px", md: "80px", sm: "60px" },
      },
      {
        name: "Gemini",
        path: isMobile ? "/gemini_logo.png" : "/gemini_logo.svg",
        height: { lg: "60px", md: "50px", sm: "38px" },
      },
      {
        name: "Claude",
        path: isMobile ? "/claude_logo.png" : "/claude_logo.svg",
        height: { lg: "60px", md: "50px", sm: "40px" },
      },
      {
        name: "Copilot",
        path: isMobile ? "/copilot-logo.png" : "/copilot-logo.svg",
        height: { lg: "75px", md: "60px", sm: "48px" },
      },
      {
        name: "DeepSeek",
        path: isMobile ? "/DeepSeek_logo.png" : "/DeepSeek_logo.svg",
        height: { lg: "85px", md: "68px", sm: "52px" },
      },
      {
        name: "Grok",
        path: isMobile ? "/grok_logo.png" : "/Grok-feb-2025-logo.svg",
        height: { lg: "90px", md: "72px", sm: "55px" },
      },
    ],
    [isMobile]
  );

  // Statistics animation state
  const [statsVisible, setStatsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  // Animated counters
  const [minutesProcessed, setMinutesProcessed] = useState(0);
  const [queriesOptimized, setQueriesOptimized] = useState(0);
  const [brandsHelped, setBrandsHelped] = useState(0);

  const targetStats = {
    minutes: 1457800,
    queries: 540000,
    brands: 45,
  };

  const handleGetStarted = () => navigate("/register");
  const handleDashboard = () => window.open("/dashboard", "_blank");

  const handleCheckout = async (priceId: string) => {
    if (priceId === "contact_sales") {
      console.log("Contacting sales...");
      return;
    }

    setIsLoading(priceId);
    try {
      const stripe = await loadStripe(
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
      );
      if (!stripe) {
        throw new Error("Stripe.js failed to load.");
      }
      const session = await createCheckoutSession(priceId);
      await stripe.redirectToCheckout({ sessionId: session.sessionId });
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      setIsLoading(null);
    }
  };

  // Preload all rotating logos
  useEffect(() => {
    logoConfig.forEach((logo) => {
      const img = new Image();
      img.src = logo.path;
    });
  }, [logoConfig]);

  // Rotating text animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTextIndex((prev) => (prev + 1) % rotatingTexts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [rotatingTexts.length]);

  // Statistics counter animation
  useEffect(() => {
    if (!statsVisible) return;

    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepDelay = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      const progress = step / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setMinutesProcessed(Math.floor(targetStats.minutes * easeOut));
      setQueriesOptimized(Math.floor(targetStats.queries * easeOut));
      setBrandsHelped(Math.floor(targetStats.brands * easeOut));

      step++;
      if (step > steps) {
        clearInterval(timer);
      }
    }, stepDelay);

    return () => clearInterval(timer);
  }, [
    statsVisible,
    targetStats.minutes,
    targetStats.queries,
    targetStats.brands,
  ]);

  // Scroll-triggered steps with Intersection Observer
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -20% 0px", // Trigger when element is 20% visible
      threshold: 0.5,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const stepIndex = parseInt(
            entry.target.getAttribute("data-step") || "0"
          );
          setCurrentStep(stepIndex);
        }
      });
    }, observerOptions);

    // Observe each step section
    const refs = [step1Ref, step2Ref, step3Ref];
    refs.forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      refs.forEach((ref) => {
        if (ref.current) {
          observer.unobserve(ref.current);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load Twitter widgets script
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    // Note: charset is deprecated for script elements in HTML5
    document.head.appendChild(script);
  }, []);

  const faqItems = [
    {
      question: "What is AI Answer Optimization (AIO)?",
      answer: (
        <>
          <p className="mb-4">
            AI Answer Optimization is the process of increasing the likelihood
            that large-language-model search experiences—Google AI Overviews,
            ChatGPT, Perplexity, Claude and others—{" "}
            <strong>quote your content directly</strong> (rather than just
            listing your site).
          </p>
          <p className="mb-4">
            Unlike traditional SEO, the goal isn't only to rank; it's to become
            a trusted <em>source</em> inside the answer itself.
          </p>
          <p>
            That means structuring pages so that LLMs can parse, cite, and
            attribute them with confidence.
          </p>
        </>
      ),
    },
    {
      question: "How does Serplexity measure AI visibility?",
      answer: (
        <>
          <p className="mb-4">
            Our dashboard ingests the full text of AI answers and turns it into
            quantitative metrics:
          </p>
          <ul className="space-y-2 list-disc list-inside text-gray-700 mb-4">
            <li>
              <span className="font-semibold text-gray-900">
                Share of Voice:
              </span>{" "}
              The percentage of words—and citations—attributed to your brand
              versus competitors (visualised in the <em>Share of Voice</em> pie
              card).
            </li>
            <li>
              <span className="font-semibold text-gray-900">
                Inclusion Rate:
              </span>{" "}
              How often your domain appears across the monitored query set
              (tracked in the <em>Average Inclusion Rate</em> card).
            </li>
            <li>
              <span className="font-semibold text-gray-900">
                Average Position:
              </span>{" "}
              Where your first mention lands inside the answer narrative (early
              sentences vs. footnotes).
            </li>
            <li>
              <span className="font-semibold text-gray-900">
                Sentiment &amp; Topic Scores:
              </span>{" "}
              A multi-category radar chart showing how engines describe your
              brand (quality, price, trust, etc.).
            </li>
          </ul>
          <p>
            These metrics update automatically whenever a new report is
            generated.
          </p>
        </>
      ),
    },
    {
      question: "Which AI engines and models are included?",
      answer: (
        <>
          <p className="mb-4">We currently monitor answers from:</p>
          <ul className="space-y-2 list-disc list-inside text-gray-700 mb-4">
            <li>Google Search (AI Overviews / Gemini-powered responses)</li>
            <li>OpenAI ChatGPT (GPT-4.1 &amp; GPT-4o)</li>
            <li>Perplexity Sonar</li>
            <li>Anthropic Claude</li>
          </ul>
          <p>
            The list expands as new engines gain adoption. You can filter
            results by model inside the dashboard filter bar.
          </p>
        </>
      ),
    },
    {
      question: "Where do the keywords and questions come from?",
      answer: (
        <>
          <p className="mb-4">
            Our <em>Top Ranking Questions</em> card reveals the exact prompts
            that surface your brand. We start with your existing SEO keyword
            set, layer in engine-specific query logs, and continuously discover
            new conversational questions surfaced by the models.
          </p>
          <p>
            That means you're not guessing what people ask AI—you see the real
            language users type (and speak).
          </p>
        </>
      ),
    },
    {
      question: "How do optimization recommendations work?",
      answer: (
        <>
          <p className="mb-4">
            Every daily report is paired with an <em>Optimization Checklist</em>{" "}
            that highlights missing citations, answer gaps, and on-page tweaks
            (structure, schema, language) proven to increase LLM recall.
          </p>
          <p>
            The checklist is generated automatically from your latest visibility
            data—no manual auditing required.
          </p>
        </>
      ),
    },
    {
      question: "Will AIO hurt my traditional SEO rankings?",
      answer: (
        <>
          <p>
            No. The structural changes that help language models—clear headers,
            concise summaries, trustworthy sources—also align with Google's
            best-practice guidance for page experience. Most clients see flat or
            positive organic traffic alongside rising AI visibility.
          </p>
        </>
      ),
    },
    {
      question: "How quickly can I expect to see improvements?",
      answer: (
        <>
          <p>
            Because AI answer indices refresh faster than classic search, brands
            often see citation lifts within one to two reporting cycles
            (typically days, not months). Competitive markets or large content
            backlogs can take longer, but progress is visible in the dashboard
            as it happens.
          </p>
        </>
      ),
    },
  ];

  const _companyLogos = [
    { file: "Google_Gemini_logo.svg.png", name: "Google Gemini" },
    { file: "logo-perplexity-1024x258.png", name: "Perplexity" },
    { file: "OpenAI_Logo.svg.png", name: "OpenAI" },
    { file: "Anthropic-Logo.wine.svg", name: "Anthropic" },
    { file: "copilot-logo.png", name: "GitHub Copilot" },
    { file: "Grok-feb-2025-logo.svg.png", name: "Grok" },
    { file: "DeepSeek_logo.svg.png", name: "DeepSeek" },
  ];

  // Logos are referenced directly in the component

  return (
    <div className="bg-gray-50 text-gray-900 relative min-h-screen">
      <style>{`
      .gradient-text-clip {
        position: relative;
      }

      .gradient-text-clip::before {
        content: attr(data-text);
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-image: linear-gradient(to right, #5271ff, #7662ff, #9e52ff);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        pointer-events: none;
      }

      .gradient-text-clip::after {
        content: attr(data-text);
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-image: linear-gradient(to right, #5271ff, #7662ff, #9e52ff);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        filter: blur(4px);
        opacity: 0.25;
        z-index: -1;
        pointer-events: none;
      }
      .marquee-container {
        overflow: hidden;
        width: 100%;
      }
      .marquee-track {
        display: inline-block;
        white-space: nowrap;
        animation: marquee 18s linear infinite;
      }
      @keyframes marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .marquee-logo {
        display: inline-block;
        margin: 0 2rem;
        vertical-align: middle;
      }

      /* Vertical Grid Lines - Removed */



      /* Dashboard Preview Container Styling */
      .dashboard-preview-container {
        position: relative;
        margin: 1rem 0;
        padding: 1rem 0;
      }



      /* Dashboard content enhancement */
      .dashboard-preview-content {
        position: relative;
        z-index: 2;
      }

      /* Contained grid glow */
      .dashboard-preview-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 6rem;  /* Align with vertical grid lines */
        right: 6rem; /* Align with vertical grid lines */
        bottom: 0;
        background:
          radial-gradient(
            ellipse at center,
            rgba(118, 98, 255, 0.08) 0%,
            rgba(82, 113, 255, 0.05) 30%,
            rgba(158, 82, 255, 0.03) 60%,
            transparent 80%
          ),
          linear-gradient(
            to bottom,
            rgba(118, 98, 255, 0.02) 0%,
            rgba(118, 98, 255, 0.06) 50%,
            rgba(118, 98, 255, 0.02) 100%
          );
        border-radius: 1rem;
        z-index: -1;
        opacity: 0;
        animation: containedGlow 2.5s ease-out 1.2s forwards;
      }

      /* Enhanced ambient glow for dashboard content */
      .dashboard-preview-content::before {
        content: '';
        position: absolute;
        top: -1rem;
        left: -1rem;
        right: -1rem;
        bottom: -1rem;
        background: radial-gradient(
          ellipse at center,
          rgba(118, 98, 255, 0.06) 0%,
          rgba(158, 82, 255, 0.04) 40%,
          transparent 70%
        );
        border-radius: 1.5rem;
        z-index: -1;
        opacity: 0;
        animation: ambientGlow 2s ease-out 1.5s forwards;
      }

      @keyframes containedGlow {
        0% {
          opacity: 0;
          transform: scale(0.95);
        }
        60% {
          opacity: 0.8;
          transform: scale(1.01);
        }
        100% {
          opacity: 0.6;
          transform: scale(1);
        }
      }

      @keyframes ambientGlow {
        to {
          opacity: 1;
        }
      }

      /* Enhanced Wave-style animations */
      .hero-text-container {
        position: relative;
        overflow: hidden;
      }

      .rotating-text {
        position: absolute;
        display: inline-block;
        white-space: nowrap;
      }

      .stats-card {
        transition: all 0.3s ease;
        backdrop-filter: blur(16px);
      }

      .stats-card:hover {
        transform: translateY(-4px);
        box-shadow:
          0 20px 40px rgba(0, 0, 0, 0.4),
          0 0 0 1px rgba(255, 255, 255, 0.1),
          0 0 20px rgba(119, 98, 255, 0.3);
      }

      /* Scroll-triggered step animations */
      .process-steps-container {
        position: relative;
      }

      .progress-line {
        transition: height 0.2s ease-out;
        will-change: height;
      }

      .step-indicator {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        z-index: 10;
        will-change: transform, box-shadow;
      }

      .step-indicator.active {
        box-shadow: 0 0 20px rgba(119, 98, 255, 0.6);
      }

      .step-content {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: opacity, transform;
      }

      /* Smooth scroll behavior */
      .scroll-triggered {
        scroll-behavior: smooth;
      }

      @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.8;
        }
      }

      .progress-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      /* Smooth page transitions */
      .page-transition {
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Enhanced glass morphism */
      .glass-enhanced {
        background: rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .dashboard-preview-container {
          margin: 2rem 0;
          padding: 2rem 0;
        }

        .dashboard-preview-content {
          padding: 0 1rem;
        }

        /* Mobile glow adjustments */
        .dashboard-preview-container::before {
          left: 1rem;
          right: 1rem;
          border-radius: 0.5rem;
        }

        .stats-card:hover {
          transform: none;
        }
      }

      /* Performance optimizations */
      .will-change-transform {
        will-change: transform;
      }

      .will-change-opacity {
        will-change: opacity;
      }

      /* Accessibility: Respect reduced motion preferences */
      @media (prefers-reduced-motion: reduce) {
        .rotating-text,
        .stats-card,
        .step-indicator,
        .page-transition,
        .progress-line,
        .step-content {
          transition: none !important;
          animation: none !important;
        }

        .progress-pulse {
          animation: none !important;
        }

        /* Provide instant feedback for reduced motion users */
        .step-indicator.active {
          transform: scale(1.1);
          box-shadow: 0 0 15px rgba(119, 98, 255, 0.8);
        }
      }

      /* Mobile-specific optimizations */
      @media (max-width: 768px) {
        .dashboard-preview-container::before {
          left: 1rem;
          right: 1rem;
        }

        .marquee-logo {
          margin: 0 1rem;
        }

        /* Ensure chart cards don't overflow on small screens */
        .absolute {
          max-width: calc(100vw - 2rem);
        }
      }

      @media (max-width: 640px) {
        .dashboard-preview-container::before {
          left: 0.5rem;
          right: 0.5rem;
        }
      }
      `}</style>

      <div className="relative z-10 vertical-grid-container">
        <Navbar />

        {/* Enhanced Hero Section */}
        <section className="relative px-4 sm:px-6 lg:px-8 pt-32 sm:pt-36 md:pt-24 lg:pt-32 pb-12 sm:pb-16 md:pb-20 lg:pb-24 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 lg:gap-16 items-center min-h-[70vh] sm:min-h-[75vh] md:min-h-[80vh]">
              {/* Left Column - Content */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-left -mt-4 sm:-mt-6 md:-mt-8 lg:-mt-12 mb-8 lg:mb-0"
              >
                <h1 className="font-archivo text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium text-black tracking-tight leading-[1.1] mb-6 sm:mb-8">
                  <div className="mb-4 sm:mb-6 text-[2.5rem] sm:text-3xl md:text-5xl lg:text-5xl xl:text-6xl font-medium">
                    Get mentioned by
                  </div>
                  <div className="h-[60px] sm:h-[70px] md:h-[80px] lg:h-[90px] flex items-center justify-start">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentTextIndex}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="relative"
                      >
                        <div
                          className="flex items-center justify-start"
                          style={
                            {
                              height: isLargeScreen
                                ? logoConfig[currentTextIndex]?.height.lg
                                : isMediumScreen
                                  ? logoConfig[currentTextIndex]?.height.md
                                  : logoConfig[currentTextIndex]?.height.sm,
                              filter: "brightness(0)",
                              maskImage: `url(${
                                failedLogos.has(currentTextIndex)
                                  ? getPngFallback(
                                      logoConfig[currentTextIndex]?.name
                                    )
                                  : logoConfig[currentTextIndex]?.path
                              })`,
                              WebkitMaskImage: `url(${
                                failedLogos.has(currentTextIndex)
                                  ? getPngFallback(
                                      logoConfig[currentTextIndex]?.name
                                    )
                                  : logoConfig[currentTextIndex]?.path
                              })`,
                              maskRepeat: "no-repeat",
                              WebkitMaskRepeat: "no-repeat",
                              maskSize: "contain",
                              WebkitMaskSize: "contain",
                              maskPosition: "left center",
                              WebkitMaskPosition: "left center",
                              backgroundColor: "currentColor",
                              width: "auto",
                              minWidth: isLargeScreen
                                ? "200px"
                                : isMediumScreen
                                  ? "160px"
                                  : "120px",
                              aspectRatio:
                                logoConfig[currentTextIndex]?.name ===
                                "Perplexity"
                                  ? "4/1"
                                  : "auto",
                            } as React.CSSProperties
                          }
                          onError={() => {
                            console.error(
                              `Failed to load logo: ${logoConfig[currentTextIndex]?.path}, switching to PNG fallback`
                            );
                            setFailedLogos((prev) =>
                              new Set(prev).add(currentTextIndex)
                            );
                          }}
                        >
                          {/* Fallback content */}
                          <img
                            src={
                              failedLogos.has(currentTextIndex)
                                ? getPngFallback(
                                    logoConfig[currentTextIndex]?.name
                                  )
                                : logoConfig[currentTextIndex]?.path
                            }
                            alt={logoConfig[currentTextIndex]?.name}
                            className="w-auto object-contain max-h-full opacity-0"
                            style={{
                              height: "100%",
                              maxWidth: "100%",
                            }}
                            onError={() => {
                              if (!failedLogos.has(currentTextIndex)) {
                                console.error(
                                  `Failed to load img: ${logoConfig[currentTextIndex]?.path}, switching to PNG fallback`
                                );
                                setFailedLogos((prev) =>
                                  new Set(prev).add(currentTextIndex)
                                );
                              }
                            }}
                          />
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-base sm:text-lg md:text-xl text-gray-600 max-w-lg -mb-2 md:-mb-8 lg:mb-6 leading-relaxed"
                >
                  Track your brand's visibility across AI search engines.
                  Monitor mentions and citations, optimize content, and grow
                  your organic search traffic.
                </motion.p>

                {/* CTA Buttons - Desktop Only */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="hidden lg:flex flex-col sm:flex-row gap-3 sm:gap-4"
                >
                  <button
                    onClick={user ? handleDashboard : handleGetStarted}
                    className="px-6 sm:px-8 py-3 sm:py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-medium text-base sm:text-lg shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200 group"
                  >
                    <span className="flex items-center justify-center">
                      <span>{user ? "View Dashboard" : "Start Tracking"}</span>
                      <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                  <button
                    onClick={() => navigate("/research")}
                    className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-300 hover:border-gray-400 text-gray-800 bg-white hover:bg-gray-50 rounded-xl font-medium text-base sm:text-lg shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200"
                  >
                    Learn More
                  </button>
                </motion.div>
              </motion.div>

              {/* Right Column - Stacked Chart Cards (Desktop Only) */}
              <style>{`
            @keyframes drawLine {
              to {
                stroke-dashoffset: 0;
              }
            }
            @keyframes drawArea {
              to {
                stroke-dashoffset: 0;
              }
            }
            @keyframes growBar {
              from {
                transform: scaleX(0);
                transform-origin: left center;
              }
              to {
                transform: scaleX(1);
                transform-origin: left center;
              }
            }
            .animate-line-1 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawLine 800ms ease-out forwards;
              animation-delay: 100ms;
            }
            .animate-line-2 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawLine 800ms ease-out forwards;
              animation-delay: 200ms;
            }
            .animate-line-3 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawLine 800ms ease-out forwards;
              animation-delay: 300ms;
            }
            .animate-line-4 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawLine 800ms ease-out forwards;
              animation-delay: 400ms;
            }
            .animate-area-1 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawArea 800ms ease-out forwards;
              animation-delay: 100ms;
            }
            .animate-area-2 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawArea 800ms ease-out forwards;
              animation-delay: 200ms;
            }
            .animate-area-3 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawArea 800ms ease-out forwards;
              animation-delay: 300ms;
            }
            .animate-area-4 {
              stroke-dasharray: 400;
              stroke-dashoffset: 400;
              animation: drawArea 800ms ease-out forwards;
              animation-delay: 400ms;
            }
            .animate-single-line {
              stroke-dasharray: 600;
              stroke-dashoffset: 600;
              animation: drawLine 600ms ease-out forwards;
              animation-delay: 200ms;
            }
            .animate-single-area {
              stroke-dasharray: 600;
              stroke-dashoffset: 600;
              animation: drawArea 600ms ease-out forwards;
              animation-delay: 200ms;
            }
            .animate-bar-1 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 500ms;
            }
            .animate-bar-2 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 600ms;
            }
            .animate-bar-3 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 700ms;
            }
            .animate-bar-4 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 800ms;
            }
            .animate-bar-5 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 900ms;
            }
            .animate-bar-6 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 1000ms;
            }
            .animate-bar-7 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 1100ms;
            }
            .animate-bar-8 {
              transform: scaleX(0);
              transform-origin: left center;
              animation: growBar 400ms ease-out forwards;
              animation-delay: 1200ms;
            }
          `}</style>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative h-[400px] sm:h-[450px] md:h-[400px] lg:h-[600px] w-full mt-0 lg:mt-0"
              >
                {/* Blank Card 1 - Back card */}
                <motion.div
                  initial={{ opacity: 0, y: 40, rotate: -3 }}
                  animate={{ opacity: 1, y: 0, rotate: -3 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="absolute top-0 md:top-[-6rem] lg:top-[-0.5rem] left-4 sm:left-8 md:right-8 lg:left-16 w-64 sm:w-68 md:w-72 h-40 sm:h-44 md:h-48 bg-white rounded-2xl overflow-hidden shadow-lg lg:shadow-2xl transform rotate-[-3deg] z-10"
                >
                  <div className="pl-2 pr-2 py-4 h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-2 ml-1">
                      <div className="text-xs font-semibold text-gray-600">
                        Share of Voice
                      </div>
                      <div className="h-6 px-2 bg-white/60 backdrop-blur-sm border border-white/30 rounded-lg shadow-inner flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-700">
                          38.5%
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                        <ChevronUp className="h-3 w-3" />
                        2.1%
                      </span>
                    </div>
                    <div className="flex-1 relative ml-1 h-16 sm:h-20 lg:h-auto">
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 240 120"
                        className="overflow-visible"
                      >
                        {/* Grid lines */}
                        <line
                          x1="2"
                          y1="5"
                          x2="240"
                          y2="5"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="2"
                          y1="5"
                          x2="2"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="70"
                          y1="5"
                          x2="70"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="135"
                          y1="5"
                          x2="135"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="240"
                          y1="5"
                          x2="240"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />

                        {/* Y-axis */}
                        <line
                          x1="2"
                          y1="5"
                          x2="2"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />

                        {/* X-axis */}
                        <line
                          x1="2"
                          y1="115"
                          x2="240"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />

                        {/* Area fill with smooth curve */}
                        <path
                          d="M2,100 C30,95 50,85 70,80 C90,75 115,72 135,70 C160,67 200,55 240,45 L240,115 L2,115 Z"
                          fill="#2563eb"
                          fillOpacity="0.1"
                          className="animate-single-area"
                        />

                        {/* Smooth curved line */}
                        <path
                          d="M2,100 C30,95 50,85 70,80 C90,75 115,72 135,70 C160,67 200,55 240,45"
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2"
                          className="animate-single-line"
                        />

                        {/* Data points */}
                        <circle cx="2" cy="100" r="2" fill="#2563eb" />
                        <circle cx="70" cy="80" r="2" fill="#2563eb" />
                        <circle cx="135" cy="70" r="2" fill="#2563eb" />
                        <circle cx="240" cy="45" r="2" fill="#2563eb" />
                      </svg>
                    </div>
                  </div>
                </motion.div>

                {/* Blank Card 2 - Middle card */}
                <motion.div
                  initial={{ opacity: 0, y: 40, rotate: 2 }}
                  animate={{ opacity: 1, y: 0, rotate: 2 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                  className="absolute top-20 sm:top-24 md:top-[1rem] lg:top-[7rem] right-0 md:right-8 lg:right-0 w-64 sm:w-68 md:w-72 h-40 sm:h-44 md:h-48 bg-white rounded-2xl overflow-hidden shadow-lg lg:shadow-2xl transform rotate-[2deg] z-20"
                >
                  <div className="pl-2 pr-2 py-4 h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-2 ml-1">
                      <div className="text-xs font-semibold text-gray-600">
                        Inclusion Rate
                      </div>
                      <div className="h-6 px-2 bg-white/60 backdrop-blur-sm border border-white/30 rounded-lg shadow-inner flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-700">
                          72.5%
                        </span>
                      </div>
                      <span className="flex items-center text-xs font-medium text-green-500">
                        <ChevronUp className="h-3 w-3 mr-0.5" /> 1.8%
                      </span>
                    </div>
                    <div className="flex-1 relative ml-1 h-16 sm:h-20 lg:h-auto">
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 240 120"
                        className="overflow-visible"
                      >
                        {/* Grid lines */}
                        <line
                          x1="2"
                          y1="5"
                          x2="220"
                          y2="5"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="2"
                          y1="5"
                          x2="2"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="70"
                          y1="5"
                          x2="70"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="135"
                          y1="5"
                          x2="135"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="220"
                          y1="5"
                          x2="220"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />

                        {/* Y-axis */}
                        <line
                          x1="2"
                          y1="5"
                          x2="2"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />

                        {/* X-axis */}
                        <line
                          x1="2"
                          y1="115"
                          x2="220"
                          y2="115"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />

                        {/* Area fills - behind lines with smooth curves */}
                        <path
                          d="M2,75 C25,72 50,68 70,65 C90,62 115,56 135,50 C160,47 190,46 220,45 L220,115 L2,115 Z"
                          fill="#2563eb"
                          fillOpacity="0.1"
                          className="animate-area-1"
                        />
                        <path
                          d="M2,80 C25,77 50,73 70,70 C90,67 115,64 135,62 C160,61 190,60 220,60 L220,115 L2,115 Z"
                          fill="#1d4ed8"
                          fillOpacity="0.1"
                          className="animate-area-2"
                        />
                        <path
                          d="M2,105 C25,103 50,102 70,100 C90,95 115,90 135,88 C160,87 190,86 220,85 L220,115 L2,115 Z"
                          fill="#3b82f6"
                          fillOpacity="0.1"
                          className="animate-area-3"
                        />
                        <path
                          d="M2,105 C25,100 50,95 70,87 C90,75 115,60 135,45 C160,30 190,22 220,15 L220,115 L2,115 Z"
                          fill="#1e40af"
                          fillOpacity="0.1"
                          className="animate-area-4"
                        />

                        {/* GPT-4 line - starts high, slight improvement */}
                        <path
                          d="M2,75 C25,72 50,68 70,65 C90,62 115,56 135,50 C160,47 190,46 220,45"
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2"
                          className="animate-line-1"
                        />

                        {/* Claude line - steady middle performance */}
                        <path
                          d="M2,80 C25,77 50,73 70,70 C90,67 115,64 135,62 C160,61 190,60 220,60"
                          fill="none"
                          stroke="#1d4ed8"
                          strokeWidth="2"
                          className="animate-line-2"
                        />

                        {/* Gemini line - starts second, declines to last */}
                        <path
                          d="M2,105 C25,103 50,102 70,100 C90,95 115,90 135,88 C160,87 190,86 220,85"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          className="animate-line-3"
                        />

                        {/* Perplexity line - dramatic improvement from last to first */}
                        <path
                          d="M2,105 C25,100 50,95 70,87 C90,75 115,60 135,45 C160,30 190,22 220,15"
                          fill="none"
                          stroke="#1e40af"
                          strokeWidth="2"
                          className="animate-line-4"
                        />

                        {/* Data points - all 4 points for each line */}
                        <circle cx="2" cy="75" r="2" fill="#2563eb" />
                        <circle cx="70" cy="65" r="2" fill="#2563eb" />
                        <circle cx="135" cy="50" r="2" fill="#2563eb" />
                        <circle cx="220" cy="45" r="2" fill="#2563eb" />

                        <circle cx="2" cy="80" r="2" fill="#1d4ed8" />
                        <circle cx="70" cy="70" r="2" fill="#1d4ed8" />
                        <circle cx="135" cy="62" r="2" fill="#1d4ed8" />
                        <circle cx="220" cy="60" r="2" fill="#1d4ed8" />

                        <circle cx="2" cy="105" r="2" fill="#3b82f6" />
                        <circle cx="70" cy="100" r="2" fill="#3b82f6" />
                        <circle cx="135" cy="88" r="2" fill="#3b82f6" />
                        <circle cx="220" cy="85" r="2" fill="#3b82f6" />

                        <circle cx="2" cy="105" r="2" fill="#1e40af" />
                        <circle cx="70" cy="87" r="2" fill="#1e40af" />
                        <circle cx="135" cy="45" r="2" fill="#1e40af" />
                        <circle cx="220" cy="15" r="2" fill="#1e40af" />
                      </svg>

                      {/* Model icons positioned at the end of each line */}
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Perplexity logo at y=15 - now first place! */}
                        <div
                          className="absolute w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
                          style={{
                            top: "12%",
                            right: "2px",
                            transform: "translateY(-50%)",
                            zIndex: 4,
                          }}
                        >
                          <img
                            src="https://www.perplexity.ai/favicon.svg"
                            alt="Perplexity"
                            className="w-4 h-4 rounded-full object-contain"
                          />
                        </div>

                        {/* GPT-4 logo at y=45 - second place */}
                        <div
                          className="absolute w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
                          style={{
                            top: "37%",
                            right: "2px",
                            transform: "translateY(-50%)",
                            zIndex: 3,
                          }}
                        >
                          <img
                            src="https://openai.com/favicon.ico"
                            alt="ChatGPT"
                            className="w-4 h-4 rounded-full object-contain"
                          />
                        </div>

                        {/* Claude logo at y=60 - third place */}
                        <div
                          className="absolute w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
                          style={{
                            top: "50%",
                            right: "2px",
                            transform: "translateY(-50%)",
                            zIndex: 2,
                          }}
                        >
                          <img
                            src="https://claude.ai/favicon.ico"
                            alt="Claude"
                            className="w-4 h-4 rounded-full object-contain"
                          />
                        </div>

                        {/* Gemini logo at y=85 - fourth place */}
                        <div
                          className="absolute w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
                          style={{
                            top: "71%",
                            right: "2px",
                            transform: "translateY(-50%)",
                            zIndex: 1,
                          }}
                        >
                          <img
                            src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg"
                            alt="Gemini"
                            className="w-4 h-4 rounded-full object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Blank Card 3 - Bottom card */}
                <motion.div
                  initial={{ opacity: 0, y: 40, rotate: 0 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 0.6, delay: 0.9 }}
                  className="absolute bottom-16 sm:bottom-18 md:top-[12rem] lg:top-[20rem] left-8 sm:left-20 md:left-[4rem] lg:left-40 w-64 sm:w-68 md:w-72 h-40 sm:h-44 md:h-48 bg-white rounded-2xl overflow-hidden shadow-lg lg:shadow-2xl transform rotate-[0deg] z-30"
                >
                  <div className="px-4 pt-4 pb-6 h-full flex flex-col">
                    <div className="text-xs font-semibold text-gray-600 mb-2">
                      Industry Ranking
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-5xl font-bold text-gray-800 -mb-1 mt-3">
                        1
                        <span className="text-lg font-normal text-gray-500">
                          st
                        </span>
                      </div>
                      <div className="flex items-end justify-center space-x-1 h-12 sm:h-20 lg:h-20 w-full max-w-56">
                        {/* Bar 1 - Serplexity (highest, user company) */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-blue-600 animate-bar-1"
                          style={{ height: "80px" }}
                          title="Serplexity: 38.5%"
                        />
                        {/* Bar 2 */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-gray-300 animate-bar-2"
                          style={{ height: "53px" }}
                          title="Competitor A: 25.2%"
                        />
                        {/* Bar 3 */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-gray-300 animate-bar-3"
                          style={{ height: "40px" }}
                          title="Competitor B: 18.9%"
                        />
                        {/* Bar 4 */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-gray-300 animate-bar-4"
                          style={{ height: "27px" }}
                          title="Competitor C: 10.1%"
                        />
                        {/* Bar 5 */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-gray-300 animate-bar-5"
                          style={{ height: "20px" }}
                          title="Competitor D: 7.3%"
                        />
                        {/* Bar 6 */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-gray-300 animate-bar-6"
                          style={{ height: "16px" }}
                          title="Competitor E: 5.8%"
                        />
                        {/* Bar 7 */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-gray-300 animate-bar-7"
                          style={{ height: "13px" }}
                          title="Competitor F: 4.2%"
                        />
                        {/* Bar 8 */}
                        <div
                          className="w-4 rounded-t transition-all duration-300 bg-gray-300 animate-bar-8"
                          style={{ height: "10px" }}
                          title="Competitor G: 3.1%"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>

            {/* Mobile CTA Buttons - Below Chart Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="lg:hidden flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center -mt-2 md:-mt-16 px-4"
            >
              <button
                onClick={user ? handleDashboard : handleGetStarted}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-semibold text-base sm:text-lg shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200 group"
              >
                <span className="flex items-center justify-center">
                  <span>{user ? "View Dashboard" : "Start Tracking"}</span>
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={() => navigate("/research")}
                className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-300 hover:border-gray-400 text-gray-800 bg-white hover:bg-gray-50 rounded-xl font-semibold text-base sm:text-lg shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200"
              >
                Learn More
              </button>
            </motion.div>
          </div>
        </section>

        {/* Key Statistics Section */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          onViewportEnter={() => setStatsVisible(true)}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="py-8 sm:py-12 md:py-16 lg:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="bg-black rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 lg:p-16"
              style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
            >
              <div className="text-center mb-10 sm:mb-12 md:mb-16">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-4"
                >
                  The All-In-One Brand SEO Software For AI Search Engines
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="hidden sm:block text-base sm:text-lg md:text-xl text-gray-300"
                >
                  Join leading companies already optimizing for the future of
                  search
                </motion.p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                {[
                  {
                    label: "Responses Analyzed",
                    value: minutesProcessed,
                    suffix: "+",
                    format: (num: number) => num.toLocaleString(),
                  },
                  {
                    label: "Companies Mentioned",
                    value: queriesOptimized,
                    suffix: "K+",
                    format: (num: number) => Math.floor(num / 1000).toString(),
                  },
                  {
                    label: "Brands Enhanced",
                    value: brandsHelped,
                    suffix: "+",
                    format: (num: number) => num.toString(),
                  },
                ].map((stat, index) => (
                  <div
                    key={index}
                    className="text-center p-6 sm:p-8 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all duration-300"
                  >
                    <div className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-medium text-black mb-2">
                      {stat.format(stat.value)}
                      {stat.suffix}
                    </div>
                    <div className="text-sm sm:text-base text-gray-600 font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Process Steps Section - Wave.co Style */}
        <section
          ref={stepsContainerRef}
          className="relative py-12 sm:py-14 md:py-16 lg:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12 lg:gap-16">
              {/* Left Column - Sticky Navigation */}
              <div className="relative">
                {/* Vertical Line - full height of parent */}
                <div className="absolute left-1.5 top-0 h-full w-0.5 bg-black hidden md:block" />

                {/* Sticky container for the text */}
                <div className="hidden md:block md:sticky md:top-36 mb-8 md:mb-0">
                  {/* Steps Navigation */}
                  <div className="space-y-16">
                    {[
                      { title: "Monitor" },
                      { title: "Analyze" },
                      { title: "Optimize" },
                    ].map((step, index) => (
                      <div
                        key={index}
                        className="relative pl-0 md:pl-10 text-center md:text-left"
                      >
                        {/* Dot */}
                        <div
                          className={`hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-300 ${
                            index === currentStep
                              ? "bg-black scale-110 shadow-lg"
                              : "bg-black/30"
                          }`}
                        />

                        <h3
                          className={`text-3xl font-medium transition-colors duration-300 ${
                            index === currentStep
                              ? "text-black"
                              : "text-black/60"
                          }`}
                        >
                          {step.title}
                        </h3>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Stacked Images/Content */}
              <div className="relative md:sticky md:top-24">
                {/* All steps stacked with minimal spacing */}
                <div className="space-y-4 md:space-y-8 max-w-sm md:max-w-none mx-auto md:mx-auto md:flex md:flex-col md:justify-center md:h-full">
                  {/* Step 1 Content - Monitor: Top Ranking Questions Card */}
                  <motion.div
                    ref={step1Ref}
                    data-step="0"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    <h3
                      className={`md:hidden text-3xl font-medium text-center mt-8 mb-4 transition-all duration-300 ${
                        currentStep === 0
                          ? "text-black scale-105"
                          : "text-black/60 scale-100"
                      }`}
                    >
                      Monitor
                    </h3>
                    <div
                      className={`relative w-full h-80 bg-white rounded-3xl overflow-hidden border transition-all duration-500 shadow-lg ${
                        currentStep === 0
                          ? "border-gray-300 scale-105 opacity-100"
                          : "border-gray-200 opacity-40 scale-95 md:opacity-100"
                      }`}
                    >
                      {/* Top Ranking Questions Card Content */}
                      <div className="p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-gray-800">
                            Top Ranking Prompts
                          </h3>
                        </div>

                        <div className="flex-1 space-y-3 overflow-hidden">
                          {[
                            {
                              question:
                                "What are the best AI visibility tracking tools for businesses?",
                              mentions: 12,
                              trend: "up",
                            },
                            {
                              question:
                                "How can I track my brand mentions in AI search results?",
                              mentions: 8,
                              trend: "up",
                            },
                            {
                              question:
                                "Which platforms offer AI-powered SEO analytics?",
                              mentions: 6,
                              trend: "down",
                            },
                            {
                              question:
                                "How do I improve my brand's visibility in ChatGPT responses?",
                              mentions: 4,
                              trend: "up",
                            },
                          ].map((item, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {item.question}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500">
                                    {item.mentions} mentions
                                  </span>
                                  <span
                                    className={`text-xs flex items-center gap-1 ${item.trend === "up" ? "text-green-500" : "text-red-500"}`}
                                  >
                                    {item.trend === "up" ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                    {item.trend === "up" ? "+12%" : "-8%"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-lg font-medium text-gray-600 ml-2">
                                #{index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Step 2 Content - Analyze: Responses Card (Example Conversation) */}
                  <motion.div
                    ref={step2Ref}
                    data-step="1"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    <h3
                      className={`md:hidden text-3xl font-medium text-center mt-8 mb-4 transition-all duration-300 ${
                        currentStep === 1
                          ? "text-black scale-105"
                          : "text-black/60 scale-100"
                      }`}
                    >
                      Analyze
                    </h3>
                    <div
                      className={`relative w-full h-80 bg-white rounded-3xl overflow-hidden border transition-all duration-500 shadow-lg ${
                        currentStep === 1
                          ? "border-gray-300 scale-105 opacity-100"
                          : "border-gray-200 opacity-40 scale-95 md:opacity-100"
                      }`}
                    >
                      {/* Responses Card Content */}
                      <div className="p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-gray-800">
                            AI Response Analysis
                          </h3>
                        </div>

                        <div className="flex-1 overflow-hidden">
                          {/* Chat-style conversation matching MockResponsesPage */}
                          <div className="space-y-4 h-full overflow-y-auto">
                            {/* User Question */}
                            <div className="flex justify-end">
                              <div className="flex items-start gap-2 max-w-[80%]">
                                <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-md px-3 py-2 rounded-tr-md">
                                  <p className="text-xs text-gray-900 leading-relaxed">
                                    What are the best AI visibility tracking
                                    tools for businesses?
                                  </p>
                                </div>
                                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                  <User size={14} className="text-gray-600" />
                                </div>
                              </div>
                            </div>

                            {/* AI Response */}
                            <div className="flex justify-start">
                              <div className="flex items-start gap-2 max-w-[80%]">
                                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200">
                                  <img
                                    src="https://openai.com/favicon.ico"
                                    alt="ChatGPT"
                                    className="w-4 h-4 rounded object-contain"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-md px-3 py-2 rounded-tl-md">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="text-xs font-medium text-gray-600">
                                        ChatGPT
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-900 leading-relaxed">
                                      <span className="hidden sm:inline">
                                        For AI visibility tracking,{" "}
                                        <strong>Serplexity</strong> leads the
                                        market with comprehensive monitoring
                                        across ChatGPT, Claude, and Gemini. It
                                        provides detailed analytics on brand
                                        mentions and competitive positioning.
                                        The platform offers real-time insights
                                        for optimization.
                                      </span>
                                      <span className="sm:hidden">
                                        For AI visibility tracking,{" "}
                                        <strong>Serplexity</strong> leads with
                                        monitoring across ChatGPT, Claude, and
                                        Gemini. Real-time insights for
                                        optimization.
                                      </span>
                                    </div>
                                  </div>

                                  {/* Mentions and Citations - below the chat bubble */}
                                  <div className="mt-2 flex items-center gap-3 px-3">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-500 font-medium">
                                        Mentions:
                                      </span>
                                      <div className="flex items-center gap-0.5">
                                        {[
                                          {
                                            name: "Serplexity",
                                            website: "serplexity.com",
                                          },
                                          {
                                            name: "Profound",
                                            website: "tryprofound.com",
                                          },
                                          {
                                            name: "Daydream",
                                            website: "withdaydream.com",
                                          },
                                        ].map((brand, index) => {
                                          const logoResult = getCompanyLogo(
                                            brand.website
                                          );
                                          return (
                                            <div
                                              key={`${brand.name}-${index}`}
                                              className="w-4 h-4 rounded bg-white flex items-center justify-center overflow-hidden border border-gray-200"
                                              title={brand.name}
                                            >
                                              <img
                                                src={logoResult.url}
                                                alt={brand.name}
                                                className="w-full h-full object-contain"
                                                style={{
                                                  display: "block",
                                                  maxWidth: "100%",
                                                  maxHeight: "100%",
                                                }}
                                                onError={(e) => {
                                                  // Fallback to first letter if logo fails
                                                  const target =
                                                    e.target as HTMLImageElement;
                                                  target.style.display = "none";
                                                  const parent =
                                                    target.parentElement;
                                                  if (parent) {
                                                    parent.innerHTML = `<span class="text-xs font-bold text-gray-600">${brand.name[0]}</span>`;
                                                  }
                                                }}
                                                loading="lazy"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-500 font-medium">
                                        Citations:
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        3
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Step 3 Content - Optimize: Visibility Tasks Card */}
                  <motion.div
                    ref={step3Ref}
                    data-step="2"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    <h3
                      className={`md:hidden text-3xl font-medium text-center mt-8 mb-4 transition-all duration-300 ${
                        currentStep === 2
                          ? "text-black scale-105"
                          : "text-black/60 scale-100"
                      }`}
                    >
                      Optimize
                    </h3>
                    <div
                      className={`relative w-full h-80 bg-white rounded-3xl overflow-hidden border transition-all duration-500 shadow-lg ${
                        currentStep === 2
                          ? "border-gray-300 scale-105 opacity-100"
                          : "border-gray-200 opacity-40 scale-95 md:opacity-100"
                      }`}
                    >
                      {/* Visibility Tasks Card Content */}
                      <div className="p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-gray-800">
                            Brand Visibility Tasks
                          </h3>
                        </div>

                        <div className="flex-1 min-h-0">
                          {/* Full Kanban Board matching MockVisibilityTasksPage */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 h-full">
                            {/* Not Started Column - Hidden on Mobile */}
                            <div className="hidden md:flex flex-col h-full min-h-0">
                              <div className="flex items-center justify-between p-3 bg-gray-100 rounded-t-lg border-b border-gray-200">
                                <h4 className="text-xs font-medium text-gray-900">
                                  Not Started
                                </h4>
                                <span className="text-xs font-medium text-gray-600 bg-white/60 px-2 py-1 rounded-full">
                                  1
                                </span>
                              </div>
                              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                <div className="group relative bg-white rounded-lg p-3 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <h5 className="text-xs font-medium text-gray-800 leading-tight pr-4">
                                      Verify robots.txt & llms.txt
                                    </h5>
                                    <span className="text-xs px-0.5 py-0 rounded font-medium border flex-shrink-0 bg-red-50 text-red-700 border-red-200 text-[10px]">
                                      High
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                    Navigate to your website's robots.txt and
                                    create llms.txt with brand description...
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-medium">
                                      Technical SEO
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* In Progress Column */}
                            <div className="flex flex-col h-full min-h-0">
                              <div className="flex items-center justify-between p-3 bg-blue-100 rounded-t-lg border-b border-gray-200">
                                <h4 className="text-xs font-medium text-gray-900">
                                  In Progress
                                </h4>
                                <span className="text-xs font-medium text-gray-600 bg-white/60 px-2 py-1 rounded-full">
                                  1
                                </span>
                              </div>
                              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                <div className="group relative bg-white rounded-lg p-3 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <h5 className="text-xs font-medium text-gray-800 leading-tight pr-4">
                                      Implement Schema Markup
                                    </h5>
                                    <span className="text-xs px-0.5 py-0 rounded font-medium border flex-shrink-0 bg-red-50 text-red-700 border-red-200 text-[10px]">
                                      High
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                    Use schema markup generator for
                                    Organization, Product and Article...
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-medium">
                                      Technical SEO
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Completed Column */}
                            <div className="flex flex-col h-full min-h-0">
                              <div className="flex items-center justify-between p-3 bg-blue-200 rounded-t-lg border-b border-gray-200">
                                <h4 className="text-xs font-medium text-gray-900">
                                  Completed
                                </h4>
                                <span className="text-xs font-medium text-gray-600 bg-white/60 px-2 py-1 rounded-full">
                                  1
                                </span>
                              </div>
                              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                <div className="group relative bg-white rounded-lg p-3 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <h5 className="text-xs font-medium text-gray-800 leading-tight pr-4">
                                      <span className="lg:hidden">
                                        Brand Pages
                                      </span>
                                      <span className="hidden lg:inline">
                                        Create Brand Pages
                                      </span>
                                    </h5>
                                    <span className="text-xs px-0.5 py-0 rounded font-medium border flex-shrink-0 bg-red-50 text-red-700 border-red-200 text-[10px]">
                                      High
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                    Research top 10 queries where competitors
                                    rank but you don't...
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-medium">
                                      Content & Messaging
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Preview Container - Moved Down */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="py-12 sm:py-14 md:py-16 lg:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hidden on mobile - only show on sm and larger screens */}
            <div className="hidden sm:block text-center mb-6 sm:mb-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-2xl sm:text-3xl md:text-4xl font-medium text-black mb-4"
              >
                Your Brand Visibility Metrics, All In One Place
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-base sm:text-lg md:text-xl text-black"
              >
                Understand what AI is saying to millions of customers
              </motion.p>
            </div>

            <div
              id="product-preview"
              className="hidden sm:block dashboard-preview-container"
            >
              {/* Dashboard Preview */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="dashboard-preview-content"
              >
                <DashboardPreviewCarousel />
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Research Section */}
        <SlideIn>
          <section id="research" className="pt-12 md:pt-16 pb-12 md:pb-16">
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-medium tracking-tight text-black mb-4">
                  Latest Research & Insights
                </h2>
                <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
                  Access state of the industry reports and leading research on
                  AI search.
                </p>
              </div>

              {/* Blog Posts - Loading State */}
              {postsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading latest research...</p>
                  </div>
                </div>
              ) : postsError ? null : blogPosts.length === 0 ? null : (
                <>
                  {/* Mobile: Horizontal scrollable */}
                  <div className="md:hidden">
                    <div
                      className="flex overflow-x-auto gap-6 px-4 -mx-4 pb-4"
                      style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                      }}
                    >
                      {blogPosts.map((post) => (
                        <article
                          key={post.id}
                          onClick={() => navigate(`/research/${post.slug}`)}
                          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200 group cursor-pointer flex-shrink-0 w-80"
                        >
                          {/* Blog Post Image */}
                          <div className="w-full h-48 bg-gray-100 rounded-xl mb-6 overflow-hidden">
                            {post.coverImage ? (
                              <img
                                src={post.coverImage}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-16 h-16 bg-black/10 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-8 h-8 text-black/50"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Blog Post Content */}
                          <div className="space-y-4">
                            {/* Category Tag & Date */}
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-black/10 text-black rounded-full text-xs font-medium">
                                {extractFirstCategory(post.tags)}
                              </span>
                              <span className="text-gray-600 text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatBlogDate(
                                  post.publishedAt || post.createdAt
                                )}
                              </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-xl font-medium text-black group-hover:text-gray-800 transition-colors line-clamp-2">
                              {post.title}
                            </h3>

                            {/* Description */}
                            <p className="text-gray-600 text-sm line-clamp-3">
                              {post.excerpt
                                ? truncateText(stripHtmlTags(post.excerpt), 120)
                                : truncateText(
                                    stripHtmlTags(post.content),
                                    120
                                  )}
                            </p>

                            {/* Read More Link & Read Time */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-black text-sm font-medium group-hover:text-gray-700 transition-colors">
                                <span>Read more</span>
                                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                              </div>
                              <div className="flex items-center text-gray-600 text-xs gap-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {estimateReadTime(post.content)} min read
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  {/* Desktop: Grid layout */}
                  <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {blogPosts.map((post) => (
                      <article
                        key={post.id}
                        onClick={() => navigate(`/research/${post.slug}`)}
                        className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200 group cursor-pointer"
                      >
                        {/* Blog Post Image */}
                        <div className="w-full h-48 bg-gray-100 rounded-xl mb-6 overflow-hidden">
                          {post.coverImage ? (
                            <img
                              src={post.coverImage}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-16 h-16 bg-black/10 rounded-full flex items-center justify-center">
                                <svg
                                  className="w-8 h-8 text-black/50"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Blog Post Content */}
                        <div className="space-y-4">
                          {/* Category Tag & Date */}
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-black/10 text-black rounded-full text-xs font-medium">
                              {extractFirstCategory(post.tags)}
                            </span>
                            <span className="text-gray-600 text-xs flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatBlogDate(
                                post.publishedAt || post.createdAt
                              )}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-xl font-medium text-black group-hover:text-gray-800 transition-colors line-clamp-2">
                            {post.title}
                          </h3>

                          {/* Description */}
                          <p className="text-gray-600 text-sm line-clamp-3">
                            {post.excerpt
                              ? truncateText(stripHtmlTags(post.excerpt), 120)
                              : truncateText(stripHtmlTags(post.content), 120)}
                          </p>

                          {/* Read More Link & Read Time */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-black text-sm font-medium group-hover:text-gray-700 transition-colors">
                              <span>Read more</span>
                              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                            <div className="flex items-center text-gray-600 text-xs gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {estimateReadTime(post.content)} min read
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {/* View All Posts Button */}
              <div className="text-center mt-6 md:mt-12">
                <button
                  onClick={() => navigate("/research")}
                  className="bg-black text-white hover:bg-gray-800 px-8 py-3 rounded-full font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 mx-auto"
                >
                  See More
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        </SlideIn>

        {/* Comparison Table Section */}
        <SlideIn>
          <section
            id="comparison"
            className="pt-12 md:pt-16 pb-20 md:pb-24 relative hidden md:block"
          >
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-6">
                  Why Traditional SEO{" "}
                  <span className="text-black">Isn't Enough</span>
                </h2>
                <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
                  As generative engines reshape search, brands need a new
                  playbook
                </p>
              </div>

              <div className="relative">
                {/* Enhanced white container */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden relative">
                  {/* Responsive table wrapper */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 md:px-8 py-6 text-left text-base md:text-lg font-medium text-black">
                            <div className="flex items-center gap-2">
                              <Target className="w-5 h-5 text-gray-600" />
                              Capabilities
                            </div>
                          </th>
                          <th className="px-6 md:px-8 py-6 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-base md:text-lg font-medium text-black">
                                Serplexity Pro
                              </span>
                              <span className="text-xs text-gray-600 font-normal">
                                Subscription
                              </span>
                            </div>
                          </th>
                          <th className="px-6 md:px-8 py-6 text-center text-base md:text-lg font-medium text-black">
                            <div className="flex flex-col items-center gap-1">
                              <span>Traditional SEO</span>
                              <span className="text-xs text-gray-600 font-normal">
                                Legacy Approach
                              </span>
                            </div>
                          </th>
                          <th className="px-6 md:px-8 py-6 text-center text-base md:text-lg font-medium text-black">
                            <div className="flex flex-col items-center gap-1">
                              <span>Content Agencies</span>
                              <span className="text-xs text-gray-600 font-normal">
                                Standard Service
                              </span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[
                          {
                            name: "Track AI Search Mentions",
                            description: "Direct quotes in AI responses",
                          },
                          {
                            name: "LLM Content Optimization",
                            description: "AI-ready content structure",
                          },
                          {
                            name: "Competitor Benchmarking",
                            description:
                              "Track the competitors' Share of Voice",
                          },
                          {
                            name: "Sentence-Level Attribution",
                            description: "Precise citation analysis",
                          },
                          {
                            name: "Adaptive Growth Strategy",
                            description: "Win the evolving AI landscape",
                          },
                        ].map((feature, i) => (
                          <tr
                            key={i}
                            className="hover:bg-gray-50 transition-all duration-300 group"
                          >
                            <td className="px-6 md:px-8 py-6">
                              <div>
                                <div className="text-base font-medium text-black group-hover:text-gray-900 transition-colors">
                                  {feature.name}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {feature.description}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-6 text-center">
                              <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                  <Check className="w-5 h-5 text-blue-400" />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-6 text-center">
                              <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-colors">
                                  <X className="w-5 h-5 text-gray-400" />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-6 text-center">
                              <div className="flex justify-center">
                                {i === 0 || i === 2 || i === 3 || i === 4 ? (
                                  <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                    <Check className="w-5 h-5 text-blue-400" />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Call-to-action footer */}
                  <div className="bg-gray-50 border-t border-gray-200 px-6 md:px-8 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="text-center md:text-left">
                        <p className="text-black font-medium">
                          Ready to enhance your visibility?
                        </p>
                        <p className="text-gray-600 text-sm">
                          Join the brands already leveraging GEO for competitive
                          advantage
                        </p>
                      </div>
                      <div className="relative z-10">
                        <button
                          onClick={user ? handleDashboard : handleGetStarted}
                          className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                          {user ? "View Dashboard" : "Get Started Today"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </SlideIn>

        {/* Pricing Section */}
        <SlideIn>
          <section id="pricing" className="py-20 md:py-24 hidden md:block">
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-medium tracking-tight text-black mb-4">
                  Simple, Transparent Pricing
                </h2>
                <p className="text-lg md:text-xl text-gray-600">
                  Choose the plan that's right for your brand's growth.
                </p>
              </div>

              {/* Enhanced White Container */}
              <div className="relative bg-white rounded-3xl shadow-lg border border-gray-200 p-6 md:p-8 overflow-hidden">
                {/* Inner content */}
                <div className="relative">
                  <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                    {[
                      {
                        name: "Serplexity Pro",
                        price: "$249",
                        pricePeriod: "/mo",
                        priceId: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID,
                        features: [
                          "Continuous AI Visibility Tracking",
                          "LLM-Ready Content Analysis",
                          "Sentence-Level Citation Monitoring",
                          "Competitor GEO Benchmarking",
                          "AI Content Optimization Tools",
                        ],
                        description: "Paid Monthly",
                      },
                      {
                        name: "Serplexity Pro (Annual)",
                        price: "$149",
                        pricePeriod: "/mo",
                        priceId: import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID,
                        features: [
                          "Continuous AI Visibility Tracking",
                          "LLM-Ready Content Analysis",
                          "Sentence-Level Citation Monitoring",
                          "Competitor GEO Benchmarking",
                          "AI Content Optimization Tools",
                        ],
                        popular: true,
                        description: "Paid Annually",
                      },
                      {
                        name: "Serplexity Enterprise",
                        price: "By Request",
                        pricePeriod: "",
                        priceId: "contact_sales",
                        features: [
                          "Everything in Pro, plus:",
                          "Personalized Growth Strategies",
                          "GEO Implementation Support",
                          "Dedicated Account Manager",
                        ],
                        description: "For large-scale or custom needs",
                      },
                    ].map((plan, i) => (
                      <div
                        key={i}
                        className={`bg-white rounded-2xl shadow-lg border border-gray-200 p-8 group flex flex-col ${plan.popular ? "border-black shadow-xl relative" : ""}`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <span className="bg-black text-white px-3 py-1 rounded-full text-xs font-medium">
                              Most Popular
                            </span>
                          </div>
                        )}
                        <div className="text-center mb-6">
                          <h3 className="text-lg font-semibold text-black mb-2">
                            {plan.name}
                          </h3>
                          <div className="text-3xl font-medium text-black mb-2">
                            {plan.price}
                            {plan.pricePeriod && (
                              <span className="text-sm font-medium text-gray-600">
                                {plan.pricePeriod}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            {plan.description}
                          </p>
                        </div>
                        <ul className="space-y-3 mb-8 flex-grow">
                          {plan.features.map((feature, j) => (
                            <li
                              key={j}
                              className="flex items-start text-gray-600 text-sm"
                            >
                              <Check className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => handleCheckout(plan.priceId as string)}
                          disabled={isLoading === plan.priceId}
                          className={`w-full py-3 px-6 rounded-full font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                            plan.popular
                              ? "bg-black hover:bg-gray-800 text-white shadow-md hover:shadow-lg active:shadow-inner hover:scale-[1.02] active:scale-[0.98]"
                              : "bg-gray-100 text-black hover:text-gray-900 shadow-md hover:shadow-lg active:shadow-inner hover:scale-[1.02] active:scale-[0.98]"
                          } ${isLoading === plan.priceId ? "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none" : ""}`}
                        >
                          {isLoading === plan.priceId ? (
                            <>
                              <div
                                className={`animate-spin rounded-full h-3 w-3 border-2 ${plan.popular ? "border-white border-t-transparent" : "border-gray-800 border-t-transparent"}`}
                              ></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              {plan.price === "By Request"
                                ? "Contact Sales"
                                : "Get Started"}
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </SlideIn>

        {/* FAQ Accordion Section */}
        <SlideIn>
          <section
            id="faq"
            className="pt-10 sm:pt-12 md:pt-16 pb-10 sm:pb-12 md:pb-16"
          >
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-10 sm:mb-12 md:mb-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-black mb-4">
                  Frequently Asked Questions
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-gray-600">
                  Everything you need to know about Generative Engine
                  Optimization
                </p>
              </div>

              <Accordion items={faqItems} />
            </div>
          </section>
        </SlideIn>

        {/* Landing Page Footer */}
        <footer className="bg-transparent">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="text-center">
              <div className="inline-grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 sm:gap-8 text-left">
                {/* Links */}
                {[
                  {
                    title: "Pages",
                    links: [
                      { label: "Login", href: "/login" },
                      { label: "Sign Up", href: "/register" },
                    ],
                  },
                  {
                    title: "Legal",
                    links: [
                      { label: "Privacy Policy", href: "/privacy" },
                      { label: "Terms of Service", href: "/terms" },
                    ],
                  },
                  {
                    title: "Product",
                    links: [
                      { label: "About", href: "#solutions" },
                      { label: "Pricing", href: "#pricing" },
                    ],
                    mobileHidden: true,
                  },
                ].map((column, i) => (
                  <div
                    key={i}
                    className={column.mobileHidden ? "hidden sm:block" : ""}
                  >
                    <h3 className="font-semibold text-black mb-4">
                      {column.title}
                    </h3>
                    <ul className="space-y-2">
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            className="text-gray-600 hover:text-black transition-colors"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {/* Company Info - Desktop Only */}
                <div className="hidden md:block md:col-span-1 md:order-first">
                  <div className="flex space-x-4 md:justify-start">
                    {[
                      {
                        href: "https://www.linkedin.com/company/serplexity",
                        icon: (
                          <FaLinkedin className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                      {
                        href: "#",
                        icon: (
                          <FaXTwitter className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                    ].map((social, i) => (
                      <a
                        href={social.href}
                        key={i}
                        className="group w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-all duration-200 cursor-pointer"
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 mt-12 pt-8 text-gray-600">
              {/* Desktop Footer */}
              <div className="hidden md:flex items-center justify-between">
                <p className="text-sm">
                  &copy; {new Date().getFullYear()} Serplexity. All rights
                  reserved.
                </p>
                <div className="flex items-center">
                  <img
                    src="/Serplexity.png"
                    alt="Serplexity"
                    className="w-6 h-6 mr-2"
                  />
                  <span className="text-lg font-medium text-black">
                    Serplexity
                  </span>
                </div>
              </div>
              {/* Mobile Footer */}
              <div className="md:hidden">
                <div className="flex items-center justify-center gap-x-6">
                  <div className="flex items-center">
                    <img
                      src="/Serplexity.png"
                      alt="Serplexity"
                      className="w-6 h-6 mr-2"
                    />
                    <span className="text-lg font-medium text-black">
                      Serplexity
                    </span>
                  </div>
                  <div className="flex space-x-4">
                    {[
                      {
                        href: "https://www.linkedin.com/company/serplexity",
                        icon: (
                          <FaLinkedin className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                      {
                        href: "#",
                        icon: (
                          <FaXTwitter className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                    ].map((social, i) => (
                      <a
                        href={social.href}
                        key={i}
                        className="group w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-all duration-200 cursor-pointer"
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-center mt-8">
                  &copy; {new Date().getFullYear()} Serplexity. All rights
                  reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
