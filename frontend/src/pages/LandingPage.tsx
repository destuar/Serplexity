import React, { useEffect, useRef } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { BarChart2, Sparkles, Target, Users, Star, Check, X, ArrowRight } from 'lucide-react';
import { FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '../components/ui/FadeIn';
import { Accordion } from '../components/ui/Accordion';

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const starContainerRef = useRef<HTMLDivElement>(null);
  const timeoutIdRef = useRef<number | null>(null);

  const handleGetStarted = () => navigate('/register');
  const handleLogin = () => navigate('/login');
  const handleDashboard = () => navigate('/overview');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const createStar = () => {
      if (!starContainerRef.current) return;

      const starEl = document.createElement('div');
      starEl.className = "absolute h-px bg-gradient-to-r from-transparent via-white to-transparent";
      starEl.style.width = '80px';
      
      const duration = (Math.random() * 2 + 2) * 1000; // 2s-4s for subtlety

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
      const opacity = Math.random() * 0.3 + 0.2; // Subtle opacity

      const keyframes = [
        { transform: `translate(${startX_vw}vw, ${startY_vh}vh) rotate(${angle}deg)`, opacity: 0 },
        { opacity: 0, offset: 0.1 },
        { opacity: opacity, offset: 0.3 },
        { opacity: opacity, offset: 0.7 },
        { opacity: 0, offset: 0.9 },
        { transform: `translate(${endX_vw}vw, ${endY_vh}vh) rotate(${angle}deg)`, opacity: 0 }
      ];

      const animation = starEl.animate(keyframes, { duration, easing: 'linear' });

      animation.onfinish = () => {
        starEl.remove();
      };

      starContainerRef.current.appendChild(starEl);
      
      const randomInterval = Math.random() * 10000 + 5000; // 5-15 seconds
      timeoutIdRef.current = window.setTimeout(createStar, randomInterval);
    };

    timeoutIdRef.current = window.setTimeout(createStar, Math.random() * 5000);

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const faqItems = [
    {
      question: "What is Generative Engine Optimization (GEO)?",
      answer: (
        <>
          <p className="mb-4">Generative Engine Optimization (GEO) is the practice of improving your website's visibility inside AI-generated answers produced by engines like Google SGE, Bing Copilot, ChatGPT, and Perplexity.</p>
          <p className="mb-4">Unlike traditional SEO—where the goal is to rank high in a list of links—GEO helps your brand get cited inside the answer itself.</p>
          <p>It's about training the AI to quote, source, and trust your content as the authoritative response to user queries.</p>
        </>
      )
    },
    {
      question: "How is GEO different from traditional SEO?",
      answer: (
        <>
          <div className="flex flex-col md:flex-row gap-8 mb-4">
            <div className="flex-1">
              <h4 className="font-bold text-white mb-2">SEO</h4>
              <ul className="space-y-2 list-disc list-inside text-gray-400">
                <li>Optimizes for link ranking on SERPs</li>
                <li>Focuses on keywords, backlinks, and metadata</li>
                <li>Traffic comes from clicking links</li>
                <li>Ranking is linear (top-down)</li>
              </ul>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white mb-2">GEO</h4>
              <ul className="space-y-2 list-disc list-inside text-gray-400">
                <li>Optimizes for citation visibility inside AI answers</li>
                <li>Focuses on clarity, credibility, and structure</li>
                <li>Traffic comes from being quoted and linked</li>
                <li>Visibility is multi-dimensional</li>
              </ul>
            </div>
          </div>
          <p className="font-semibold text-white">Put simply: SEO is for getting found. GEO is for getting quoted.</p>
        </>
      )
    },
    {
      question: "Which generative engines do you optimize for?",
      answer: (
        <>
          <p className="mb-4">We optimize content for visibility across major generative engines, including:</p>
          <ul className="space-y-2 list-disc list-inside text-gray-400 mb-4">
            <li>Google Gemini</li>
            <li>Bing Copilot</li>
            <li>Perplexity</li>
            <li>ChatGPT</li>
            <li>Anthropic Claude</li>
          </ul>
          <p>Each engine has different behaviors and biases. Our optimization strategy adapts to the specific strengths, citation styles, and update cycles of each one.</p>
        </>
      )
    },
    {
      question: "How do you measure citation success?",
      answer: (
        <>
          <p className="mb-4">We track visibility using industry-proven metrics developed in the GEO research community:</p>
          <ul className="space-y-3 list-disc list-inside text-gray-400 mb-4">
            <li><span className="font-semibold text-white">Position-Adjusted Word Count (PAWC):</span> Measures how many words from your content appear in the AI answer—and how early.</li>
            <li><span className="font-semibold text-white">Subjective Impression Score:</span> Uses AI to assess relevance, influence, uniqueness, and user-perceived value of your citation.</li>
            <li><span className="font-semibold text-white">Citation Position:</span> Where your source is mentioned relative to others (e.g., 1st, 3rd, 5th).</li>
            <li><span className="font-semibold text-white">Click-through Impact:</span> When available, we track clicks from generative answers back to your site using referral paths and UTM tracking.</li>
          </ul>
          <p>These metrics are visualized in a client dashboard and benchmarked against your competitors.</p>
        </>
      )
    },
    {
      question: "Can you optimize existing content or do we need new content?",
      answer: (
        <>
          <p className="mb-4">We can absolutely optimize existing content—that's the most common use case. Using our GEO framework, we'll identify opportunities to enhance:</p>
          <ul className="space-y-2 list-disc list-inside text-gray-400 mb-4">
            <li>Clarity and structure</li>
            <li>Credibility (through citations and stats)</li>
            <li>Quote-worthiness (e.g., adding expert soundbites)</li>
            <li>Readability (short sentences, simplified language)</li>
          </ul>
          <p>If your existing content is outdated or missing entirely for high-opportunity queries, we'll recommend strategic content creation—but always as a supplement, not a starting requirement.</p>
        </>
      )
    }
  ];

  return (
    <div className="bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510] text-white relative min-h-screen">
      {/* Subtle background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
      
      {/* Shooting Stars */}
      <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none" />
      
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
              <span className="md:hidden">We are the first agency purpose-built for the generative era of SEO. Stay cited, visible, and relevant across industries.</span>
              <span className="hidden md:inline">We are the first agency purpose-built for the generative era of SEO. Enhance your visibility with Google SGE, Perplexity, ChatGPT, and beyond.</span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16 justify-center">
              <button 
                onClick={user ? handleDashboard : handleGetStarted}
                className="px-8 py-4 bg-[#7762ff] hover:bg-[#6650e6] text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 relative"
              >
                <span className="flex items-center justify-center">
                  <span>
                    Boost Your Visibility <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div id="product-preview" className="w-full max-w-6xl mx-auto mt-8 mb-16 px-4">
            <div className="bg-black backdrop-blur-xl rounded-3xl aspect-[16/10] flex items-center justify-center">
              <div className="text-gray-400 text-lg">Dashboard Preview Coming Soon</div>
            </div>
          </div>

          {/* Company Logos */}
          <div className="w-full max-w-7xl mx-auto px-4">
            <div className="text-center pt-4 md:pt-6">
              <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wide">
                Trusted by teams at
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 items-center justify-items-center max-w-6xl mx-auto pt-10 md:pt-12">
              {[
                'Netflix_2015_logo.svg',
                'redbull-logo-svg-vector.svg',
                'Mint-mobile_stacked.svg',
                'Verizon_2024.svg',
              ].map((logo, i) => (
                <div
                  key={i}
                  className={`${
                    logo === 'redbull-logo-svg-vector.svg'
                      ? 'h-10'
                      : logo === 'Mint-mobile_stacked.svg'
                      ? 'h-10'
                      : logo === 'Netflix_2015_logo.svg'
                      ? 'h-7'
                      : logo === 'Verizon_2024.svg'
                      ? 'h-6'
                      : 'h-8'
                  } flex items-center justify-center`}
                >
                  <img
                    src={`/${logo}`}
                    alt={`logo ${i + 1}`}
                    className="max-h-full max-w-full"
                    style={{ filter: 'brightness(0) invert(1)' }}
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
                <p className="text-3xl font-semibold leading-tight max-w-3xl text-left">
                  More than <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">1.5 billion people</span> use AI Overviews.
                </p>
              </FadeIn>
              <FadeIn delay={200} direction="left" className="self-end">
                <p className="text-3xl font-semibold leading-tight max-w-3xl text-right">
                  Today, they are triggered by <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">13% of Google queries.</span> 
                </p>
              </FadeIn>
              <FadeIn delay={400} direction="right" className="self-start">
                <p className="text-3xl font-semibold leading-tight max-w-3xl text-left">
                  These visitors are <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">4.4x more valuable</span> than traditional search users. 
                </p>
              </FadeIn>
              <FadeIn delay={600} direction="left" className="self-end">
                <p className="text-3xl font-semibold leading-tight max-w-3xl text-right">
                  We're not just browsing—we're buying.
                </p>
              </FadeIn>
              <FadeIn delay={800} direction="right" className="self-start">
                <p className="text-3xl font-semibold leading-tight max-w-3xl text-left">
                  <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">Half of all links from ChatGPT search</span> queries point to businesses or services
                  </p>
              </FadeIn>
              <FadeIn delay={1000} direction="left" className="self-end">
                <p className="text-3xl font-semibold leading-tight max-w-3xl text-right">
                  and only a fraction are optimizing for it.
                </p>
              </FadeIn>
              <FadeIn delay={1200} className="self-center">
                <p className="text-3xl font-semibold leading-tight max-w-4xl text-center">
                  The brands showing up will <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">win the next decade.</span>
                </p>
              </FadeIn>
            </div>

            {/* Feature Showcase (moved inside story section) */}
            <FadeIn delay={1400}>
              <div id="solutions" className="mt-48 relative">
                {/* Liquid Glass Container */}
                <div className="relative bg-black/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 md:p-12 lg:p-16 overflow-hidden">
                  {/* Glass morphism border glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/10 via-[#7662ff]/10 to-[#9e52ff]/10 rounded-3xl blur-xl"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-3xl"></div>
                  
                  {/* Inner content with relative positioning */}
                  <div className="relative z-10">
                    <div className="text-center mb-16">
                      <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
                        Full-Stack GEO Solutions
                      </h2>
                      <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                        From AI visibility audits to technical implementation, we future-proof your digital presence in the era of generative search.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {[
                        { icon: Sparkles, title: "AI Visibility & Audits Dashboard", desc: "Comprehensive analysis of how your brand appears in generative engines like Google SGE, Perplexity, and ChatGPT." },
                        { icon: BarChart2, title: "LLM-Driven Content Rewrites", desc: "Strategic content optimization engineered for maximum citation and visibility at the sentence level." },
                        { icon: Target, title: "Technical GEO Implementation", desc: "End-to-end technical implementation with attribution tracking to measure your generative search performance." }
                      ].map((feature, i) => (
                        <div key={i} className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 hover:bg-black/10 transition-all duration-200 group">
                          {/* Icon with gradient background */}
                          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-[#5271ff] to-[#9e52ff] mb-6 group-hover:shadow-lg transition-all duration-200">
                            <feature.icon className="h-6 w-6 text-white" />
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                          <p className="text-gray-300 leading-relaxed">{feature.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Comparison Table Section */}
        <FadeIn>
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
        </FadeIn>

        {/* Pricing Section */}
        <FadeIn>
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { 
                    name: "Serplexity Pro", 
                    price: "$249", 
                    pricePeriod: "/mo",
                    features: [
                      "Continuous AI Visibility Tracking",
                      "LLM-Ready Content Analysis",
                      "Sentence-Level Citation Monitoring",
                      "Competitor GEO Benchmarking"
                    ], 
                    description: "Paid Monthly" 
                  },
                  { 
                    name: "Serplexity Pro (Annual)", 
                    price: "$149",
                    pricePeriod: "/mo", 
                    features: [
                      "Continuous AI Visibility Tracking",
                      "LLM-Ready Content Analysis",
                      "Sentence-Level Citation Monitoring",
                      "Competitor GEO Benchmarking"
                    ], 
                    popular: true, 
                    description: "Save big with our annual plan." 
                  },
                  { 
                    name: "Serplexity Enterprise", 
                    price: "By Request",
                    pricePeriod: "",
                    features: [
                      "Everything in Pro, plus:",
                      "Custom GEO Implementations",
                      "Dedicated Account Manager",
                      "API Access & Integrations"
                    ], 
                    description: "For large-scale or custom needs." 
                  }
                ].map((plan, i) => (
                  <div key={i} className={`bg-white/5 backdrop-blur-xl p-8 rounded-3xl hover:bg-white/10 transition-all duration-200 flex flex-col ${plan.popular ? 'shadow-[0_0_20px_rgba(119,98,255,0.5)] relative' : ''}`}>
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-[#5271ff] to-[#9e52ff] text-white px-4 py-1 rounded-full text-sm font-medium">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                      <div className="text-4xl font-bold text-white mb-2">
                        {plan.price}
                        {plan.pricePeriod && <span className="text-base font-medium text-gray-400">{plan.pricePeriod}</span>}
                      </div>
                      <p className="text-sm text-gray-400">{plan.name === 'Serplexity Pro (Annual)' ? 'Paid Annually' : plan.description}</p>
                    </div>
                    <ul className="space-y-3 mb-8 flex-grow">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start text-gray-300">
                          <Check className="w-5 h-5 text-green-400 mr-3 mt-1 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full py-3 px-4 rounded-full font-semibold transition-all duration-200 ${
                      plan.popular 
                        ? 'bg-[#7762ff] hover:bg-[#6650e6] text-white shadow-lg hover:shadow-xl' 
                        : 'bg-white/10 text-white hover:bg-white/15'
                    }`}>
                      Get Started
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </FadeIn>

        {/* FAQ Accordion Section */}
        <FadeIn>
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
        </FadeIn>

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