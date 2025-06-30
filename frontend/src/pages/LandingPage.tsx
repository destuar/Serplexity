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
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (starContainerRef.current) {
        starContainerRef.current.innerHTML = '';
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
  ];

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
      `}</style>
      {/* Subtle background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
      
      {/* Shooting Stars */}
      <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0" />
      
      <div className="relative z-10">
        <Navbar />
        
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center min-h-screen px-4 pt-40 md:pt-48 pb-24">
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
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mt-2 mb-8 leading-relaxed">
              <span className="md:hidden">We are the first agency purpose-built for the generative era of SEO. Enhance your visibility with Google SGE, Gemini, Perplexity, ChatGPT, and beyond.</span>
              <span className="hidden md:inline">We are the first agency purpose-built for the generative era of SEO. Enhance your visibility with Google SGE, Gemini,Perplexity, ChatGPT, and beyond.</span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16 justify-center">
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

          {/* Dashboard Preview */}
          <div id="product-preview">
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

          {/* Company Logos */}
          <div className="w-full max-w-7xl mx-auto px-4">
            <div className="text-center pt-0 md:pt-2 mb-2">
              <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-16 md:mt-20">
                Optimizing for AI search citations across leading engines
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
            <div className="hidden lg:grid grid-cols-4 gap-x-8 gap-y-8 items-center justify-items-center max-w-6xl mx-auto pt-2 md:pt-4">
              {companyLogos.map((logo, i) => (
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
          </div>
        </section>

        {/* Story Section */}
        <section id="story" className="py-24">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">

            <div className="flex flex-col space-y-40">
              <FadeIn direction="right" className="self-start">
                <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-tight max-w-3xl text-left">
                  Search is fundamnetally changing. <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">AI answers now appear in over 50% of Google searches</span>, pushing traditional blue links furtherdown the page.
                </p>
              </FadeIn>
              <FadeIn delay={100} direction="left" className="self-end">
                <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-tight max-w-3xl text-right">
                This is more than a trend—AI Overview footprints have more than <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">doubled in the last year</span> and continues accelerating across all major search engines.
                </p>
              </FadeIn>
              <FadeIn delay={200} direction="right" className="self-start">
                <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-tight max-w-3xl text-left">
                  On mobile, these AI answers can <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">dominate nearly half the screen</span>, pushing out traditional organic results.
                </p>
              </FadeIn>
              <FadeIn delay={300} direction="left" className="self-end">
                <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-tight max-w-3xl text-right">
                  Brands not cited lose <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">up to 35% of potential traffic</span> when an AI Overview appears for their target keywords.
                </p>
              </FadeIn>
              <FadeIn delay={400} direction="right" className="self-start">
                <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-tight max-w-3xl text-left">
                  This is an opportunity—pages that <em>are</em> cited inside AI answers <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">receive 40% more traffic</span> than traditional blue links with clicks worth 4.4x more.
                </p>
              </FadeIn>
              <FadeIn delay={500} direction="left" className="self-end">
                <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-tight max-w-3xl text-right">
                  ChatGPT processes <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">5 billion+ visits</span>, Perplexity handles more than <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">400 million questions</span>, and Claude serves a growing <span className="whitespace-nowrap"><span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">19 million</span> active users every month</span>.
                </p>
              </FadeIn>
              <FadeIn delay={600} className="self-center">
                <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-tight max-w-4xl text-center">
                  Your competitors are already adapting. The brands that build AI citation optimization <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">will dominate the next decade of search</span>.
                </p>
              </FadeIn>
            </div>

            {/* Feature Showcase (moved inside story section) */}
            <SlideIn>
              <div id="solutions" className="mt-48 relative">
                {/* Liquid Glass Container - Made wider */}
                <div className="relative bg-black/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 md:p-12 lg:p-16 overflow-hidden max-w-7xl mx-auto">
                  {/* Glass morphism border glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/10 via-[#7662ff]/10 to-[#9e52ff]/10 rounded-3xl blur-xl"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-3xl"></div>
                  
                  {/* Inner content with relative positioning */}
                  <div className="relative z-10">
                    <div className="text-center mb-16">
                      <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
                        Right Now, You Might Be Invisible
                      </h2>
                      <p className="text-xl text-gray-300 max-w-4xl mx-auto">
                        While your others are boosting their visibility, your brand could be missing from the conversation entirely. Here's everything you need to measure, improve, and build your AI search presence.
                      </p>
                    </div>
                    
                    {/* Two-column layout: Features on left, Tweet on right */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                      {/* Left column - Features stacked vertically */}
                      <div className="space-y-8 flex flex-col h-full">
                        {[
                          { icon: Sparkles, title: "AI Visibility Analytics", desc: "Discover if you're being cited in AI answers across Google AI Overviews, ChatGPT, Perplexity, and Claude. Track your share of voice versus competitors and identify which queries are driving citations." },
                          { icon: BarChart2, title: "Citation-Ready Content Optimization", desc: "Transform your existing content into AI-preferred formats. Our tool analyzes your pages and provides specific rewrites that increase your visibility." },
                          { icon: Target, title: "Competitive Intelligence Reports", desc: "See exactly which competitors are dominating AI citations in your space. Get daily alerts when they gain ground and actionable strategies to outrank them." }
                        ].map((feature, i) => (
                          <div key={i} className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 hover:bg-black/10 transition-all duration-200 group flex-grow">
                            {/* Icon with gradient background */}
                            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-[#5271ff] to-[#9e52ff] mb-6 group-hover:shadow-lg transition-all duration-200">
                              <feature.icon className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                            <p className="text-gray-300 leading-relaxed">{feature.desc}</p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Right column - Twitter Embed */}
                      <div className="flex justify-center lg:justify-end h-full">
                        <div className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-4 md:p-8 hover:bg-black/10 transition-all duration-200 w-full max-w-md">
                          <div className="flex justify-center items-center h-full">
                            <blockquote className="twitter-tweet" data-theme="dark" data-align="center">
                              <p lang="en" dir="ltr">
                                SEO is slowly losing its dominance. Welcome to GEO.<br/><br/>
                                In the age of ChatGPT, Perplexity, and Claude, Generative Engine Optimization is positioned to become the new playbook for brand visibility.<br/><br/>
                                It&#39;s not about gaming the algorithm — it&#39;s about being cited by it.<br/><br/>
                                The brands that… <a href="https://t.co/jsjZ4ee8Z6">pic.twitter.com/jsjZ4ee8Z6</a>
                              </p>
                              &mdash; a16z (@a16z) <a href="https://twitter.com/a16z/status/1927766844062011834?ref_src=twsrc%5Etfw">May 28, 2025</a>
                            </blockquote>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SlideIn>
          </div>
        </section>

        {/* Comparison Table Section */}
        <SlideIn>
          <section id="comparison" className="py-24 relative">
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
                  Why Traditional SEO <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">Isn't Enough</span>
                </h2>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                  As generative engines reshape search, brands need specialized GEO expertise to stay relevant and competitive
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
                          { name: "Generative Engine Citations", description: "Direct quotes in AI responses" },
                          { name: "LLM Content Optimization", description: "AI-ready content structure" }, 
                          { name: "AI Visibility Tracking", description: "Monitor AI engine performance" },
                          { name: "Sentence-Level Attribution", description: "Precise citation analysis" },
                          { name: "Future-Proof Strategy", description: "Adapt to evolving AI landscape" }
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
          <section id="pricing" className="py-24">
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
                          "AI Content Rewriting Tool"
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
                          "AI Content Rewriting Tool"
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
                          "Custom GEO Implementations",
                          "Dedicated Account Manager",
                          "API Access & Integrations"
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
          <section id="faq" className="py-24">
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