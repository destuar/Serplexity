/**
 * @file TermsOfServicePage.tsx
 * @description Terms of service page displaying the application's terms and conditions.
 * Provides legal information and terms of use for the application.
 *
 * @dependencies
 * - react: For component rendering.
 * - react-router-dom: For navigation.
 *
 * @exports
 * - TermsOfServicePage: The main terms of service page component.
 */
import React from "react";
import { Navbar } from "../components/layout/Navbar";

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="bg-gray-50 text-black relative min-h-screen">
      <div className="relative z-10">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 lg:px-8 py-24">
          {/* Clean Header */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 md:p-12 mb-12">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-4">
                Terms and Conditions of Use
              </h1>
              <p className="text-gray-600 text-lg mb-2">
                Last Updated: June 21, 2024
              </p>
              <p className="text-gray-500 max-w-2xl mx-auto">
                Please read these terms carefully before using our services. By
                accessing Serplexity, you agree to be bound by these terms.
              </p>
            </div>
          </div>

          {/* Clean Content Container */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 md:p-12">
            <div className="space-y-16 text-gray-700">
              <section>
                <h2 className="text-3xl font-bold text-black mb-6">1. Terms</h2>
                <p className="text-lg leading-relaxed">
                  By accessing the website at serplexity.io, you are agreeing to
                  be bound by these terms of service, all applicable laws, and
                  regulations, and agree that you are responsible for compliance
                  with any applicable local laws. If you do not agree with any
                  of these terms, you are prohibited from using or accessing
                  this site. The materials contained in this website are
                  protected by applicable copyright and trademark law.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  2. Content Copyright Policy
                </h2>
                <p className="text-lg leading-relaxed">
                  The site design, logo, and original educational content are
                  subject to copyright © 2024 Serplexity. User-submitted
                  content remains the property of the user, but by submitting
                  content, you grant Serplexity a license to use, display, and
                  distribute it within the platform's services.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  3. Memberships
                </h2>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Billing
                    </h3>
                    <p className="text-lg leading-relaxed">
                      Fees for Serplexity Pro are charged on a monthly or annual
                      basis. Your subscription begins upon successful payment.
                      Subscriptions renew automatically at the specified
                      interval. Fees are charged on the same day of the month
                      that the subscription began. For Serplexity Enterprise
                      plans, billing terms are specified in a separate
                      agreement.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Refunds
                    </h3>
                    <p className="text-lg leading-relaxed">
                      We generally do not offer refunds. If you believe there
                      was a billing error or have exceptional circumstances,
                      please contact Serplexity support at
                      support@serplexity.com.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Sign-up & Communication
                    </h3>
                    <p className="text-lg leading-relaxed">
                      By signing up for Serplexity, you grant Serplexity
                      permission to send essential email communications (e.g.,
                      account verification, password resets, important service
                      updates) to the email address associated with your
                      account. If you opt-in to promotional emails, you can
                      unsubscribe by clicking the "Unsubscribe" or "Opt-Out"
                      link at the bottom of those emails.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Cancellations
                    </h3>
                    <p className="text-lg leading-relaxed">
                      You can cancel your Serplexity Pro subscription at any
                      time. Cancellation will take effect at the end of the
                      current billing period, and no partial refunds will be
                      issued. Access to Pro features will continue until the end
                      of the paid period.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  4. Disclaimer
                </h2>
                <p className="text-lg leading-relaxed">
                  The materials and services on the Serplexity website are
                  provided "as is". Serplexity makes no warranties, expressed or
                  implied, and hereby disclaims and negates all other
                  warranties, including without limitation, implied warranties
                  or conditions of merchantability, fitness for a particular
                  purpose, or non-infringement of intellectual property or other
                  violation of rights. Further, Serplexity does not warrant or
                  make any representations concerning the accuracy, likely
                  results, or reliability of the use of the materials on its
                  website or otherwise relating to such materials or on any
                  sites linked to this site.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  5. Limitations
                </h2>
                <p className="text-lg leading-relaxed">
                  In no event shall Serplexity or its suppliers be liable for
                  any damages (including, without limitation, damages for loss
                  of data or profit, or due to business interruption) arising
                  out of the use or inability to use the materials or services
                  on the Serplexity Internet site, even if Serplexity or a
                  Serplexity authorized representative has been notified orally
                  or in writing of the possibility of such damage. Because some
                  jurisdictions do not allow limitations on implied warranties,
                  or limitations of liability for consequential or incidental
                  damages, these limitations may not apply to you.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  6. Intellectual Property Rights
                </h2>
                <div className="space-y-8">
                  <p className="text-lg leading-relaxed">
                    Serplexity is committed to protecting intellectual property
                    rights and follows DMCA guidelines.
                  </p>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Our Content
                    </h3>
                    <p className="text-lg leading-relaxed">
                      The Serplexity name, logo, site design, and original
                      content created by Serplexity are the property of
                      Serplexity and protected by copyright and trademark laws.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Your Content
                    </h3>
                    <p className="text-lg leading-relaxed">
                      You retain ownership of the content you provide to the
                      service. However, you grant Serplexity a worldwide,
                      non-exclusive, royalty-free license to use, reproduce,
                      display, and distribute your submitted content solely for
                      the purposes of operating and providing the Serplexity
                      service.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Infringement Notices
                    </h3>
                    <p className="text-lg leading-relaxed">
                      If you believe your copyright has been infringed upon by
                      content on Serplexity, please provide a written
                      communication that follows the guidelines set in Section
                      512(c)(3) of the Digital Millennium Copyright Act (the
                      "DMCA") and contact us at support@serplexity.com.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Restrictions
                    </h3>
                    <p className="text-lg leading-relaxed">
                      You shall not distribute, publish, transmit, modify,
                      display or create derivative works from material obtained
                      from this service without permission from the respective
                      rights holder.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  7. Governing Law
                </h2>
                <p className="text-lg leading-relaxed">
                  Any claim relating to the Serplexity website shall be governed
                  by the laws of the State of California without regard to its
                  conflict of law provisions.{" "}
                  <em className="text-gray-500"></em>
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
