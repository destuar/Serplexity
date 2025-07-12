import React, { useEffect, useRef } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { BarChart2, Sparkles, Target, Check, X, ArrowRight } from 'lucide-react';
import { FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '../components/ui/FadeIn';
import { SlideIn } from '../components/ui/SlideIn';
import { Accordion } from '../components/ui/Accordion';
import { loadStripe } from '@stripe/stripe-js';
import { createCheckoutSession } from '../services/paymentService';
import DashboardPreviewCarousel from '../components/landing/DashboardPreviewCarousel';
import { useMediaQuery } from '../hooks/useMediaQuery';

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const starContainerRef = useRef<HTMLDivElement>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');

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
        left: max(2rem, calc(50vw - 576px));
      }
      
      .vertical-grid-container::after {
        right: max(2rem, calc(50vw - 576px));
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
      
      /* Horizontal Section Dividers */
      .section-divider {
        height: 1px;
        background: linear-gradient(
          to right,
          transparent 0%,
          rgba(82, 113, 255, 0.2) 15%,
          rgba(118, 98, 255, 0.4) 35%,
          rgba(158, 82, 255, 0.5) 50%,
          rgba(118, 98, 255, 0.4) 65%,
          rgba(82, 113, 255, 0.2) 85%,
          transparent 100%
        );
        box-shadow: 0 0 6px rgba(118, 98, 255, 0.3);
        margin: 8rem auto;
        max-width: 1200px;
        opacity: 0;
        transform: scaleX(0);
        /* Animation is now handled by .top-divider and .in-view for better control */
        position: relative;
      }
      
      @keyframes dividerReveal {
        0% {
          opacity: 0;
          transform: scaleX(0);
        }
        60% {
          opacity: 0.8;
          transform: scaleX(1.02);
        }
        100% {
          opacity: 0.6;
          transform: scaleX(1);
        }
      }
      
      /* Intersection Observer trigger classes */
      .top-divider,
      .section-divider.in-view {
        animation: dividerReveal 1.5s ease-out 0.5s forwards;
      }
      
      /* Dashboard Preview Container Styling */
      .dashboard-preview-container {
        position: relative;
        margin: 1rem 0;
        padding: 1rem 0;
      }
      
      .dashboard-frame-line {
        height: 1px;
        background: linear-gradient(
          to right,
          transparent 0%,
          rgba(82, 113, 255, 0.15) 10%,
          rgba(118, 98, 255, 0.3) 25%,
          rgba(158, 82, 255, 0.4) 50%,
          rgba(118, 98, 255, 0.3) 75%,
          rgba(82, 113, 255, 0.15) 90%,
          transparent 100%
        );
        box-shadow: 0 0 8px rgba(118, 98, 255, 0.2);
        max-width: 1400px;
        margin: 0 auto;
        opacity: 0;
        transform: scaleX(0);
        position: relative;
      }
      
      .dashboard-frame-top {
        animation: dashboardFrameReveal 1.5s ease-out 0.5s forwards;
      }
      
      .dashboard-frame-bottom {
        animation: dashboardFrameReveal 1.5s ease-out 0.5s forwards;
      }
      
      /* Subtle corner accents */
      .dashboard-frame-line::before,
      .dashboard-frame-line::after {
        content: '';
        position: absolute;
        top: 50%;
        width: 12px;
        height: 12px;
        background: radial-gradient(circle, rgba(118, 98, 255, 0.6) 0%, transparent 70%);
        border-radius: 50%;
        transform: translateY(-50%);
        box-shadow: 0 0 8px rgba(118, 98, 255, 0.4);
        opacity: 0;
        animation: cornerAccentFade 1s ease-out 1.5s forwards;
      }
      
      .dashboard-frame-line::before {
        left: 10%;
      }
      
      .dashboard-frame-line::after {
        right: 10%;
      }
      
      @keyframes dashboardFrameReveal {
        0% {
          opacity: 0;
          transform: scaleX(0);
        }
        70% {
          opacity: 0.8;
          transform: scaleX(1.01);
        }
        100% {
          opacity: 0.5;
          transform: scaleX(1);
        }
      }
      
      @keyframes cornerAccentFade {
        to {
          opacity: 0.7;
        }
      }
      
      /* Dashboard content enhancement */
      .dashboard-preview-content {
        position: relative;
        z-index: 2;
      }
      
      /* Contained grid glow - fills EXACTLY the rectangle defined by frame lines */
      .dashboard-preview-container::before {
        content: '';
        position: absolute;
        top: 1px;  /* Start after top frame line */
        left: max(2rem, calc(50vw - 576px));  /* Align with vertical grid lines */
        right: max(2rem, calc(50vw - 576px)); /* Align with vertical grid lines */
        bottom: 1px; /* End before bottom frame line */
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
        border-radius: 0;
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
      
      /* Responsive adjustments */
      @media (max-width: 768px) {
        .dashboard-preview-container {
          margin: 2rem 0;
          padding: 2rem 0;
        }
        
        .dashboard-frame-line {
          max-width: 90%;
          box-shadow: 0 0 4px rgba(118, 98, 255, 0.15);
        }
        
        .dashboard-frame-top {
          margin-bottom: 2rem;
        }
        
        .dashboard-frame-bottom {
          margin-top: 2rem;
        }
        
        .dashboard-frame-line::before,
        .dashboard-frame-line::after {
          width: 8px;
          height: 8px;
          box-shadow: 0 0 6px rgba(118, 98, 255, 0.3);
        }
        
        .dashboard-preview-content {
          padding: 0 1rem;
        }
        
        /* Mobile glow adjustments */
        .dashboard-preview-container::before {
          left: 1rem;
          right: 1rem;
          box-shadow: 
            inset 0 0 15px rgba(118, 98, 255, 0.04),
            0 0 20px rgba(118, 98, 255, 0.08);
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
        
        {/* Hero Section */}
        <section className="relative flex flex-col items-center px-4 pt-28 md:pt-36 pb-20 md:pb-24">
          
          {/* Top Divider for Hero Section */}
          <div className="absolute -top-8 left-0 right-0">
            <div className="section-divider my-0 top-divider"></div>
          </div>

          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
            <h1 className="text-6xl md:text-7xl font-bold mb-6 text-white tracking-tight">
              The Future of Search<br className="hidden md:block" />
              <span className="md:inline">&nbsp;is </span>
              <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent relative">
                Generative
                <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent opacity-25 blur-sm">
                  Generative
                </div>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto mt-2 mb-8 leading-relaxed">
              <span className="md:hidden">Enhance your visibility with Google SGE, Gemini, Perplexity, ChatGPT, and beyond. Software purpose-built for the era of AI search. </span>
              <span className="hidden md:inline">Enhance your visibility with Google SGE, Gemini, Perplexity, ChatGPT, and beyond. Software purpose-built for the era of AI search. </span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-center">
              <button 
                onClick={user ? handleDashboard : handleGetStarted}
                className="px-8 py-4 bg-[#7762ff] hover:bg-[#6650e6] text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 relative"
              >
                <span className="flex items-center justify-center">
                  <span>
                    {user ? 'View Dashboard' : 'Boost Your Visibility'} <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* Dashboard Preview Container */}
          <div id="product-preview" className="dashboard-preview-container">
            {/* Top containment line */}
            <div className="dashboard-frame-line dashboard-frame-top"></div>
            
            {/* Dashboard Preview */}
            <div className="dashboard-preview-content">
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
            </div>
          </div>

          {/* Company Logos */}
          <div className="w-full max-w-7xl mx-auto px-4">
            <div className="text-center pt-0 md:pt-2 mb-2">
              <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-8 md:mt-12">
                Optimizing for AI search across leading engines
              </h2>
            </div>
            {/* Marquee for mobile/medium */}
            <div className="block lg:hidden marquee-container mt-8 lg:mt-0">
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
            <div className="hidden lg:block max-w-6xl mx-auto pt-2 md:pt-4 pb-0">
              {/* Top row - 4 logos */}
              <div className="grid grid-cols-4 gap-x-8 gap-y-8 items-center justify-items-center mb-2">
                {topRowLogos.map((logo, i) => (
                  <div
                    key={i}
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
                      className="w-auto object-contain"
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
                  </div>
                ))}
              </div>
              
              {/* Bottom row - 3 logos centered */}
              <div className="grid grid-cols-3 gap-x-8 gap-y-8 items-center justify-items-center max-w-3xl mx-auto mb-0">
                {bottomRowLogos.map((logo, i) => (
                  <div
                    key={i}
                    className="w-32 h-32 flex items-center justify-center"
                  >
                    <img
                      src={`/${logo.file}`}
                      alt={`${logo.name} logo`}
                      className="w-auto object-contain"
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

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
              
              {/* Blog Posts - Mobile Swipeable, Desktop Grid */}
              <div className="md:hidden">
                {/* Mobile: Horizontal scrollable */}
                <div className="flex overflow-x-auto gap-6 px-4 -mx-4 pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {[1, 2, 3].map((post, i) => (
                    <div key={i} className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 hover:bg-black/10 transition-all duration-200 group cursor-pointer flex-shrink-0 w-80">
                      {/* Blog Post Image Placeholder */}
                      <div className="w-full h-48 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-xl mb-6 flex items-center justify-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Blog Post Content */}
                      <div className="space-y-4">
                        {/* Category Tag */}
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-[#5271ff]/20 text-[#5271ff] rounded-full text-xs font-medium">
                            {/* Category placeholder */}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {/* Date placeholder */}
                          </span>
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-xl font-semibold text-white group-hover:text-gray-100 transition-colors line-clamp-2">
                          {/* Title placeholder */}
                        </h3>
                        
                        {/* Description */}
                        <p className="text-gray-300 text-sm line-clamp-3">
                          {/* Description placeholder */}
                        </p>
                        
                        {/* Read More Link */}
                        <div className="flex items-center text-[#5271ff] text-sm font-medium group-hover:text-[#7662ff] transition-colors">
                          <span>{/* Read more placeholder */}</span>
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Desktop: Grid layout */}
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3].map((post, i) => (
                  <div key={i} className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 hover:bg-black/10 transition-all duration-200 group cursor-pointer">
                    {/* Blog Post Image Placeholder */}
                    <div className="w-full h-48 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-xl mb-6 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Blog Post Content */}
                    <div className="space-y-4">
                      {/* Category Tag */}
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-[#5271ff]/20 text-[#5271ff] rounded-full text-xs font-medium">
                          {/* Category placeholder */}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {/* Date placeholder */}
                        </span>
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-xl font-semibold text-white group-hover:text-gray-100 transition-colors line-clamp-2">
                        {/* Title placeholder */}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-gray-300 text-sm line-clamp-3">
                        {/* Description placeholder */}
                      </p>
                      
                      {/* Read More Link */}
                      <div className="flex items-center text-[#5271ff] text-sm font-medium group-hover:text-[#7662ff] transition-colors">
                        <span>{/* Read more placeholder */}</span>
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* View All Posts Button */}
              <div className="text-center mt-6 md:mt-12">
                <button className="bg-white/10 text-white hover:bg-white/20 px-8 py-3 rounded-full font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 mx-auto">
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
                    <img src="/Serplexity.png" alt="Serplexity" className="w-6 h-6 mr-2" />
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