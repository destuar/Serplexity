/**
 * @file PrivacyPolicyPage.tsx
 * @description Privacy policy page displaying the application's privacy policy and data handling practices.
 * Provides information about data collection, usage, and privacy protection.
 *
 * @dependencies
 * - react: For component rendering.
 * - react-router-dom: For navigation.
 *
 * @exports
 * - PrivacyPolicyPage: The main privacy policy page component.
 */
import React from "react";
import { Navbar } from "../components/layout/Navbar";

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="bg-gray-50 text-black relative min-h-screen">
      <div className="relative z-10">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 lg:px-8 py-24">
          {/* Clean Header */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 md:p-12 mb-12">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-4">
                Privacy Policy
              </h1>
              <p className="text-gray-600 text-lg mb-2">
                Last Updated: June 21, 2024
              </p>
              <p className="text-gray-500 max-w-2xl mx-auto">
                We are committed to protecting your privacy and being
                transparent about how we collect and use your information.
              </p>
            </div>
          </div>

          {/* Clean Content Container */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 md:p-12">
            <div className="space-y-16 text-gray-700">
              <section>
                <div className="space-y-8">
                  <p className="text-lg leading-relaxed">
                    Serplexity ("Serplexity", "we", or "us") is committed to
                    protecting your privacy. This Privacy Policy explains the
                    methods and reasons we collect, use, disclose, transfer, and
                    store your information. If you have any questions about the
                    contents of this policy, don't hesitate to contact us.
                  </p>
                  <p className="text-lg leading-relaxed">
                    If you do not consent to the collection and use of
                    information from or about you in accordance with this
                    Privacy Policy, then you are not permitted to use Serplexity
                    or any services provided on the Serplexity platform.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  Applicable Law
                </h2>
                <p className="text-lg leading-relaxed">
                  Serplexity is headquartered in the United States of America in
                  the state of California. By viewing any content or otherwise
                  using the services offered by Serplexity, you consent to the
                  transfer of information to the United States of America to the
                  extent applicable, and the collection, storage, and processing
                  of information under California, USA law.{" "}
                  <em className="text-gray-500"></em>
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  Information We Collect
                </h2>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Information you Submit
                    </h3>
                    <p className="text-lg leading-relaxed">
                      We store information you provide on this site via forms,
                      surveys, account registration, profile updates, or any
                      other interactive content. This information commonly
                      includes, but is not limited to, name, email address,
                      company information, and content submitted for analysis.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Log Files
                    </h3>
                    <p className="text-lg leading-relaxed">
                      We collect information when you use services provided on
                      our site. This information may include your IP address,
                      device and software characteristics (such as type and
                      operating system), page views, referral URLs, device
                      identifiers or other unique identifiers, and carrier
                      information. Log files are primarily used for the purpose
                      of enhancing the user experience, monitoring site
                      performance, and debugging.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Cookies and Local Storage
                    </h3>
                    <p className="text-lg leading-relaxed">
                      We use cookies and related technologies to keep track of
                      user preferences, activity, and manage user authentication
                      sessions. Cookies are small text files created by a web
                      server, delivered through a web browser, and stored on
                      your computer. Most Internet browsers automatically accept
                      cookies. You can instruct your browser, by changing its
                      settings, to stop accepting cookies or to prompt you
                      before accepting a cookie from the websites you visit.
                      Note that disabling cookies may affect the functionality
                      of the site, particularly features requiring login.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  Third Party Services
                </h2>
                <p className="text-lg leading-relaxed">
                  This site contains links to other websites not owned by
                  Serplexity. We also utilize third-party services for essential
                  functionality such as payment processing (Stripe) and cloud
                  infrastructure (e.g., AWS, Vercel). In general, the
                  third-party services used by us will only collect, use and
                  disclose your information to the extent necessary to allow
                  them to perform their intended services. Please be aware that
                  we are not responsible for the privacy policies of third-party
                  services. We encourage you to read their privacy policies.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  Children and COPPA
                </h2>
                <p className="text-lg leading-relaxed">
                  Serplexity is committed to complying with the Children's
                  Online Privacy Protection Act (COPPA). Our services are not
                  directed to children under the age of 13, and we do not
                  knowingly collect personal information from children under 13.
                  If we learn that we have collected personal information from a
                  child under 13, we will take steps to delete such information
                  as soon as possible. We encourage parents and guardians to
                  report any suspicions that a child has provided us with
                  information without their consent.
                </p>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  Your Choices
                </h2>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Do Not Track Browser Settings
                    </h3>
                    <p className="text-lg leading-relaxed">
                      Your browser may offer a "Do Not Track" (DNT) setting.
                      While Serplexity attempts to honor DNT signals, due to the
                      lack of a finalized industry standard for DNT, we cannot
                      guarantee a response to all DNT signals. Learn more about
                      Do Not Track by visiting https://allaboutdnt.com.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-4">
                      Email Communication Opt-Out
                    </h3>
                    <p className="text-lg leading-relaxed">
                      If you receive promotional emails from Serplexity, you can
                      unsubscribe by clicking the "Unsubscribe" or "Opt-Out"
                      link provided in the email. Please note that you may still
                      receive transactional emails related to your account
                      (e.g., password resets, critical service notifications)
                      even if you opt out of promotional communications.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-bold text-black mb-6">
                  Contact Us
                </h2>
                <p className="text-lg leading-relaxed">
                  If you have questions or concerns regarding this Privacy
                  Policy, please contact us at support@serplexity.com.
                </p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
