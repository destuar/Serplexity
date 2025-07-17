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
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '../components/layout/Navbar';
import { Target, Check, X, ArrowRight, Clock, Calendar } from 'lucide-react';
import { FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
// import { FadeIn } from '../components/ui/FadeIn';
import { SlideIn } from '../components/ui/SlideIn';
import { Accordion } from '../components/ui/Accordion';
import { loadStripe } from '@stripe/stripe-js';
import { createCheckoutSession } from '../services/paymentService';
import DashboardPreviewCarousel from '../components/landing/DashboardPreviewCarousel';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useBlogPosts } from '../hooks/useBlogPosts';
import { formatBlogDate, estimateReadTime, extractFirstCategory, truncateText, stripHtmlTags } from '../utils/blogUtils';

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const starContainerRef = useRef<HTMLDivElement>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');
  const { posts: blogPosts, loading: postsLoading, error: postsError } = useBlogPosts({ limit: 3 });
  
  // Rotating text state
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const rotatingTexts = ['Generative', 'Intelligent', 'Conversational', 'Adaptive'];
  
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
    brands: 45
  };

  const handleGetStarted = () => navigate('/register');
  const handleDashboard = () => navigate('/overview');

  const handleCheckout = async (priceId: string) => {
    if (priceId === 'contact_sales') {
      // Potentially navigate to a contact page or open a modal
      console.log('Contacting sales...');
      return;
    }
    try {
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);
      if (!stripe) {
        throw new Error('Stripe.js failed to load.');
      }
      const session = await createCheckoutSession(priceId);
      await stripe.redirectToCheckout({ sessionId: session.sessionId });
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };

  // Rotating text animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTextIndex((prev) => (prev + 1) % rotatingTexts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  
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
  }, [statsVisible]);
  
  // Scroll-triggered steps with Intersection Observer
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -20% 0px', // Trigger when element is 20% visible
      threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const stepIndex = parseInt(entry.target.getAttribute('data-step') || '0');
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
    if (typeof window === 'undefined') return;
    
    const starContainer = starContainerRef.current;

    // Load Twitter widgets script
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    document.head.appendChild(script);

    const createStar = () => {
      if (!starContainerRef.current) return;

      const starEl = document.createElement('div');
      starEl.className = "absolute h-px bg-gradient-to-r from-transparent via-white to-transparent";
      starEl.style.width = '120px';
      
      const duration = (Math.random() * 1.5 + 1) * 1000; // 1s-2.5s in ms

      let startX_vw = -5, startY_vh = 50, endX_vw = 105, endY_vh = 50;
      const startEdge = Math.floor(Math.random() * 4);
      switch (startEdge) {
        case 0: startX_vw = Math.random() * 100; startY_vh = -5; break;
        case 1: startX_vw = 105; startY_vh = Math.random() * 100; break;
        case 2: startX_vw = Math.random() * 100; startY_vh = 105; break;
        case 3: startX_vw = -5; startY_vh = Math.random() * 100; break;
      }

      const endEdge = (startEdge + 2) % 4;
      switch (endEdge) {
        case 0: endX_vw = Math.random() * 100; endY_vh = -5; break;
        case 1: endX_vw = 105; endY_vh = Math.random() * 100; break;
        case 2: endX_vw = Math.random() * 100; endY_vh = 105; break;
        case 3: endX_vw = -5; endY_vh = Math.random() * 100; break;
      }
      
      const deltaX_px = (endX_vw - startX_vw) * window.innerWidth;
      const deltaY_px = (endY_vh - startY_vh) * window.innerHeight;
      const angle = Math.atan2(deltaY_px, deltaX_px) * 180 / Math.PI;
      const opacity = Math.random() * 0.4 + 0.5;

      const keyframes = [
        { transform: `translate(${startX_vw}vw, ${startY_vh}vh) rotate(${angle}deg)`, opacity: 0 },
        { opacity: 0, offset: 0.05 },
        { opacity: opacity, offset: 0.15 },
        { opacity: opacity, offset: 0.75 },
        { opacity: 0, offset: 0.85 },
        { transform: `translate(${endX_vw}vw, ${endY_vh}vh) rotate(${angle}deg)`, opacity: 0 }
      ];

      const animation = starEl.animate(keyframes, { duration, easing: 'linear' });

      animation.onfinish = () => {
        starEl.remove();
      };

      starContainerRef.current.appendChild(starEl);
      
      const randomInterval = Math.random() * 8000 + 4000; // 4-12 seconds
      timeoutIdRef.current = window.setTimeout(createStar, randomInterval);
    };

    timeoutIdRef.current = window.setTimeout(createStar, Math.random() * 5000);

    const createStaticStars = () => {
      if (!starContainerRef.current) return;
      const numStars = 200;
      for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'absolute rounded-full bg-white';
        const size = Math.random() * 1.5 + 0.5;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        const glowSize = Math.random() * 4 + 2;
        star.style.boxShadow = `0 0 ${glowSize}px ${glowSize / 4}px rgba(255, 255, 255, 0.5)`;
        const initialOpacity = Math.random() * 0.5 + 0.3;
        star.style.opacity = `${initialOpacity}`;

        const twinkleDuration = Math.random() * 4 + 2;
        star.animate(
          [
            { opacity: initialOpacity },
            { opacity: initialOpacity * 0.3 },
            { opacity: initialOpacity },
          ],
          {
            duration: twinkleDuration * 1000,
            iterations: Infinity,
            easing: 'ease-in-out',
          }
        );

        starContainerRef.current.appendChild(star);
      }
    };
    createStaticStars();

    return () => {
      const timeoutId = timeoutIdRef.current;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (starContainer) {
        starContainer.innerHTML = '';
      }
    };
  }, []);

  const faqItems = [
    {
      question: "What is AI Answer Optimization (AIO)?",
      answer: (
        <>
          <p className="mb-4">AI Answer Optimization is the process of increasing the likelihood that large-language-model search experiences—Google AI Overviews, ChatGPT, Perplexity, Claude and others— <strong>quote your content directly</strong> (rather than just listing your site).</p>
          <p className="mb-4">Unlike traditional SEO, the goal isn't only to rank; it's to become a trusted <em>source</em> inside the answer itself.</p>
          <p>That means structuring pages so that LLMs can parse, cite, and attribute them with confidence.</p>
        </>
      )
    },
    {
      question: "How does Serplexity measure AI visibility?",
      answer: (
        <>
          <p className="mb-4">Our dashboard ingests the full text of AI answers and turns it into quantitative metrics:</p>
          <ul className="space-y-2 list-disc list-inside text-gray-400 mb-4">
            <li><span className="font-semibold text-white">Share of Voice:</span> The percentage of words—and citations—attributed to your brand versus competitors (visualised in the <em>Share of Voice</em> pie card).</li>
            <li><span className="font-semibold text-white">Inclusion Rate:</span> How often your domain appears across the monitored query set (tracked in the <em>Average Inclusion Rate</em> card).</li>
            <li><span className="font-semibold text-white">Average Position:</span> Where your first mention lands inside the answer narrative (early sentences vs. footnotes).</li>
            <li><span className="font-semibold text-white">Sentiment &amp; Topic Scores:</span> A multi-category radar chart showing how engines describe your brand (quality, price, trust, etc.).</li>
          </ul>
          <p>These metrics update automatically whenever a new report is generated.</p>
        </>
      )
    },
    {
      question: "Which AI engines and models are included?",
      answer: (
        <>
          <p className="mb-4">We currently monitor answers from:</p>
          <ul className="space-y-2 list-disc list-inside text-gray-400 mb-4">
            <li>Google Search (AI Overviews / Gemini-powered responses)</li>
            <li>OpenAI ChatGPT (GPT-4.1 &amp; GPT-4o)</li>
            <li>Perplexity Sonar</li>
            <li>Anthropic Claude</li>
          </ul>
          <p>The list expands as new engines gain adoption. You can filter results by model inside the dashboard filter bar.</p>
        </>
      )
    },
    {
      question: "Where do the keywords and questions come from?",
      answer: (
        <>
          <p className="mb-4">Our <em>Top Ranking Questions</em> card reveals the exact prompts that surface your brand. We start with your existing SEO keyword set, layer in engine-specific query logs, and continuously discover new conversational questions surfaced by the models.</p>
          <p>That means you're not guessing what people ask AI—you see the real language users type (and speak).</p>
        </>
      )
    },
    {
      question: "How do optimization recommendations work?",
      answer: (
        <>
          <p className="mb-4">Every daily report is paired with an <em>Optimization Checklist</em> that highlights missing citations, answer gaps, and on-page tweaks (structure, schema, language) proven to increase LLM recall.</p>
          <p>The checklist is generated automatically from your latest visibility data—no manual auditing required.</p>
        </>
      )
    },
    {
      question: "Will AIO hurt my traditional SEO rankings?",
      answer: (
        <>
          <p>No. The structural changes that help language models—clear headers, concise summaries, trustworthy sources—also align with Google's best-practice guidance for page experience. Most clients see flat or positive organic traffic alongside rising AI visibility.</p>
        </>
      )
    },
    {
      question: "How quickly can I expect to see improvements?",
      answer: (
        <>
          <p>Because AI answer indices refresh faster than classic search, brands often see citation lifts within one to two reporting cycles (typically days, not months). Competitive markets or large content backlogs can take longer, but progress is visible in the dashboard as it happens.</p>
        </>
      )
    }
  ];

  const companyLogos = [
    { file: 'Google_Gemini_logo.svg.png', name: 'Google Gemini' },
    { file: 'logo-perplexity-1024x258.png', name: 'Perplexity' },
    { file: 'OpenAI_Logo.svg.png', name: 'OpenAI' },
    { file: 'Anthropic-Logo.wine.svg', name: 'Anthropic' },
    { file: 'copilot-logo.png', name: 'GitHub Copilot' },
    { file: 'Grok-feb-2025-logo.svg.png', name: 'Grok' },
    { file: 'DeepSeek_logo.svg.png', name: 'DeepSeek' },
  ];

  const topRowLogos = companyLogos.slice(0, 4);
  const bottomRowLogos = companyLogos.slice(4, 7);

  return (
    <div className="bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510] text-white relative min-h-screen">
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
      
      /* Vertical Grid Lines */
      .vertical-grid-container {
        position: relative;
      }
      
      .vertical-grid-container::before,
      .vertical-grid-container::after {
        content: '';
        position: fixed;
        top: 0;
        bottom: 0;
        width: 1px;
        background: linear-gradient(
          to bottom,
          transparent 0%,
          rgba(82, 113, 255, 0.3) 10%,
          rgba(118, 98, 255, 0.4) 50%,
          rgba(158, 82, 255, 0.3) 90%,
          transparent 100%
        );
        box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
        z-index: 1;
        pointer-events: none;
        opacity: 0;
        /* animation is now defined in the rule below to avoid being overridden */
      }
      
      .vertical-grid-container::before {
        left: 6rem;
      }
      
      .vertical-grid-container::after {
        right: 6rem;
      }
      
      @keyframes gridFadeIn {
        to { opacity: 1; }
      }
      
      /* Hide on mobile for cleaner experience */
      @media (max-width: 768px) {
        .vertical-grid-container::before,
        .vertical-grid-container::after {
          display: none;
        }
      }
      
      /* Subtle pulse animation for added futuristic feel */
      .vertical-grid-container::before,
      .vertical-grid-container::after {
        animation: gridFadeIn 1.5s ease-out 0.5s forwards, gridPulse 4s ease-in-out infinite 2s;
      }
      
      @keyframes gridPulse {
        0%, 100% { 
          opacity: 1;
          box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
        }
        50% { 
          opacity: 0.7;
          box-shadow: 0 0 12px rgba(118, 98, 255, 0.7);
        }
      }
      

      
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
      `}</style>
      {/* Subtle background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
      
      {/* Shooting Stars */}
      <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0" />
      
      <div className="relative z-10 vertical-grid-container">
        <Navbar />
        
        {/* Enhanced Hero Section */}
        <section className="relative px-4 sm:px-6 lg:px-8 pt-44 md:pt-60 pb-20 md:pb-24">
          
          <div className="w-full px-4 md:px-[7rem] max-w-none">
            <div className="grid grid-cols-1 items-center">
              {/* Left Column - Content */}
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-left"
              >
                <h1 className="font-archivo text-6xl md:text-7xl lg:text-8xl font-semibold mb-6 text-white tracking-tighter leading-[1.4] max-w-6xl">
                  The Future of Search is
                  <br />
                  <span className="relative inline-block mt-4" style={{ paddingBottom: '15px' }}>
                    Looking{' '}
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={currentTextIndex}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -8, opacity: 0 }}
                        transition={{ 
                          duration: 0.4,
                          ease: "easeInOut"
                        }}
                        className="gradient-text-clip relative inline-block pb-2"
                        data-text={rotatingTexts[currentTextIndex]}
                      >
                        <span className="opacity-0">{rotatingTexts[currentTextIndex]}</span>
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </h1>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-lg md:text-xl text-gray-300 max-w-3xl mb-12 leading-relaxed"
                >
                  Serplexity is the complete software ecosystem purpose-built for AI search. Track, discover, and boost your visibility with the newest mediator of brand to customer relationships—AI agents.
                </motion.p>
                
                {/* CTA Buttons */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-4 mb-8"
                >
                  <button 
                    onClick={user ? handleDashboard : handleGetStarted}
                    className="px-8 py-4 bg-[#7762ff] hover:bg-[#6650e6] text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
                  >
                    <span className="flex items-center justify-center">
                      <span>
                        {user ? 'View Dashboard' : 'Boost Your Visibility'}
                      </span>
                      <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </motion.div>
              </motion.div>
              
            </div>
          </div>
        </section>
        
        {/* Key Statistics Section */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          onViewportEnter={() => setStatsVisible(true)}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="py-16 md:py-20"
        >
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-3xl md:text-4xl font-bold text-white mb-4"
              >
                The all-in-one brand SEO software for AI search engines
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-lg text-gray-300"
              >
                Join the leading brands already optimizing for the future of search
              </motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  label: 'Responses Analyzed', 
                  value: minutesProcessed, 
                  suffix: '+',
                  format: (num: number) => num.toLocaleString()
                },
                { 
                  label: 'Companies Mentioned', 
                  value: queriesOptimized, 
                  suffix: 'K+',
                  format: (num: number) => Math.floor(num / 1000).toString()
                },
                { 
                  label: 'Brands Enhanced', 
                  value: brandsHelped, 
                  suffix: '+',
                  format: (num: number) => num.toString()
                }
              ].map((stat, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="text-center p-8 bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]"
                >
                  <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                    {stat.format(stat.value)}{stat.suffix}
                  </div>
                  <div className="text-gray-300 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
        
        {/* Process Steps Section - Wave.co Style */}
        <section 
          ref={stepsContainerRef}
          className="relative py-16 md:py-20"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                How Serplexity Works
              </h2>
              <p className="text-lg text-gray-300">
                Three simple steps to dominate AI search results
              </p>
            </motion.div>
            
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
              {/* Left Column - Sticky Navigation */}
              <div className="relative">
                <div className="lg:sticky lg:top-24 lg:h-fit">
                  {/* Navigation Line */}
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[#5271ff]/20 via-[#7662ff]/20 to-[#9e52ff]/20 hidden lg:block"></div>
                  <motion.div 
                    className="absolute left-6 w-px bg-gradient-to-b from-[#5271ff] via-[#7662ff] to-[#9e52ff] origin-top hidden lg:block"
                    animate={{
                      height: `${((currentStep + 1) / 3) * 100}%`
                    }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  />
                  
                  {/* Steps Navigation */}
                  {[
                    {
                      title: 'Monitor',
                      description: 'Track your brand mentions across AI search engines and generative responses in real-time.'
                    },
                    {
                      title: 'Analyze', 
                      description: 'Get detailed insights on your AI visibility, competitor benchmarks, and optimization opportunities.'
                    },
                    {
                      title: 'Optimize',
                      description: 'Implement AI-ready content strategies that increase your chances of being cited by LLMs.'
                    }
                  ].map((step, index) => (
                    <motion.div 
                      key={index}
                      className="relative flex items-start mb-12 last:mb-0"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.2 }}
                    >
                      {/* Step Number */}
                      <motion.div 
                        className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white mr-6 lg:mr-8 transition-all duration-300 ${
                          index === currentStep 
                            ? 'bg-gradient-to-r from-[#5271ff] to-[#9e52ff] scale-110' 
                            : index < currentStep
                              ? 'bg-gradient-to-r from-[#5271ff] to-[#9e52ff]'
                              : 'bg-gray-600'
                        }`}
                        animate={{
                          boxShadow: index === currentStep 
                            ? '0 0 20px rgba(119, 98, 255, 0.6)' 
                            : '0 0 0px rgba(119, 98, 255, 0)'
                        }}
                      >
                        {index + 1}
                      </motion.div>
                      
                      {/* Step Content */}
                      <motion.div 
                        className="flex-1 pt-2"
                        animate={{
                          opacity: index === currentStep ? 1 : 0.6
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <h3 className={`text-xl font-semibold mb-3 transition-colors duration-300 ${
                          index === currentStep ? 'text-white' : 'text-gray-400'
                        }`}>
                          {step.title}
                        </h3>
                        <p className={`leading-relaxed transition-colors duration-300 ${
                          index === currentStep ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {step.description}
                        </p>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              </div>
              
              {/* Right Column - Stacked Images/Content */}
              <div className="relative lg:sticky lg:top-24">
                {/* All steps stacked with minimal spacing */}
                <div className="space-y-4">
                  {/* Step 1 Content */}
                  <motion.div 
                    ref={step1Ref}
                    data-step="0"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    <div className={`relative w-full h-80 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-3xl overflow-hidden border transition-all duration-500 ${
                      currentStep === 0 
                        ? 'border-[#7762ff] shadow-[0_0_30px_rgba(119,98,255,0.3)] scale-105 opacity-100' 
                        : 'border-white/10 opacity-40 scale-95'
                    }`}>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(119,98,255,0.15),transparent_70%)]" />
                    </div>
                  </motion.div>
                  
                  {/* Step 2 Content */}
                  <motion.div 
                    ref={step2Ref}
                    data-step="1"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    <div className={`relative w-full h-80 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-3xl overflow-hidden border transition-all duration-500 ${
                      currentStep === 1 
                        ? 'border-[#7762ff] shadow-[0_0_30px_rgba(119,98,255,0.3)] scale-105 opacity-100' 
                        : 'border-white/10 opacity-40 scale-95'
                    }`}>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(119,98,255,0.15),transparent_70%)]" />
                    </div>
                  </motion.div>
                  
                  {/* Step 3 Content */}
                  <motion.div 
                    ref={step3Ref}
                    data-step="2"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    <div className={`relative w-full h-80 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-3xl overflow-hidden border transition-all duration-500 ${
                      currentStep === 2 
                        ? 'border-[#7762ff] shadow-[0_0_30px_rgba(119,98,255,0.3)] scale-105 opacity-100' 
                        : 'border-white/10 opacity-40 scale-95'
                    }`}>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(119,98,255,0.15),transparent_70%)]" />
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
          className="py-16 md:py-20"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-bold text-white mb-4"
              >
                See Serplexity in Action
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-lg text-gray-300"
              >
                Comprehensive AI search optimization at your fingertips
              </motion.p>
            </div>
            
            <div id="product-preview" className="dashboard-preview-container">
              {/* Dashboard Preview */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="dashboard-preview-content"
              >
                {isLargeScreen ? (
                  <DashboardPreviewCarousel />
                ) : (
                  <img
                    src="/mock_dashboard.png"
                    alt="Dashboard preview"
                    className="w-full rounded-xl shadow-lg"
                    style={{ maxWidth: 600, margin: '0 auto' }}
                  />
                )}
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Company Logos Section - Enhanced */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="py-16 md:py-20"
        >
          <div className="w-full max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-lg font-semibold text-gray-400 uppercase tracking-wide mb-2"
              >
                Optimizing for AI search across leading engines
              </motion.h2>
            </div>
            {/* Marquee for mobile/medium */}
            <div className="block lg:hidden marquee-container">
              <div className="marquee-track">
                {[...companyLogos, ...companyLogos].map((logo, i) => (
                  <img
                    key={i}
                    src={`/${logo.file}`}
                    alt={`${logo.name} logo`}
                    className="marquee-logo"
                    style={{
                      height:
                        logo.file === 'Anthropic-Logo.wine.svg'
                          ? '128px'
                          : logo.file === 'logo-perplexity-1024x258.png'
                            ? '42px'
                            : (logo.file === 'Google_Gemini_logo.svg.png')
                              ? '32px'
                              : (logo.file === 'OpenAI_Logo.svg.png')
                                ? '32px'
                                : '48px',
                      filter: 'brightness(0) invert(1)',
                      marginTop: logo.file === 'OpenAI_Logo.svg.png'
                        ? '4px'
                        : logo.file === 'Google_Gemini_logo.svg.png'
                          ? '-8px'
                          : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Grid for large screens */}
            <div className="hidden lg:block max-w-6xl mx-auto">
              {/* Top row - 4 logos */}
              <div className="grid grid-cols-4 gap-x-8 gap-y-8 items-center justify-items-center mb-8">
                {topRowLogos.map((logo, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className={
                      logo.file === 'Anthropic-Logo.wine.svg'
                        ? 'w-48 h-48 flex items-center justify-center'
                        : logo.file === 'logo-perplexity-1024x258.png'
                          ? 'w-44 h-36 flex items-center justify-center'
                          : 'w-32 h-32 flex items-center justify-center'
                    }
                  >
                    <img
                      src={`/${logo.file}`}
                      alt={`${logo.name} logo`}
                      className="w-auto object-contain transition-all duration-300 hover:scale-110 hover:brightness-125"
                      style={{
                        height:
                          logo.file === 'Anthropic-Logo.wine.svg'
                            ? '160px'
                            : logo.file === 'logo-perplexity-1024x258.png'
                              ? '110px'
                              : logo.file === 'Google_Gemini_logo.svg.png'
                                ? '36px'
                                : '48px',
                        filter: 'brightness(0) invert(1)',
                      }}
                    />
                  </motion.div>
                ))}
              </div>
              
              {/* Bottom row - 3 logos centered */}
              <div className="grid grid-cols-3 gap-x-8 gap-y-8 items-center justify-items-center max-w-3xl mx-auto">
                {bottomRowLogos.map((logo, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: (i + 4) * 0.1 }}
                    className="w-32 h-32 flex items-center justify-center"
                  >
                    <img
                      src={`/${logo.file}`}
                      alt={`${logo.name} logo`}
                      className="w-auto object-contain transition-all duration-300 hover:scale-110 hover:brightness-125"
                      style={{
                        height:
                          logo.file === 'copilot-logo.png'
                            ? '48px'
                            : logo.file === 'Grok-feb-2025-logo.svg.png'
                              ? '42px'
                              : logo.file === 'DeepSeek_logo.svg.png'
                                ? '56px'
                                : '48px',
                        filter: 'brightness(0) invert(1)',
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Research Section */}
        <SlideIn>
          <section id="research" className="pt-12 md:pt-16 pb-12 md:pb-16">
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
                  Latest Research & Insights
                </h2>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                  Access state of the industry reports and leading research on AI search.
                </p>
              </div>
              
              {/* Blog Posts - Loading State */}
              {postsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7762ff] mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading latest research...</p>
                  </div>
                </div>
              ) : postsError ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Unable to load articles</h3>
                  <p className="text-gray-400">{postsError}</p>
                </div>
              ) : blogPosts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No articles yet</h3>
                  <p className="text-gray-400">Check back soon for insights and research from our team.</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Horizontal scrollable */}
                  <div className="md:hidden">
                    <div className="flex overflow-x-auto gap-6 px-4 -mx-4 pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {blogPosts.map((post) => (
                        <article
                          key={post.id}
                          onClick={() => navigate(`/research/${post.slug}`)}
                          className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 hover:bg-black/10 transition-all duration-200 group cursor-pointer flex-shrink-0 w-80"
                        >
                          {/* Blog Post Image */}
                          <div className="w-full h-48 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-xl mb-6 overflow-hidden">
                            {post.coverImage ? (
                              <img
                                src={post.coverImage}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                                  <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Blog Post Content */}
                          <div className="space-y-4">
                            {/* Category Tag & Date */}
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-[#5271ff]/20 text-[#5271ff] rounded-full text-xs font-medium">
                                {extractFirstCategory(post.tags)}
                              </span>
                              <span className="text-gray-400 text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatBlogDate(post.publishedAt || post.createdAt)}
                              </span>
                            </div>
                            
                            {/* Title */}
                            <h3 className="text-xl font-semibold text-white group-hover:text-gray-100 transition-colors line-clamp-2">
                              {post.title}
                            </h3>
                            
                            {/* Description */}
                            <p className="text-gray-300 text-sm line-clamp-3">
                              {post.excerpt 
                                ? truncateText(stripHtmlTags(post.excerpt), 120)
                                : truncateText(stripHtmlTags(post.content), 120)
                              }
                            </p>
                            
                            {/* Read More Link & Read Time */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-[#5271ff] text-sm font-medium group-hover:text-[#7662ff] transition-colors">
                                <span>Read more</span>
                                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                              </div>
                              <div className="flex items-center text-gray-400 text-xs gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{estimateReadTime(post.content)} min read</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                  
                  {/* Desktop: Grid layout */}
                  <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blogPosts.map((post) => (
                      <article
                        key={post.id}
                        onClick={() => navigate(`/research/${post.slug}`)}
                        className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 hover:bg-black/10 transition-all duration-200 group cursor-pointer"
                      >
                        {/* Blog Post Image */}
                        <div className="w-full h-48 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-xl mb-6 overflow-hidden">
                          {post.coverImage ? (
                            <img
                              src={post.coverImage}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Blog Post Content */}
                        <div className="space-y-4">
                          {/* Category Tag & Date */}
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-[#5271ff]/20 text-[#5271ff] rounded-full text-xs font-medium">
                              {extractFirstCategory(post.tags)}
                            </span>
                            <span className="text-gray-400 text-xs flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatBlogDate(post.publishedAt || post.createdAt)}
                            </span>
                          </div>
                          
                          {/* Title */}
                          <h3 className="text-xl font-semibold text-white group-hover:text-gray-100 transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                          
                          {/* Description */}
                          <p className="text-gray-300 text-sm line-clamp-3">
                            {post.excerpt 
                              ? truncateText(stripHtmlTags(post.excerpt), 120)
                              : truncateText(stripHtmlTags(post.content), 120)
                            }
                          </p>
                          
                          {/* Read More Link & Read Time */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-[#5271ff] text-sm font-medium group-hover:text-[#7662ff] transition-colors">
                              <span>Read more</span>
                              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                            <div className="flex items-center text-gray-400 text-xs gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{estimateReadTime(post.content)} min read</span>
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
                  onClick={() => navigate('/research')}
                  className="bg-white/10 text-white hover:bg-white/20 px-8 py-3 rounded-full font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 mx-auto"
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
          <section id="comparison" className="pt-12 md:pt-16 pb-20 md:pb-24 relative hidden md:block">
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
                  Why Traditional SEO <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">Isn't Enough</span>
                </h2>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                  As generative engines reshape search, brands need a new playbook
                </p>
              </div>
              
              <div className="relative">
                {/* Enhanced glass morphism container */}
                <div className="bg-black/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden relative">
                  {/* Subtle gradient border glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/5 via-[#7662ff]/5 to-[#9e52ff]/5 rounded-3xl blur-xl"></div>
                  
                  {/* Responsive table wrapper */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-gradient-to-r from-black/20 to-black/10 backdrop-blur-sm border-b border-white/10">
                        <tr>
                          <th className="px-6 md:px-8 py-6 text-left text-base md:text-lg font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <Target className="w-5 h-5 text-gray-400" />
                              Capabilities
                            </div>
                          </th>
                          <th className="px-6 md:px-8 py-6 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-base md:text-lg font-semibold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent">
                                Serplexity Pro
                              </span>
                              <span className="text-xs text-gray-500 font-normal">Subscription</span>
                            </div>
                          </th>
                          <th className="px-6 md:px-8 py-6 text-center text-base md:text-lg font-semibold text-gray-300">
                            <div className="flex flex-col items-center gap-1">
                              <span>Traditional SEO</span>
                              <span className="text-xs text-gray-500 font-normal">Legacy Approach</span>
                            </div>
                          </th>
                          <th className="px-6 md:px-8 py-6 text-center text-base md:text-lg font-semibold text-gray-300">
                            <div className="flex flex-col items-center gap-1">
                              <span>Content Agencies</span>
                              <span className="text-xs text-gray-500 font-normal">Standard Service</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {[
                          { name: "Track AI Search Mentions", description: "Direct quotes in AI responses" },
                          { name: "LLM Content Optimization", description: "AI-ready content structure" }, 
                          { name: "Competitor Benchmarking", description: "Track the competitors' Share of Voice" },
                          { name: "Sentence-Level Attribution", description: "Precise citation analysis" },
                          { name: "Adaptive Growth Strategy", description: "Win the evolving AI landscape" }
                        ].map((feature, i) => (
                          <tr key={i} className="hover:bg-white/3 transition-all duration-300 group">
                            <td className="px-6 md:px-8 py-6">
                              <div>
                                <div className="text-base font-semibold text-white group-hover:text-gray-100 transition-colors">{feature.name}</div>
                                <div className="text-sm text-gray-400 mt-1">{feature.description}</div>
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-6 text-center">
                              <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                                  <Check className="w-5 h-5 text-green-400" />
                                </div>
                              </div>
                            </td>
                                                       <td className="px-6 md:px-8 py-6 text-center">
                               <div className="flex justify-center">
                                 <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                                   <X className="w-5 h-5 text-red-400" />
                                 </div>
                               </div>
                             </td>
                            <td className="px-6 md:px-8 py-6 text-center">
                              <div className="flex justify-center">
                                {i === 0 || i === 2 || i === 3 || i === 4 ? (
                                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                                    <X className="w-5 h-5 text-red-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                                    <Check className="w-5 h-5 text-green-400" />
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
                  <div className="bg-gradient-to-r from-[#5271ff]/5 to-[#9e52ff]/5 border-t border-white/10 px-6 md:px-8 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="text-center md:text-left">
                        <p className="text-white font-semibold">Ready to enhance your visibility?</p>
                        <p className="text-gray-300 text-sm">Join the brands already leveraging GEO for competitive advantage</p>
                      </div>
                      <div className="relative z-10">
                        <button 
                          onClick={user ? handleDashboard : handleGetStarted}
                          className="bg-[#7762ff] hover:bg-[#6650e6] text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                          {user ? 'View Dashboard' : 'Get Started Today'}
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
                <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
                  Simple, Transparent Pricing
                </h2>
                <p className="text-xl text-gray-300">
                  Choose the plan that's right for your brand's growth.
                </p>
              </div>
              
              {/* Enhanced Liquid Glass Container */}
              <div className="relative bg-black/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 md:p-8 overflow-hidden">
                {/* Glass morphism border glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/10 via-[#7662ff]/10 to-[#9e52ff]/10 rounded-3xl blur-xl"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-3xl"></div>
                
                {/* Inner content with relative positioning */}
                <div className="relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                          "AI Content Optimization Tools"
                        ], 
                        description: "Paid Monthly" 
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
                          "AI Content Optimization Tools"
                        ], 
                        popular: true, 
                        description: "Paid Annually" 
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
                          "Dedicated Account Manager"
                        ], 
                        description: "For large-scale or custom needs" 
                      }
                    ].map((plan, i) => (
                      <div key={i} className={`bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 group flex flex-col ${plan.popular ? 'shadow-[0_0_20px_rgba(119,98,255,0.5)] relative' : ''}`}>
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <span className="bg-gradient-to-r from-[#5271ff] to-[#9e52ff] text-white px-3 py-1 rounded-full text-xs font-medium">
                              Most Popular
                            </span>
                          </div>
                        )}
                        <div className="text-center mb-6">
                          <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
                          <div className="text-3xl font-bold text-white mb-2">
                            {plan.price}
                            {plan.pricePeriod && <span className="text-sm font-medium text-gray-400">{plan.pricePeriod}</span>}
                          </div>
                          <p className="text-xs text-gray-400">{plan.description}</p>
                        </div>
                        <ul className="space-y-3 mb-8 flex-grow">
                          {plan.features.map((feature, j) => (
                            <li key={j} className="flex items-start text-gray-300 text-sm">
                              <Check className="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <button 
                          onClick={() => handleCheckout(plan.priceId as string)}
                          className={`w-full py-3 px-6 rounded-full font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                          plan.popular 
                            ? 'bg-[#7762ff] hover:bg-[#6650e6] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' 
                            : 'bg-white/10 text-white hover:bg-white/20 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                        }`}>
                          {plan.price === 'By Request' ? 'Contact Sales' : 'Get Started'}
                          <ArrowRight className="w-4 h-4" />
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
          <section id="faq" className="pt-12 md:pt-16 pb-12 md:pb-16">
            <div className="max-w-4xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
                  Frequently Asked Questions
                </h2>
                <p className="text-xl text-gray-300">
                  Everything you need to know about Generative Engine Optimization
                </p>
              </div>
              
              <Accordion items={faqItems} />
            </div>
          </section>
        </SlideIn>

        {/* Landing Page Footer */}
        <footer className="bg-transparent">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="inline-grid grid-cols-3 md:grid-cols-4 gap-8 text-left">
                {/* Links */}
                {[
                  { title: "Product", links: [
                    { label: "About", href: "#solutions" },
                    { label: "Pricing", href: "#pricing" }
                  ]},
                  { title: "Legal", links: [
                    { label: "Privacy Policy", href: "/privacy" },
                    { label: "Terms of Service", href: "/terms" }
                  ]},
                  { title: "Pages", links: [
                    { label: "Login", href: "/login" },
                    { label: "Sign Up", href: "/register" }
                  ]}
                ].map((column, i) => (
                  <div key={i}>
                    <h3 className="font-semibold text-white mb-4">{column.title}</h3>
                    <ul className="space-y-2">
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <a href={link.href} className="text-gray-400 hover:text-white transition-colors">
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
                      { href: 'https://www.linkedin.com/company/serplexity', icon: <FaLinkedin className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> },
                      { href: '#', icon: <FaXTwitter className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> }
                    ].map((social, i) => (
                      <a href={social.href} key={i} className="group w-8 h-8 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-200 cursor-pointer">
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 mt-12 pt-8 text-gray-400">
              {/* Desktop Footer */}
              <div className="hidden md:flex items-center justify-between">
                <p className="text-sm">&copy; {new Date().getFullYear()} Serplexity. All rights reserved.</p>
                <div className="flex items-center">
                  <img src="/Serplexity.png" alt="Serplexity" className="w-6 h-6 mr-2" />
                  <span className="text-lg font-bold text-white">Serplexity</span>
                </div>
              </div>
              {/* Mobile Footer */}
              <div className="md:hidden">
                <div className="flex items-center justify-center gap-x-6">
                  <div className="flex items-center">
                    <img src="/Serplexity.
                    png" alt="Serplexity" className="w-6 h-6 mr-2" />
                    <span className="text-lg font-bold text-white">Serplexity</span>
                  </div>
                  <div className="flex space-x-4">
                    {[
                      { href: 'https://www.linkedin.com/company/serplexity', icon: <FaLinkedin className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> },
                      { href: '#', icon: <FaXTwitter className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> }
                    ].map((social, i) => (
                      <a href={social.href} key={i} className="group w-8 h-8 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-200 cursor-pointer">
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-center mt-8">&copy; {new Date().getFullYear()} Serplexity. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage; 