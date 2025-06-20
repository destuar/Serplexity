import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { createCheckoutSession } from '../services/paymentService';

const pricingTiers = [
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
        priceId: 'contact_sales',
        features: [
            "Everything in Pro, plus:",
            "Custom GEO Implementations",
            "Dedicated Account Manager",
            "API Access & Integrations"
        ], 
        description: "For large-scale or custom needs" 
    }
];

const PaymentPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const starContainerRef = useRef<HTMLDivElement>(null);
  const timeoutIdRef = useRef<number | null>(null);

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

  const handleCheckout = async (priceId: string) => {
    if (priceId === 'contact_sales') {
      console.log('Contacting sales...');
      return;
    }

    setIsLoading(priceId);
    try {
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);
      if (!stripe) {
        throw new Error('Stripe.js failed to load.');
      }
      const session = await createCheckoutSession(priceId);
      await stripe.redirectToCheckout({ sessionId: session.sessionId });
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setIsLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510]">
      {/* Blurred Background Overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
        
        {/* Shooting Stars */}
        <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none" />
      </div>
      
      {/* Main Container */}
      <div className="relative w-full max-w-6xl mx-4 h-full flex items-center justify-center py-4">
        {/* Liquid Glass Container */}
        <div className="relative bg-black/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 md:p-8 overflow-hidden w-full max-h-[95vh]">
          {/* Glass morphism border glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/10 via-[#7662ff]/10 to-[#9e52ff]/10 rounded-3xl blur-xl"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-3xl"></div>
          
          {/* Inner content with relative positioning */}
          <div className="relative z-10">
            <div className="text-center mb-8">
              <img src="/Serplexity.png" alt="Serplexity" className="w-12 h-12 mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
                Choose Your <span className="bg-gradient-to-r from-[#5271ff] via-[#7662ff] to-[#9e52ff] bg-clip-text text-transparent">Plan</span>
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Generative search is here—boost your visibility
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pricingTiers.map((tier) => (
                <div key={tier.name} className={`bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 group flex flex-col ${tier.popular ? 'shadow-[0_0_20px_rgba(119,98,255,0.5)] relative' : ''}`}>
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-[#5271ff] to-[#9e52ff] text-white px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-white mb-2">{tier.name}</h3>
                    <div className="text-3xl font-bold text-white mb-2">
                      {tier.price}
                      {tier.pricePeriod && <span className="text-sm font-medium text-gray-400">{tier.pricePeriod}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{tier.description}</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-grow">
                    {tier.features.map((feature, j) => (
                      <li key={j} className="flex items-start text-gray-300 text-sm">
                        <Check className="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => handleCheckout(tier.priceId as string)}
                    disabled={isLoading === tier.priceId}
                    className={`w-full py-3 px-6 rounded-full font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                      tier.popular 
                        ? 'bg-[#7762ff] hover:bg-[#6650e6] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' 
                        : 'bg-white/10 text-white hover:bg-white/20 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                    } ${isLoading === tier.priceId ? 'opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none' : ''}`}
                  >
                    {isLoading === tier.priceId ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        {tier.price === 'By Request' ? 'Contact Sales' : 'Get Started'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Footer with enhanced styling */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-center text-gray-400">
                Need to go back?{' '}
                <Link to="/overview" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                  Return to Dashboard
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage; 