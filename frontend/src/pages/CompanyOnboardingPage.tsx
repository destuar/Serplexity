import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, Users } from 'lucide-react';
import CompanyProfileForm from '../components/company/CompanyProfileForm';

const CompanyOnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // Redirect to overview page after successful company creation
    navigate('/overview');
  };

  const features = [
    {
      icon: Sparkles,
      title: 'AI Visibility Tracking',
      description: 'Monitor how your company appears in AI-generated responses across multiple platforms.',
    },
    {
      icon: TrendingUp,
      title: 'Performance Analytics',
      description: 'Get detailed insights into your search visibility and citation patterns.',
    },
    {
      icon: Users,
      title: 'Competitor Analysis',
      description: 'Compare your AI visibility against your top competitors in real-time.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="ml-2 text-xl font-bold text-gray-900">Serplexity</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left Side - Welcome Content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Welcome to Serplexity!
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Let's set up your first company profile to start tracking your AI visibility and performance.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                What you'll get:
              </h2>
              <div className="space-y-4">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
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

            {/* Progress Indicator */}
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full">
                  <span className="text-white font-semibold text-sm">1</span>
                </div>
                <h3 className="text-lg font-medium text-blue-900">
                  Step 1: Create Your Company Profile
                </h3>
              </div>
              <p className="text-blue-700 ml-11">
                Add your company details and competitors to get personalized insights.
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
  );
};

export default CompanyOnboardingPage; 