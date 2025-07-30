/**
 * @file CompanyOnboardingPage.tsx
 * @description Company onboarding page for new users to set up their company profile.
 * Provides company information collection, logo upload, and initial setup flow.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - react-hook-form: For form handling.
 * - lucide-react: For icons.
 * - ../contexts/CompanyContext: For company state.
 *
 * @exports
 * - CompanyOnboardingPage: The main company onboarding page component.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, Users } from 'lucide-react';
import MultiStepCompanyForm from '../components/company/MultiStepCompanyForm';

const CompanyOnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // Redirect to overview page after successful company creation
    navigate('/overview');
  };

  const features = [
    {
      icon: Sparkles,
      title: 'Get Mentioned by AI Engines',
      description: 'Track when your brand gets cited in AI responses from ChatGPT, Perplexity, Gemini, Claude, and other AI search engines.',
    },
    {
      icon: TrendingUp,
      title: 'Monitor Citation Performance',
      description: 'Measure citation rates, visibility scores, and track your brand presence across all major AI search platforms.',
    },
    {
      icon: Users,
      title: 'Outperform Competitors',
      description: 'Compare your AI search visibility against competitors and identify opportunities to increase your market share.',
    },
  ];


  return (
    <div className="min-h-screen bg-gray-50 text-black relative">
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <img
                  src="/Serplexity.svg"
                  alt="Serplexity Logo"
                  className="w-8 h-8"
                />
                <h1 className="ml-2 text-xl font-bold text-black">Serplexity</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View - Form Only */}
        <div className="lg:hidden flex items-center justify-center min-h-screen px-4 py-6">
          <div className="w-full max-w-md -mt-16">
            <MultiStepCompanyForm onSuccess={handleSuccess} />
          </div>
        </div>

        {/* Desktop View - Two Column Layout */}
        <div className="hidden lg:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left Side - Welcome Content */}
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl font-bold text-black mb-4">
                    Track Your Brand's Visibility
                  </h1>
                  <p className="text-xl text-gray-600 mb-4">
                    Monitor mentions and citations across AI search engines, optimize your content strategy, and boost your organic search revenue.
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-black">
                    Why brands choose Serplexity:
                  </h2>
                  <div className="space-y-4">
                    {features.map((feature, index) => {
                      const Icon = feature.icon;
                      return (
                        <div key={index} className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg border border-gray-200">
                              <Icon className="w-5 h-5 text-black" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-black">
                              {feature.title}
                            </h3>
                            <p className="text-gray-600">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right Side - Company Form */}
              <div className="lg:sticky lg:top-8">
                <MultiStepCompanyForm onSuccess={handleSuccess} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyOnboardingPage; 