import React, { useState } from 'react';
import { X, Building, HelpCircle, Trash2, Edit, Mail, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { Button } from '../ui/Button';
import CompanyProfileForm from '../company/CompanyProfileForm';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { companies, deleteCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('companies');
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  if (!isOpen) return null;

  const handleDeleteCompany = async (companyId: string) => {
    try {
      await deleteCompany(companyId);
      setDeleteConfirm(null);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      // In a real app, this would send feedback to your API
      console.log('Submitting feedback:', feedbackText);
      setFeedbackSubmitted(true);
      setFeedbackText('');
      setTimeout(() => setFeedbackSubmitted(false), 3000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleSaveConfirmation = () => {
    setShowSaveConfirmation(false);
    setEditingCompany(null);
    // Refresh to show updated data
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleCancelSaveConfirmation = () => {
    setShowSaveConfirmation(false);
  };

  const tabs = [
    { id: 'companies', label: 'Company Profiles', icon: Building },
    { id: 'help', label: 'Help & Feedback', icon: HelpCircle },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-[#7762ff] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'companies' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Profiles</h3>
                  <p className="text-gray-600 mb-4">
                    Manage your company profiles. You can have up to 3 companies.
                  </p>
                </div>

                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="border border-gray-200 rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{company.name}</h4>
                        <p className="text-sm text-gray-600">{company.website}</p>
                        <p className="text-xs text-gray-500">{company.industry}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCompany(company.id)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(company.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Delete Confirmation */}
                    {deleteConfirm === company.id && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800 mb-3">
                          Are you sure you want to delete "{company.name}"? This action cannot be undone.
                        </p>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleDeleteCompany(company.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Yes, Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* The inline edit form has been replaced by a full-screen overlay */}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'help' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Help & Feedback</h3>
                  <p className="text-gray-600 mb-4">
                    Get help or send us your feedback to improve Serplexity.
                  </p>
                </div>

                {/* Contact Support */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Contact Support</h4>
                  <p className="text-gray-600 mb-4">
                    Need help with your account or have questions? Reach out to our support team.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open('mailto:support@serplexity.com', '_blank')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    support@serplexity.com
                  </Button>
                </div>

                {/* Feedback Form */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Send Feedback</h4>
                  <p className="text-gray-600 mb-4">
                    Help us improve Serplexity by sharing your thoughts and suggestions.
                  </p>
                  
                  {feedbackSubmitted ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800">
                        Thank you for your feedback! We'll review it and get back to you if needed.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tell us what you think about Serplexity, report a bug, or suggest a feature..."
                        className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] resize-none"
                      />
                      <Button
                        onClick={handleSubmitFeedback}
                        disabled={!feedbackText.trim()}
                        className="w-full"
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  )}
                </div>

                {/* Resources */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Resources</h4>
                  <div className="space-y-2">
                    <a
                      href="/privacy"
                      className="block text-[#7762ff] hover:text-[#6650e6] text-sm"
                    >
                      Privacy Policy
                    </a>
                    <a
                      href="/terms"
                      className="block text-[#7762ff] hover:text-[#6650e6] text-sm"
                    >
                      Terms of Service
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full-screen company edit overlay */}
        {editingCompany && (
          <div className="absolute inset-0 bg-white flex flex-col z-50 shadow-xl">
            {/* Overlay Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <button
                onClick={() => setEditingCompany(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors flex items-center"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Edit Company</h2>
              {/* Spacer to balance flex */}
              <div className="w-6 h-6" />
            </div>

            {/* Overlay Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {companies
                .filter((c) => c.id === editingCompany)
                .map((company) => (
                  <CompanyProfileForm
                    key={company.id}
                    isModal={true}
                    initialData={company}
                    mode="edit"
                    onSuccess={() => {
                      setShowSaveConfirmation(true);
                    }}
                    onCancel={() => setEditingCompany(null)}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Save Confirmation Dialog */}
        {showSaveConfirmation && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">Changes Saved Successfully</h3>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  Your company profile has been updated. These changes will be reflected in the next report generated for this company.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={handleCancelSaveConfirmation}
                  className="text-gray-700 hover:bg-gray-100"
                >
                  Continue Editing
                </Button>
                <Button
                  onClick={handleSaveConfirmation}
                  className="bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6]"
                >
                  Got It
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal; 