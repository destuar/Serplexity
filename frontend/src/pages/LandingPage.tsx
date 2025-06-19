import React, { useEffect, useRef } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { BarChart2, Sparkles, Target, Users, Star, Check, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
      
      const randomInterval = Math.random() * 15000 + 10000; // 10-25 seconds for subtlety
      timeoutIdRef.current = window.setTimeout(createStar, randomInterval);
    };

    timeoutIdRef.current = window.setTimeout(createStar, Math.random() * 8000);

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

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
        <section className="relative flex flex-col items-center justify-center min-h-screen px-4 pt-32">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
            <h1 className="text-6xl md:text-7xl font-bold mb-6 text-white tracking-tight">
              The Future of Search<br className="hidden md:block" />
              <span className="md:inline">&nbsp;is </span>
              <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent relative">
                Generative
                <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent opacity-50 blur-sm">
                  Generative
                </div>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
              <span className="md:hidden">We are the first agency purpose-built for the generative era of SEO. Stay cited, visible, and relevant across industries.</span>
              <span className="hidden md:inline">We are the first agency purpose-built for the generative era of SEO. Enhance your visibility with Google SGE, Perplexity, ChatGPT, and beyond.</span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16 justify-center">
              <button 
                onClick={user ? handleDashboard : handleGetStarted}
                className="px-8 py-4 bg-[#7762ff] hover:bg-[#6650e6] text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 relative"
              >
                <span className="flex items-center justify-center">
                  <span>
                    Boost Your Visibility <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </span>
                </span>
              </button>
            </div>

            {/* Company Logos */}
            <div className="w-full">
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wide">
                  Trusted by teams at
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 items-center justify-items-center max-w-6xl mx-auto">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="w-32 h-16 bg-white/5 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400 font-medium">Logo {i}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Showcase Section */}
        <section id="features" className="py-24">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
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
                { icon: Sparkles, title: "AI Visibility Audits", desc: "Comprehensive analysis of how your brand appears in generative engines like Google SGE, Perplexity, and ChatGPT." },
                { icon: BarChart2, title: "LLM-Driven Content Rewrites", desc: "Strategic content optimization engineered for maximum citation and visibility at the sentence level." },
                { icon: Target, title: "Technical GEO Implementation", desc: "End-to-end technical implementation with attribution tracking to measure your generative search performance." }
              ].map((feature, i) => (
                <div key={i} className="bg-white/5 backdrop-blur border border-white/10 p-8 rounded-xl hover:bg-white/10 transition-all duration-200">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-r from-[#5271ff] to-[#9e52ff] mb-6">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-300 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table Section */}
        <section id="comparison" className="py-24">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
                Why Traditional SEO Isn't Enough
              </h2>
              <p className="text-xl text-gray-300">
                As generative engines reshape search, brands need specialized GEO expertise to stay relevant
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <div className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-black/10 backdrop-blur-sm">
                    <tr>
                      <th className="px-8 py-6 text-left text-lg font-semibold text-white">Capabilities</th>
                      <th className="px-8 py-6 text-center text-lg font-semibold text-[#7662ff]">Serplexity GEO</th>
                      <th className="px-8 py-6 text-center text-lg font-semibold text-gray-300">Traditional SEO</th>
                      <th className="px-8 py-6 text-center text-lg font-semibold text-gray-300">Content Agencies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {[
                      "Generative Engine Citations",
                      "LLM Content Optimization", 
                      "AI Visibility Tracking",
                      "Sentence-Level Attribution",
                      "Future-Proof Strategy"
                    ].map((feature, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-all duration-200">
                        <td className="px-8 py-6 text-base text-gray-200 font-medium">{feature}</td>
                        <td className="px-8 py-6 text-center">
                          <Check className="w-6 h-6 text-green-400 mx-auto" />
                        </td>
                        <td className="px-8 py-6 text-center">
                          {i === 0 || i === 1 || i === 3 ? <X className="w-6 h-6 text-red-400 mx-auto" /> : <Check className="w-6 h-6 text-green-400 mx-auto" />}
                        </td>
                        <td className="px-8 py-6 text-center">
                          {i === 0 || i === 2 || i === 3 || i === 4 ? <X className="w-6 h-6 text-red-400 mx-auto" /> : <Check className="w-6 h-6 text-green-400 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
                GEO Services & Investment
              </h2>
              <p className="text-xl text-gray-300">
                Professional generative engine optimization tailored to your needs
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { name: "GEO Audit", price: "Starting at $2,500", features: ["Comprehensive AI visibility analysis", "Citation opportunity mapping", "Strategic recommendations"], description: "Perfect for understanding your current generative engine presence" },
                { name: "Content Optimization", price: "Starting at $5,000", features: ["LLM-driven content rewrites", "Sentence-level optimization", "Citation-focused strategy"], popular: true, description: "Optimize existing content for maximum AI citations" },
                { name: "Full-Stack GEO", price: "Custom Pricing", features: ["Complete GEO implementation", "Ongoing optimization", "Attribution tracking & reporting"], description: "End-to-end generative engine optimization program" }
              ].map((plan, i) => (
                <div key={i} className={`bg-white/5 backdrop-blur p-8 rounded-xl border-2 ${plan.popular ? 'border-[#7662ff] relative' : 'border-white/10'} hover:bg-white/10 transition-all duration-200`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-[#5271ff] to-[#9e52ff] text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                    <div className="text-3xl font-bold text-white mb-2">
                      {plan.price}
                    </div>
                    <p className="text-sm text-gray-400">{plan.description}</p>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center text-gray-300">
                        <Check className="w-5 h-5 text-green-400 mr-3" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                    plan.popular 
                      ? 'bg-[#7762ff] hover:bg-[#6650e6] text-white shadow-lg hover:shadow-xl' 
                      : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'
                  }`}>
                    Get Started
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Accordion Section */}
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
            
            <div className="space-y-4">
              {[
                "What is Generative Engine Optimization (GEO)?",
                "How is GEO different from traditional SEO?",
                "Which generative engines do you optimize for?",
                "How do you measure citation success?",
                "Can you optimize existing content or do we need new content?"
              ].map((question, i) => (
                <div key={i} className="bg-white/5 backdrop-blur border border-white/10 rounded-lg">
                  <button className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-white/10 transition-all duration-200">
                    <span className="font-medium text-white">{question}</span>
                    <span className="text-gray-400">+</span>
                  </button>
                  <div className="hidden px-6 py-4 border-t border-white/10 text-gray-300">
                    {i === 0 && "GEO focuses on optimizing content to be cited and referenced by AI systems like Google SGE, Perplexity, and ChatGPT, ensuring your brand appears in generative search results."}
                    {i === 1 && "While SEO targets traditional search rankings, GEO optimizes for AI citation at the sentence level, focusing on how generative engines interpret and reference your content."}
                    {i === 2 && "We optimize for all major generative engines including Google SGE, Perplexity, ChatGPT, Claude, and other emerging AI search platforms."}
                    {i === 3 && "We track citation frequency, attribution accuracy, sentiment analysis, and visibility across different AI platforms to measure your generative search performance."}
                    {i === 4 && "We can optimize your existing content through strategic rewrites and also create new content specifically designed for maximum AI citation potential."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Landing Page Footer */}
        <footer className="bg-black/20 backdrop-blur border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Company Info */}
              <div className="md:col-span-1">
                <div className="flex items-center mb-4">
                  <img src="/Serplexity.png" alt="Serplexity" className="w-8 h-8 mr-2" />
                </div>
                <p className="text-gray-400 mb-4">
                  We are the first agency purpose-built for Generative Engine Optimization. Future-proof your digital presence.
                </p>
                <div className="flex space-x-4">
                  {['Twitter', 'LinkedIn', 'GitHub'].map((social) => (
                    <div key={social} className="w-8 h-8 bg-white/10 backdrop-blur border border-white/20 rounded-full flex items-center justify-center hover:bg-white/20 transition-all duration-200 cursor-pointer">
                      <span className="text-xs text-white">{social[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Links */}
              {[
                { title: "Product", links: ["Features", "Pricing", "API", "Documentation"] },
                { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
                { title: "Support", links: ["Help Center", "Community", "Status", "Privacy"] }
              ].map((column, i) => (
                <div key={i}>
                  <h3 className="font-semibold text-white mb-4">{column.title}</h3>
                  <ul className="space-y-2">
                    {column.links.map((link) => (
                      <li key={link}>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            <div className="border-t border-white/10 mt-12 pt-8 text-center text-gray-400">
              <p>&copy; {new Date().getFullYear()} Serplexity. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage; 