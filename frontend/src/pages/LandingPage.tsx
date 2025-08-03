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
import { useBlogPosts } from "../hooks/useBlogPosts";
import { getCompanyLogo } from "../lib/logoService";
import { createCheckoutSession } from "../services/paymentService";
import { MODEL_CONFIGS } from "../types/dashboard";
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
  const {
    posts: blogPosts,
    loading: postsLoading,
    error: postsError,
  } = useBlogPosts({ limit: 3 });

  // Rotating text state
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const rotatingTexts = ["ChatGPT", "Perplexity", "Gemini", "Claude", "Grok"];

  // Mobile detection hook
  const [isMobile, setIsMobile] = useState(false);

  // Track failed logo loads for fallback to PNG
  const [failedLogos, setFailedLogos] = useState<Set<number>>(new Set());

  // Model logo URLs for the 6 icons (extending MODEL_CONFIGS with missing ones)
  const modelIconUrls = {
    ChatGPT:
      MODEL_CONFIGS["gpt-4.1-mini"]?.logoUrl ||
      "https://openai.com/favicon.ico",
    Claude:
      MODEL_CONFIGS["claude-3-5-haiku-20241022"]?.logoUrl ||
      "https://claude.ai/favicon.ico",
    Gemini:
      MODEL_CONFIGS["gemini-2.5-flash"]?.logoUrl ||
      "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
    Perplexity:
      MODEL_CONFIGS["sonar"]?.logoUrl ||
      "https://www.perplexity.ai/favicon.svg",
    Copilot: "https://copilot.microsoft.com/favicon.ico",
    Grok: "https://grok.com/favicon.ico",
  };

  // Get PNG fallback path for a logo
  const getPngFallback = (logoName: string) => {
    const pngMap: Record<string, string> = {
      ChatGPT: "/chatgpt_logo.png",
      Perplexity: "/perplexity_logo.png",
      Gemini: "/gemini_logo.png",
      Claude: "/claude_logo.png",
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
      question: "How can AI search optimization differentiate our agency from competitors?",
      answer: (
        <>
          <p className="mb-4">
            AI search optimization positions your agency at the forefront of the next evolution in search, giving you a significant competitive edge. While most agencies are still focused on traditional search engines, you'll be helping clients dominate the AI-powered search landscape that's rapidly gaining market share.
          </p>
          <p className="mb-4">
            <strong>Agency Benefit:</strong> Offer a cutting-edge service that 95% of your competitors don't understand yet, allowing you to command premium pricing and attract forward-thinking clients who value innovation.
          </p>
          <p>
            <strong>Next Step:</strong> Schedule a demo to see how brands are already measuring and improving their AI search performance with Share of Voice, Inclusion Rate, and Average Position metrics.
          </p>
        </>
      ),
    },
    {
      question: "What ROI can we expect when offering AI search services to clients?",
      answer: (
        <>
          <p className="mb-4">
            Agencies typically see 30-50% higher profit margins on AI search optimization services compared to traditional SEO, due to the specialized expertise and premium positioning. Most agencies price AI search optimization at 20-40% premium over traditional SEO services, with monthly retainers ranging from $3,000-$15,000+ depending on client size and scope.
          </p>
          <p className="mb-4">
            <strong>Client Impact:</strong> Clients see measurable improvements in brand visibility across AI search platforms, with some seeing 200-400% increases in AI answer inclusion rates within 90 days.
          </p>
          <p>
            <strong>Next Step:</strong> Request our agency pricing guide which includes suggested service packages, pricing models, and ROI calculations to share with prospects.
          </p>
        </>
      ),
    },
    {
      question: "How long does it take to onboard our team and start offering services?",
      answer: (
        <>
          <p className="mb-4">
            Most agencies are up and running with AI search optimization services within 2-3 weeks. Your existing SEO and digital marketing team already has 80% of the skills needed. We provide comprehensive training on AI search concepts, platform usage, and client reporting - no advanced technical background required.
          </p>
          <p className="mb-4">
            <strong>Agency Benefit:</strong> Leverage your existing team expertise rather than hiring new specialists, reducing costs while expanding service capabilities.
          </p>
          <p>
            <strong>Next Step:</strong> Schedule a team training session where we'll walk your key team members through the platform and certification process.
          </p>
        </>
      ),
    },
    {
      question: "How does AI search optimization integrate with our existing SEO services?",
      answer: (
        <>
          <p className="mb-4">
            AI search optimization complements traditional SEO perfectly - it's an additional layer that helps clients dominate both traditional and AI-powered search. Many optimization strategies overlap, making it a natural service expansion.
          </p>
          <p className="mb-4">
            <strong>Agency Benefit:</strong> Upsell existing SEO clients with AI search services, increasing average client value by 40-60% without proportional increases in service delivery costs.
          </p>
          <p>
            <strong>Next Step:</strong> Let us show you how to audit an existing SEO client for AI search opportunities and present the expansion as a strategic evolution of their current program.
          </p>
        </>
      ),
    },
    {
      question: "What metrics and reports can we provide to demonstrate client success?",
      answer: (
        <>
          <p className="mb-4">
            Provide concrete metrics like Share of Voice, Inclusion Rate, Average Position, competitive visibility comparisons, and AI search sentiment analysis. These metrics clearly show improvement and competitive position across ChatGPT, Perplexity, Claude, and Google AI Overviews.
          </p>
          <p className="mb-4">
            <strong>Agency Benefit:</strong> Clear, measurable results make client renewals easier and justify premium pricing for specialized services.
          </p>
          <p>
            <strong>Next Step:</strong> Review sample client dashboards and reports to see how we present data in an executive-friendly format that drives action and investment.
          </p>
        </>
      ),
    },
    {
      question: "How do we explain AI search optimization to clients who are new to the concept?",
      answer: (
        <>
          <p className="mb-4">
            Position AI search as "the next evolution of search" that's already happening - ChatGPT, Perplexity, and other AI tools are answering millions of queries daily. Frame it as being prepared for where search is going, not chasing a trend.
          </p>
          <p className="mb-4">
            <strong>Client Impact:</strong> Explain that AI search isn't replacing traditional search immediately - it's capturing additional market share. Smart brands optimize for both to capture the full search opportunity as user behavior evolves.
          </p>
          <p>
            <strong>Next Step:</strong> Use our client education presentation template that includes real examples and case studies to make the concept immediately understandable and compelling.
          </p>
        </>
      ),
    },
    {
      question: "Which types of clients benefit most from AI search optimization?",
      answer: (
        <>
          <p className="mb-4">
            B2B companies, e-commerce brands, healthcare organizations, financial services, and professional services see the greatest impact from AI search optimization. These industries have high-value search queries where AI engines are increasingly providing direct answers instead of traditional search results.
          </p>
          <p className="mb-4">
            <strong>Agency Benefit:</strong> Target high-value client segments who are willing to invest in innovative marketing strategies and can afford premium service packages.
          </p>
          <p>
            <strong>Next Step:</strong> Audit your current client roster to identify which businesses would be ideal candidates for AI search optimization based on their industry and search behavior patterns.
          </p>
        </>
      ),
    },
    {
      question: "Is AI search optimization mature enough for mainstream client adoption?",
      answer: (
        <>
          <p className="mb-4">
            Yes - AI search tools already handle over 100 million queries monthly and are growing 300% year-over-year. Major brands are already investing heavily in AI search presence, making this a proven market opportunity rather than early experimentation.
          </p>
          <p className="mb-4">
            <strong>Client Impact:</strong> Early adopters establish thought leadership, capture market share before competitors understand the opportunity, and build sustainable competitive moats through superior AI search visibility.
          </p>
          <p>
            <strong>Next Step:</strong> Review our market research report showing AI search adoption rates, user behavior trends, and competitive landscape analysis.
          </p>
        </>
      ),
    },
    {
      question: "What tools and resources do you provide to support our team?",
      answer: (
        <>
          <p className="mb-4">
            We provide the complete Serplexity platform, comprehensive training materials, white-label client reports, sales enablement resources, and ongoing support from our team of AI search optimization experts.
          </p>
          <p className="mb-4">
            <strong>Agency Benefit:</strong> Complete toolkit for selling, implementing, and delivering AI search services without having to build internal expertise from scratch. Serplexity integrates with major SEO platforms, analytics tools, and reporting systems through APIs and data exports.
          </p>
          <p>
            <strong>Next Step:</strong> Access our agency resource portal to see examples of client reports, sales materials, and training content we provide to partners.
          </p>
        </>
      ),
    },
    {
      question: "What data do we need from clients to get started?",
      answer: (
        <>
          <p className="mb-4">
            We need basic brand information, key search terms, competitor lists, and any existing search performance data. Most of this information agencies already have from traditional SEO and marketing work.
          </p>
          <p className="mb-4">
            <strong>Agency Benefit:</strong> Minimal additional data collection requirements mean you can start serving clients immediately without lengthy onboarding processes. We maintain SOC 2 compliance and enterprise-grade security protocols for client data protection.
          </p>
          <p>
            <strong>Next Step:</strong> Review our client onboarding checklist to understand exactly what information is needed and how to collect it efficiently.
          </p>
        </>
      ),
    },
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

      /* Contained grid glow - DISABLED */
      /* .dashboard-preview-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 6rem;
        right: 6rem;
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
      } */

      /* Enhanced ambient glow for dashboard content - DISABLED */
      /* .dashboard-preview-content::before {
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
      } */

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

        {/* New Full-Screen Section */}
        <section className="relative h-screen items-start justify-center pt-24 bg-gray-50 text-gray-900 overflow-hidden hidden md:flex">
          {/* Unified Design Canvas Container */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{ aspectRatio: "16/9" }}
          >
            {/* Left Vector */}
            <div className="absolute left-0 top-[50.5%] transform -translate-y-1/2 w-1/2 h-auto opacity-70 z-0">
              <img
                src="/left_vector.svg"
                alt="Left decorative vector"
                className="w-full h-auto"
                style={{ filter: "grayscale(100%) brightness(0.4)" }}
              />
            </div>

            {/* Right Vector */}
            <div className="absolute right-0 top-[50.5%] transform -translate-y-1/2 w-1/2 h-auto opacity-70 z-0">
              <img
                src="/right_vector.svg"
                alt="Right decorative vector"
                className="w-full h-auto"
                style={{ filter: "grayscale(100%) brightness(0.4)" }}
              />
            </div>

            {/* Model Icons positioned within the design canvas using percentage coordinates with proportional sizing */}
            {/* Top-left icon - ChatGPT */}
            <div
              className="bg-white rounded-lg flex items-center justify-center absolute shadow-lg z-10"
              style={{
                top: "46%",
                left: "21%",
                transform: "translate(-50%, -50%)",
                width: "3vw",
                height: "3vw",
                minWidth: "36px",
                minHeight: "36px",
                maxWidth: "60px",
                maxHeight: "60px",
              }}
            >
              <img
                src={modelIconUrls.ChatGPT}
                alt="ChatGPT"
                className="object-contain"
                style={{
                  width: "65%",
                  height: "65%",
                }}
              />
            </div>

            {/* Left middle icon - Claude */}
            <div
              className="bg-white rounded-lg flex items-center justify-center absolute shadow-lg z-10"
              style={{
                top: "64%",
                left: "34%",
                transform: "translate(-50%, -50%)",
                width: "3vw",
                height: "3vw",
                minWidth: "36px",
                minHeight: "36px",
                maxWidth: "60px",
                maxHeight: "60px",
              }}
            >
              <img
                src={modelIconUrls.Claude}
                alt="Claude"
                className="object-contain"
                style={{
                  width: "65%",
                  height: "65%",
                }}
              />
            </div>

            {/* Left bottom icon - Gemini */}
            <div
              className="bg-white rounded-lg flex items-center justify-center absolute shadow-lg z-10"
              style={{
                top: "81%",
                left: "15%",
                transform: "translate(-50%, -50%)",
                width: "3vw",
                height: "3vw",
                minWidth: "36px",
                minHeight: "36px",
                maxWidth: "60px",
                maxHeight: "60px",
              }}
            >
              <img
                src={modelIconUrls.Gemini}
                alt="Gemini"
                className="object-contain"
                style={{
                  width: "65%",
                  height: "65%",
                }}
              />
            </div>

            {/* Top-right icon - Perplexity */}
            <div
              className="bg-white rounded-lg flex items-center justify-center absolute shadow-lg z-10"
              style={{
                top: "39%",
                left: "90%",
                transform: "translate(-50%, -50%)",
                width: "3vw",
                height: "3vw",
                minWidth: "36px",
                minHeight: "36px",
                maxWidth: "60px",
                maxHeight: "60px",
              }}
            >
              <img
                src={modelIconUrls.Perplexity}
                alt="Perplexity"
                className="object-contain"
                style={{
                  width: "65%",
                  height: "65%",
                }}
              />
            </div>

            {/* Right middle icon - Copilot */}
            <div
              className="bg-white rounded-lg flex items-center justify-center absolute shadow-lg z-10"
              style={{
                top: "56%",
                left: "77%",
                transform: "translate(-50%, -50%)",
                width: "3vw",
                height: "3vw",
                minWidth: "36px",
                minHeight: "36px",
                maxWidth: "60px",
                maxHeight: "60px",
              }}
            >
              <img
                src={modelIconUrls.Copilot}
                alt="Copilot"
                className="object-contain"
                style={{
                  width: "65%",
                  height: "65%",
                }}
              />
            </div>

            {/* Right bottom icon - Grok */}
            <div
              className="bg-white rounded-lg flex items-center justify-center absolute shadow-lg z-10"
              style={{
                top: "72%",
                left: "72%",
                transform: "translate(-50%, -50%)",
                width: "3vw",
                height: "3vw",
                minWidth: "36px",
                minHeight: "36px",
                maxWidth: "60px",
                maxHeight: "60px",
              }}
            >
              <img
                src={modelIconUrls.Grok}
                alt="Grok"
                className="object-contain"
                style={{
                  width: "65%",
                  height: "65%",
                }}
              />
            </div>

            {/* Center Icon - Serplexity Logo positioned within design canvas */}
            <div
              className="absolute flex items-center justify-center z-20"
              style={{
                top: "66%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "4vw",
                height: "4vw",
                minWidth: "48px",
                minHeight: "48px",
                maxWidth: "80px",
                maxHeight: "80px",
              }}
            >
              <img
                src="/Serplexity.svg"
                alt="Serplexity Logo"
                className="object-contain"
                style={{
                  width: "100%",
                  height: "100%",
                }}
              />
            </div>
          </div>

          <div
            className="relative z-10 mx-auto text-center"
            style={{
              width: "clamp(320px, 90vw, 1400px)",
              padding: "0 clamp(1rem, 4vw, 3rem)",
              marginTop: "clamp(2rem, 4vw, 4rem)",
            }}
          >
            <div>
              <h1
                className="font-semibold text-gray-900 mx-auto leading-tight"
                style={{
                  fontSize: "clamp(2.1rem, 4.3vw, 3.4rem)",
                  marginBottom: "clamp(0.5rem, 1vw, 1rem)",
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    gap: "clamp(0.5rem, 1vw, 1rem)",
                  }}
                >
                  <span>Get mentioned by</span>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: "clamp(12rem, 20vw, 18rem)",
                      height: "clamp(3.5rem, 5.5vw, 5.5rem)",
                      marginLeft: "-2rem",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentTextIndex}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="relative w-full h-full flex items-center justify-center"
                      >
                        <div
                          className="flex items-center justify-center"
                          style={
                            {
                              height: "clamp(3rem, 4.5vw, 4.5rem)",
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
                              maskPosition: "center center",
                              WebkitMaskPosition: "center center",
                              backgroundColor: "currentColor",
                              width: "auto",
                              minWidth: "clamp(8rem, 12vw, 12rem)",
                              maxWidth: "clamp(10rem, 15vw, 15rem)",
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
                </div>
              </h1>
              <p
                className="text-gray-600 mx-auto"
                style={{
                  fontSize: "clamp(0.9rem, 2.2vw, 1.35rem)",
                  marginBottom: "clamp(0.75rem, 1.5vw, 1.5rem)",
                  maxWidth: "clamp(300px, 60vw, 800px)",
                }}
              >
                The all-in-one brand SEO software for AI search engines.
              </p>

              {/* Call to Action Buttons */}
              <div
                className="flex flex-col sm:flex-row justify-center items-center"
                style={{
                  gap: "clamp(0.5rem, 1vw, 1rem)",
                  marginBottom: "clamp(0.75rem, 1.5vw, 1.5rem)",
                }}
              >
                <button
                  onClick={user ? handleDashboard : handleGetStarted}
                  className="bg-black hover:bg-gray-800 text-white rounded-xl font-medium shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200 group"
                  style={{
                    padding:
                      "clamp(0.75rem, 1.5vw, 1rem) clamp(1.5rem, 3vw, 2rem)",
                    fontSize: "clamp(1rem, 2vw, 1.125rem)",
                  }}
                >
                  <span className="flex items-center justify-center">
                    <span>{user ? "View Dashboard" : "Start Tracking"}</span>
                  </span>
                </button>
              </div>

              {/* Bottom Text - moved above Brand Icons */}
              <div>
                <p
                  className="text-gray-500"
                  style={{ fontSize: "clamp(0.875rem, 1.5vw, 1rem)" }}
                >
                  What should you be optimizing?{" "}
                  <span
                    className="font-bold cursor-pointer hover:text-black transition-colors inline-flex items-center"
                    onClick={() => navigate("/research")}
                    style={{ gap: "clamp(0.25rem, 0.5vw, 0.5rem)" }}
                  >
                    Learn more
                    <ArrowRight
                      style={{
                        width: "clamp(0.875rem, 1.5vw, 1rem)",
                        height: "clamp(0.875rem, 1.5vw, 1rem)",
                      }}
                    />
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Hero Section */}
        <section className="relative px-4 sm:px-6 lg:px-8 pt-32 sm:pt-36 md:pt-24 lg:pt-32 pb-12 sm:pb-16 md:pb-20 lg:pb-24 bg-gray-50 min-h-screen md:hidden">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 lg:gap-16 items-center min-h-[70vh] sm:min-h-[75vh] md:min-h-[80vh]">
              {/* Left Column - Content */}
              <div
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
                              height: "clamp(3rem, 8vw, 6rem)",
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
                              minWidth: "clamp(7.5rem, 15vw, 12.5rem)",
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

                <p
                  className="text-base sm:text-lg md:text-xl text-gray-600 max-w-lg -mb-2 md:-mb-8 lg:mb-6 leading-relaxed"
                >
                  Track your brand's visibility across AI search engines.
                  Monitor mentions and citations, optimize content, and grow
                  your organic search traffic
                </p>

                {/* CTA Buttons - Desktop Only */}
                <div
                  className="hidden lg:flex flex-col sm:flex-row gap-3 sm:gap-4"
                >
                  <button
                    onClick={user ? handleDashboard : handleGetStarted}
                    className="px-6 sm:px-8 py-3 sm:py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-medium text-base sm:text-lg shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200 group"
                  >
                    <span className="flex items-center justify-center">
                      <span>{user ? "View Dashboard" : "Start Tracking"}</span>
                    </span>
                  </button>
                </div>
              </div>

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
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative h-[400px] sm:h-[450px] md:h-[400px] lg:h-[600px] w-full mt-0 lg:mt-0"
              >
                {/* Blank Card 1 - Back card */}
                <motion.div
                  initial={{ opacity: 0, y: 40, rotate: -3 }}
                  whileInView={{ opacity: 1, y: 0, rotate: -3 }}
                  viewport={{ once: true }}
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
                  whileInView={{ opacity: 1, y: 0, rotate: 2 }}
                  viewport={{ once: true }}
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
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true }}
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
            <div
              className="lg:hidden flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center -mt-2 md:-mt-16 px-4"
            >
              <button
                onClick={user ? handleDashboard : handleGetStarted}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-semibold text-base sm:text-lg shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200 group"
              >
                <span className="flex items-center justify-center">
                  <span>{user ? "View Dashboard" : "Start Tracking"}</span>
                </span>
              </button>
              <button
                onClick={() => navigate("/research")}
                className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-300 hover:border-gray-400 text-gray-800 bg-white hover:bg-gray-50 rounded-xl font-semibold text-base sm:text-lg shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200"
              >
                Learn More
              </button>
            </div>
          </div>
        </section>

        {/* Key Statistics Section */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="py-8 sm:py-12 md:py-16 lg:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <motion.h2 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-4xl font-medium tracking-tight text-black mb-4"
              >
                Join leading brands already optimizing for AI search
              </motion.h2>
            </div>
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8"
              onViewportEnter={() => setStatsVisible(true)}
              viewport={{ once: true }}
            >
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
                  className="text-center p-6 sm:p-8 bg-white rounded-2xl border border-gray-200 shadow-lg transition-all duration-300"
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
            </motion.div>
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
                <div className="absolute left-[3.8rem] top-4 bottom-4 w-0.5 bg-black hidden md:block" />

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
                        className="relative pl-0 md:pl-24 text-center md:text-left"
                      >
                        {/* Dot */}
                        <div
                          className={`hidden md:block absolute left-14 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-300 ${
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
                      className={`relative w-full h-80 bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-500 ${
                        currentStep === 0
                          ? "scale-105 opacity-100"
                          : "opacity-40 scale-95 md:opacity-100"
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
                      className={`relative w-full h-80 bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-500 ${
                        currentStep === 1
                          ? "scale-105 opacity-100"
                          : "opacity-40 scale-95 md:opacity-100"
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
                      className={`relative w-full h-80 bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-500 ${
                        currentStep === 2
                          ? "scale-105 opacity-100"
                          : "opacity-40 scale-95 md:opacity-100"
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
        <motion.section 
          id="research" 
          className="pt-12 md:pt-16 pb-12 md:pb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-medium tracking-tight text-black mb-4">
                  Latest Research & Insights
                </h2>
                <p className="text-lg md:text-xl text-gray-600">
                  Access state of the industry reports and leading research on
                  AI search
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
        </motion.section>

        {/* Comparison Table Section */}
        <motion.section
          id="comparison"
          className="pt-12 md:pt-16 pb-20 md:pb-24 relative hidden md:block"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-20">
                <h2 className="text-4xl font-medium tracking-tight text-black mb-4">
                  Why Traditional SEO{" "}
                  <span className="text-black">Isn't Enough</span>
                </h2>
                <p className="text-lg md:text-xl text-gray-600">
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
                            name: "White-label Client Dashboards",
                            description: "Custom-branded reports and dashboards for your agency clients",
                            traditional: false,
                            agencies: false,
                          },
                          {
                            name: "AI Visibility Metrics Suite",
                            description: "Share of Voice, Inclusion Rate, and Average Position tracking across all AI engines",
                            traditional: false,
                            agencies: false,
                          },
                          {
                            name: "Multi-Engine AI Monitoring",
                            description: "Track across ChatGPT, Perplexity, Claude, Google AI Overviews",
                            traditional: false,
                            agencies: false,
                          },
                          {
                            name: "AI Sentiment Analysis",
                            description: "Monitor how AI engines describe your brand's sentiment and topics",
                            traditional: false,
                            agencies: false,
                          },
                          {
                            name: "Real-time Citation Attribution",
                            description: "See exactly which content gets quoted by AI engines",
                            traditional: false,
                            agencies: false,
                          },
                          {
                            name: "Competitive Intelligence",
                            description: "Compare your AI visibility against competitors in real-time",
                            traditional: false,
                            agencies: false,
                          },
                          {
                            name: "Traditional SEO Tracking",
                            description: "Standard search rankings and keyword monitoring",
                            traditional: true,
                            agencies: true,
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
                                {feature.traditional ? (
                                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                    <Check className="w-5 h-5 text-blue-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-6 text-center">
                              <div className="flex justify-center">
                                {feature.agencies ? (
                                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                    <Check className="w-5 h-5 text-blue-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
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
                          Join the brands already leveraging AI search for competitive
                          advantage
                        </p>
                      </div>
                      <div className="relative z-10">
                        <button
                          onClick={user ? handleDashboard : handleGetStarted}
                          className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                          {user ? "View Dashboard" : "Get Started Today"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </motion.section>

        {/* Pricing Section */}
        <motion.section
          id="pricing" 
          className="py-20 md:py-24 hidden md:block"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-medium tracking-tight text-black mb-4">
                  Simple, Transparent Pricing
                </h2>
                <p className="text-lg md:text-xl text-gray-600">
                  Choose the plan that's right for your brand's growth
                </p>
              </div>

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
        </motion.section>

        {/* FAQ Accordion Section */}
        <motion.section
          id="faq"
          className="pt-10 sm:pt-12 md:pt-16 pb-10 sm:pb-12 md:pb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-10 sm:mb-12 md:mb-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-black mb-4">
                  Agency Partner Questions
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-gray-600">
                  Everything agencies need to know about offering AI search optimization services
                </p>
              </div>

              <Accordion items={faqItems} />
            </div>
        </motion.section>

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
