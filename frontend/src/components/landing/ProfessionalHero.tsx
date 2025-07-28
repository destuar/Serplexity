/**
 * @file ProfessionalHero.tsx
 * @description Professional Hero Section matching NFT collection reference aesthetic
 * Features modern layout, floating elements, glassmorphism effects, and professional typography
 */

import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import React from "react";
import {
  cn,
  getButtonClasses,
  getTextClasses,
  layoutClasses,
  motionPresets,
} from "../../utils/designSystem";

interface ProfessionalHeroProps {
  title?: string;
  subtitle?: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  stats?: Array<{
    value: string;
    label: string;
  }>;
  floatingElements?: React.ReactNode;
  className?: string;
}

export const ProfessionalHero: React.FC<ProfessionalHeroProps> = ({
  title = "The Future of AI Search",
  subtitle = "Looking Intelligent",
  description = "Serplexity is the complete software ecosystem purpose-built for AI search. Track, discover, and boost your visibility with the newest mediator of brand to customer relationships—AI agents.",
  primaryAction = {
    label: "Get Started",
    onClick: () => console.log("Get Started clicked"),
  },
  secondaryAction = {
    label: "View Demo",
    onClick: () => console.log("View Demo clicked"),
  },
  stats = [
    { value: "1.4M+", label: "Responses Analyzed" },
    { value: "540K+", label: "Companies Mentioned" },
    { value: "45+", label: "Brands Enhanced" },
  ],
  floatingElements,
  className,
}) => {
  return (
    <section
      className={cn(
        "relative overflow-hidden",
        layoutClasses.section,
        className
      )}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className={layoutClasses.container}>
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[80vh]">
          {/* Content Section */}
          <motion.div className="space-y-8" {...motionPresets.slideInLeft}>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Search Intelligence</span>
            </motion.div>

            {/* Main Heading */}
            <div className="space-y-4">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={getTextClasses("display")}
              >
                {title}
                <br />
                <span className="text-gradient">{subtitle}</span>
              </motion.h1>
            </div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className={cn(getTextClasses("body-large"), "max-w-2xl")}
            >
              {description}
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button
                onClick={primaryAction.onClick}
                className={cn(getButtonClasses("primary"), "group")}
              >
                <span className="flex items-center gap-2">
                  {primaryAction.label}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              <button
                onClick={secondaryAction.onClick}
                className={cn(getButtonClasses("glass"), "group")}
              >
                <span className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  {secondaryAction.label}
                </span>
              </button>
            </motion.div>

            {/* Statistics */}
            {stats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="grid grid-cols-3 gap-8 pt-8"
              >
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                    className="text-center"
                  >
                    <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 font-medium">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>

          {/* Visual Section */}
          <motion.div className="relative" {...motionPresets.fadeInUp}>
            {/* Default Floating Elements if none provided */}
            {!floatingElements ? (
              <div className="relative">
                {/* Main Card */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="floating-card-dark p-8 text-center relative z-10"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-heading-3 text-white mb-4">
                    AI Search Intelligence
                  </h3>
                  <p className="text-body text-gray-300">
                    Advanced analytics for the future of search
                  </p>
                </motion.div>

                {/* Floating Card 1 */}
                <motion.div
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="absolute top-8 -left-8 floating-card p-4 bg-white shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        Live Analytics
                      </div>
                      <div className="text-xs text-gray-500">
                        Real-time insights
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Floating Card 2 */}
                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  className="absolute bottom-8 -right-8 floating-card p-4 bg-white shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        AI Powered
                      </div>
                      <div className="text-xs text-gray-500">
                        Smart algorithms
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl -z-10" />
              </div>
            ) : (
              floatingElements
            )}
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-gray-300 rounded-full flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-3 bg-gray-400 rounded-full mt-2"
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default ProfessionalHero;
