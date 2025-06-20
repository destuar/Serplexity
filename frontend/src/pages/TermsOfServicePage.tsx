import React, { useEffect, useRef } from 'react';
import { Navbar } from '../components/layout/Navbar';

const TermsOfServicePage: React.FC = () => {
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

  return (
    <div className="bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510] text-white relative min-h-screen">
      {/* Subtle background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
      
      {/* Shooting Stars */}
      <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none" />
      
      <div className="relative z-10">
        <Navbar />
        <main className="max-w-4xl mx-auto px-6 lg:px-8 py-24">
          {/* Enhanced Header with Liquid Glass Effect */}
          <div className="relative bg-black/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 md:p-12 mb-12 overflow-hidden">
            {/* Glass morphism border glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/10 via-[#7662ff]/10 to-[#9e52ff]/10 rounded-3xl blur-xl"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-3xl"></div>
            
            <div className="relative z-10 text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
                Terms and Conditions of Use
              </h1>
              <p className="text-gray-300 text-lg mb-2">Last Updated: June 21, 2024</p>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Please read these terms carefully before using our services. By accessing Serplexity, you agree to be bound by these terms.
              </p>
            </div>
          </div>
          
          {/* Single Content Container with Subtle Effects */}
          <div className="relative bg-black/10 backdrop-blur-lg rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.2)] border border-white/10 p-8 md:p-12 overflow-hidden">
            {/* Very subtle glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/5 via-transparent to-[#9e52ff]/5 rounded-3xl blur-2xl"></div>
            
            <div className="relative z-10 space-y-16 text-gray-200">
              <section>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent mb-6">1. Terms</h2>
                <p className="text-lg leading-relaxed">
                  By accessing the website at serplexity.io, you are agreeing to be bound by these terms of service, all applicable laws, and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site. The materials contained in this website are protected by applicable copyright and trademark law.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent mb-6">2. Content Copyright Policy</h2>
                <p className="text-lg leading-relaxed">
                  The site design, logo, and original educational content are subject to copyright © 2024 Serplexity. User-submitted content remains the property of the user, but by submitting content, you grant Serplexity a license to use, display, and distribute it within the platform's services.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent mb-6">3. Memberships</h2>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Billing</h3>
                    <p className="text-lg leading-relaxed">
                      Fees for Serplexity Pro are charged on a monthly or annual basis. Your subscription begins upon successful payment. Subscriptions renew automatically at the specified interval. Fees are charged on the same day of the month that the subscription began. For Serplexity Enterprise plans, billing terms are specified in a separate agreement.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Refunds</h3>
                    <p className="text-lg leading-relaxed">
                      We generally do not offer refunds. If you believe there was a billing error or have exceptional circumstances, please contact Serplexity support at support@serplexity.com.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Sign-up & Communication</h3>
                    <p className="text-lg leading-relaxed">
                      By signing up for Serplexity, you grant Serplexity permission to send essential email communications (e.g., account verification, password resets, important service updates) to the email address associated with your account. If you opt-in to promotional emails, you can unsubscribe by clicking the "Unsubscribe" or "Opt-Out" link at the bottom of those emails.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Cancellations</h3>
                    <p className="text-lg leading-relaxed">
                      You can cancel your Serplexity Pro subscription at any time. Cancellation will take effect at the end of the current billing period, and no partial refunds will be issued. Access to Pro features will continue until the end of the paid period.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent mb-6">4. Disclaimer</h2>
                <p className="text-lg leading-relaxed">
                  The materials and services on the Serplexity website are provided "as is". Serplexity makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties, including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights. Further, Serplexity does not warrant or make any representations concerning the accuracy, likely results, or reliability of the use of the materials on its website or otherwise relating to such materials or on any sites linked to this site.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent mb-6">5. Limitations</h2>
                <p className="text-lg leading-relaxed">
                  In no event shall Serplexity or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials or services on the Serplexity Internet site, even if Serplexity or a Serplexity authorized representative has been notified orally or in writing of the possibility of such damage. Because some jurisdictions do not allow limitations on implied warranties, or limitations of liability for consequential or incidental damages, these limitations may not apply to you.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent mb-6">6. Intellectual Property Rights</h2>
                <div className="space-y-8">
                  <p className="text-lg leading-relaxed">
                    Serplexity is committed to protecting intellectual property rights and follows DMCA guidelines.
                  </p>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Our Content</h3>
                    <p className="text-lg leading-relaxed">
                      The Serplexity name, logo, site design, and original content created by Serplexity are the property of Serplexity and protected by copyright and trademark laws.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Your Content</h3>
                    <p className="text-lg leading-relaxed">
                      You retain ownership of the content you provide to the service. However, you grant Serplexity a worldwide, non-exclusive, royalty-free license to use, reproduce, display, and distribute your submitted content solely for the purposes of operating and providing the Serplexity service.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Infringement Notices</h3>
                    <p className="text-lg leading-relaxed">
                      If you believe your copyright has been infringed upon by content on Serplexity, please provide a written communication that follows the guidelines set in Section 512(c)(3) of the Digital Millennium Copyright Act (the "DMCA") and contact us at support@serplexity.com.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Restrictions</h3>
                    <p className="text-lg leading-relaxed">
                      You shall not distribute, publish, transmit, modify, display or create derivative works from material obtained from this service without permission from the respective rights holder.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#5271ff] to-[#9e52ff] bg-clip-text text-transparent mb-6">7. Governing Law</h2>
                <p className="text-lg leading-relaxed">
                  Any claim relating to the Serplexity website shall be governed by the laws of the State of California without regard to its conflict of law provisions. <em className="text-gray-400"></em>
                </p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TermsOfServicePage; 