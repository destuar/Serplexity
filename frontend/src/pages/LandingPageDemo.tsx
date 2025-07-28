/**
 * @file LandingPageDemo.tsx
 * @description Demo Landing Page showcasing the professional design system
 * Based on NFT collection reference image with light background, dark accents, and glassmorphism
 */

import { motion } from "framer-motion";
import { BarChart3, Brain, Search, Target, Users, Zap } from "lucide-react";
import React from "react";
import ProfessionalHero from "../components/landing/ProfessionalHero";
import {
  FeatureCard,
  ProductCard,
  ProfessionalCard,
  StatCard,
} from "../components/ui/ProfessionalCard";
import {
  cn,
  getButtonClasses,
  getTextClasses,
  layoutClasses,
  motionPresets,
} from "../utils/designSystem";

const LandingPageDemo: React.FC = () => {
  const features = [
    {
      icon: <Search className="w-8 h-8" />,
      title: "AI Search Intelligence",
      description:
        "Advanced analytics that track your brand visibility across all major AI search engines and conversational interfaces.",
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Real-time Analytics",
      description:
        "Monitor your search performance with live data updates and comprehensive reporting dashboards.",
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Smart Optimization",
      description:
        "AI-powered recommendations to improve your search rankings and content visibility.",
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Competitive Analysis",
      description:
        "Track competitors and identify opportunities to gain market advantage in AI search results.",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Team Collaboration",
      description:
        "Work together with your team using shared dashboards and collaborative reporting features.",
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Lightning Fast",
      description:
        "Optimized performance with sub-second response times and real-time data synchronization.",
    },
  ];

  const products = [
    {
      title: "Serplexity Pro",
      description:
        "Complete AI search analytics platform with advanced features for growing businesses.",
      price: "$249/mo",
      badge: "Most Popular",
      onAction: () => console.log("Pro selected"),
    },
    {
      title: "Serplexity Enterprise",
      description:
        "Full-scale solution with custom integrations and dedicated support for large organizations.",
      price: "Custom",
      onAction: () => console.log("Enterprise selected"),
    },
    {
      title: "Serplexity Starter",
      description:
        "Essential AI search tracking for small businesses and individual professionals.",
      price: "$49/mo",
      onAction: () => console.log("Starter selected"),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Professional Hero Section */}
      <ProfessionalHero
        primaryAction={{
          label: "Start Free Trial",
          onClick: () => console.log("Free trial started"),
        }}
        secondaryAction={{
          label: "Watch Demo",
          onClick: () => console.log("Demo watched"),
        }}
      />

      {/* Features Section */}
      <section className={cn(layoutClasses.section, "bg-white")}>
        <div className={layoutClasses.container}>
          <motion.div
            className={cn(layoutClasses.centeredContent, "mb-16")}
            {...motionPresets.fadeInUp}
          >
            <h2 className={cn(getTextClasses("heading-1"), "mb-6")}>
              Powerful Features for
              <span className="text-gradient"> Modern Businesses</span>
            </h2>
            <p
              className={cn(getTextClasses("body-large"), "max-w-3xl mx-auto")}
            >
              Everything you need to dominate AI search results and stay ahead
              of the competition with our comprehensive suite of professional
              tools.
            </p>
          </motion.div>

          <div className="professional-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className={cn(layoutClasses.section, "bg-gray-50")}>
        <div className={layoutClasses.container}>
          <motion.div
            className={cn(layoutClasses.centeredContent, "mb-16")}
            {...motionPresets.fadeInUp}
          >
            <h2 className={cn(getTextClasses("heading-1"), "mb-6")}>
              Trusted by Industry Leaders
            </h2>
            <p className={getTextClasses("body-large")}>
              Join thousands of companies already using Serplexity to optimize
              their AI search presence
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            <StatCard
              value="99.9%"
              label="Uptime"
              subtitle="Service reliability"
            />
            <StatCard
              value="< 500ms"
              label="Response Time"
              subtitle="Lightning fast"
            />
            <StatCard
              value="24/7"
              label="Support"
              subtitle="Always available"
            />
            <StatCard
              value="500+"
              label="Enterprises"
              subtitle="Trust Serplexity"
            />
          </div>
        </div>
      </section>

      {/* Product Cards Section */}
      <section className={layoutClasses.section}>
        <div className={layoutClasses.container}>
          <motion.div
            className={cn(layoutClasses.centeredContent, "mb-16")}
            {...motionPresets.fadeInUp}
          >
            <h2 className={cn(getTextClasses("heading-1"), "mb-6")}>
              Choose Your
              <span className="text-gradient"> Perfect Plan</span>
            </h2>
            <p className={getTextClasses("body-large")}>
              Flexible pricing options designed to scale with your business
              needs
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <ProductCard
                  title={product.title}
                  description={product.description}
                  price={product.price}
                  badge={product.badge}
                  onAction={product.onAction}
                  actionLabel="Get Started"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Glassmorphism CTA Section */}
      <section
        className={cn(layoutClasses.section, "relative overflow-hidden")}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600" />
        <div className="absolute inset-0 bg-black/20" />

        <div className={cn(layoutClasses.container, "relative z-10")}>
          <motion.div
            className="glass-light rounded-3xl p-12 text-center max-w-4xl mx-auto"
            {...motionPresets.scaleIn}
          >
            <h2 className={cn(getTextClasses("heading-1"), "text-white mb-6")}>
              Ready to Transform Your
              <span className="text-blue-200">AI Search Strategy?</span>
            </h2>
            <p
              className={cn(
                getTextClasses("body-large"),
                "text-blue-100 mb-8 max-w-2xl mx-auto"
              )}
            >
              Join industry leaders who trust Serplexity to optimize their
              search presence and stay ahead of the competition.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className={cn(
                  getButtonClasses("secondary"),
                  "bg-white text-gray-900 hover:bg-gray-100"
                )}
              >
                Start Free Trial
              </button>
              <button className={getButtonClasses("glass")}>
                Schedule Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Dark Feature Section */}
      <section className={cn(layoutClasses.section, "bg-black text-white")}>
        <div className={layoutClasses.container}>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div className="space-y-8" {...motionPresets.slideInLeft}>
              <h2 className={cn(getTextClasses("heading-1"), "text-white")}>
                Built for the
                <span className="text-gradient"> Future of Search</span>
              </h2>
              <p className={cn(getTextClasses("body-large"), "text-gray-300")}>
                Our platform is designed with cutting-edge technology to ensure
                your business stays competitive in the rapidly evolving world of
                AI-powered search.
              </p>
              <ul className="space-y-4">
                {[
                  "Advanced AI algorithms for accurate predictions",
                  "Real-time data processing and analytics",
                  "Seamless integration with existing workflows",
                  "Enterprise-grade security and compliance",
                ].map((item, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="flex items-center gap-3 text-gray-300"
                  >
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div className="relative" {...motionPresets.fadeInUp}>
              <ProfessionalCard variant="floatingDark" className="p-8">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="glass-light rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      98%
                    </div>
                    <div className="text-sm text-gray-300">Accuracy</div>
                  </div>
                  <div className="glass-light rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      24/7
                    </div>
                    <div className="text-sm text-gray-300">Monitoring</div>
                  </div>
                </div>
                <h3 className="text-heading-3 text-white mb-4">
                  Performance Analytics
                </h3>
                <p className="text-gray-300">
                  Real-time insights into your search performance with detailed
                  analytics and actionable recommendations.
                </p>
              </ProfessionalCard>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPageDemo;
