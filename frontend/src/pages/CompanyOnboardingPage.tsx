import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, Users } from 'lucide-react';
import CompanyProfileForm from '../components/company/CompanyProfileForm';

const CompanyOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const starContainerRef = useRef<HTMLDivElement>(null);
  const timeoutIdRef = useRef<number | null>(null);

  const handleSuccess = () => {
    // Redirect to overview page after successful company creation
    navigate('/overview');
  };

  const features = [
    {
      icon: Sparkles,
      title: 'Get Cited by AI Engines',
      description: 'Be quoted directly in AI responses from Google SGE, Perplexity, ChatGPT, and Claude—where your customers are searching.',
    },
    {
      icon: TrendingUp,
      title: 'Track Your GEO Performance',
      description: 'Monitor citation rates, position-adjusted word counts, and visibility metrics across all major generative engines.',
    },
    {
      icon: Users,
      title: 'Outrank Your Competitors',
      description: 'See exactly how you stack up against competitors in AI citations and capture market share in the generative era.',
    },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return;

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

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510] text-white relative">
      {/* Subtle background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
      
      {/* Shooting Stars */}
      <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-black/5 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <img
                  src="/Serplexity.svg"
                  alt="Serplexity Logo"
                  className="w-8 h-8"
                />
                <h1 className="ml-2 text-xl font-bold text-white">Serplexity</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View - Form Only */}
        <div className="lg:hidden flex items-center justify-center min-h-screen px-4 py-6">
          <div className="w-full max-w-md -mt-16">
            <CompanyProfileForm onSuccess={handleSuccess} />
          </div>
        </div>

        {/* Desktop View - Two Column Layout */}
        <div className="hidden lg:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left Side - Welcome Content */}
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-4">
                    The Future of Search is <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">Generative</span>
                  </h1>
                  <p className="text-xl text-gray-300 mb-4">
                    While your competitors optimize for yesterday's search, you'll dominate tomorrow's AI-powered search results.
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-white">
                    Why brands choose Serplexity:
                  </h2>
                  <div className="space-y-4">
                    {features.map((feature, index) => {
                      const Icon = feature.icon;
                      return (
                        <div key={index} className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-[#5271ff]/20 to-[#9e52ff]/20 backdrop-blur-xl rounded-lg border border-white/10">
                              <Icon className="w-5 h-5 text-blue-400" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-white">
                              {feature.title}
                            </h3>
                            <p className="text-gray-300">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="bg-black/5 backdrop-blur-xl rounded-lg p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-[#5271ff] to-[#9e52ff] rounded-full">
                      <span className="text-white font-semibold text-sm">1</span>
                    </div>
                    <h3 className="text-lg font-medium text-white">
                      Step 1: Create Your Company Profile
                    </h3>
                  </div>
                  <p className="text-gray-300 ml-11">
                    Add your company details, competitors, and benchmarking questions to get personalized insights and boost visibility.
                  </p>
                </div>
              </div>

              {/* Right Side - Company Form */}
              <div className="lg:sticky lg:top-8">
                <CompanyProfileForm onSuccess={handleSuccess} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyOnboardingPage; 