/**
 * @file GA4SetupPage.tsx
 * @description GA4 property selection page after OAuth completion
 * 
 * This page loads after successful GA4 OAuth authentication to allow users
 * to select which GA4 property they want to connect to their Serplexity dashboard.
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import Card from "../components/ui/Card";
import InlineSpinner from "../components/ui/InlineSpinner";
import apiClient from "../lib/apiClient";
import { useCompany } from "../hooks/useCompany";

interface GA4Property {
  propertyId: string;
  displayName: string;
  websiteUrl?: string;
  industryCategory?: string;
  timeZone?: string;
}

const GA4SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedCompany } = useCompany();
  
  const integrationId = searchParams.get("integrationId");
  
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!integrationId) {
      setError("Missing integration ID. Please try connecting again.");
      setIsLoading(false);
      return;
    }

    if (!selectedCompany) {
      setError("Please select a company first.");
      setIsLoading(false);
      return;
    }

    loadProperties();
  }, [integrationId, selectedCompany]);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get("/website-analytics/ga4/properties");
      const data = response.data;
      
      if (!data.properties || !Array.isArray(data.properties)) {
        throw new Error("Invalid response format");
      }

      setProperties(data.properties);
      
      // Auto-select if only one property
      if (data.properties.length === 1) {
        setSelectedPropertyId(data.properties[0].propertyId);
      }
    } catch (e) {
      const error = e as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || error.message || "Failed to load GA4 properties");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPropertyId) {
      setError("Please select a GA4 property");
      return;
    }

    if (!integrationId) {
      setError("Missing integration ID");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await apiClient.post(`/website-analytics/integrations/${integrationId}/ga4-property`, {
        propertyId: selectedPropertyId,
      });

      // Redirect to analytics dashboard
      navigate("/web-analytics");
    } catch (e) {
      const error = e as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || error.message || "Failed to set GA4 property");
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/web-analytics");
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8">
          <div className="flex items-center justify-center space-x-3">
            <InlineSpinner size={24} className="text-blue-600" />
            <span className="text-lg text-gray-600">Loading your GA4 properties...</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Select GA4 Property
            </h1>
            <p className="text-gray-600">
              Choose which Google Analytics 4 property you'd like to connect to your Serplexity dashboard.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          {properties.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No GA4 Properties Found</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any Google Analytics 4 properties associated with your account.
              </p>
              <p className="text-sm text-gray-500">
                Make sure you have GA4 properties set up in your Google Analytics account and that you have the necessary permissions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Available Properties ({properties.length})
              </h3>
              
              <div className="space-y-3">
                {properties.map((property) => (
                  <div
                    key={property.propertyId}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedPropertyId === property.propertyId
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedPropertyId(property.propertyId)}
                  >
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          id={`property-${property.propertyId}`}
                          name="ga4-property"
                          value={property.propertyId}
                          checked={selectedPropertyId === property.propertyId}
                          onChange={() => setSelectedPropertyId(property.propertyId)}
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                      </div>
                      <div className="ml-3 flex-1">
                        <label
                          htmlFor={`property-${property.propertyId}`}
                          className="block text-sm font-medium text-gray-900 cursor-pointer"
                        >
                          {property.displayName}
                        </label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm text-gray-600">
                            Property ID: {property.propertyId}
                          </p>
                          {property.websiteUrl && (
                            <p className="text-sm text-gray-600">
                              Website: {property.websiteUrl}
                            </p>
                          )}
                          {property.timeZone && (
                            <p className="text-sm text-gray-500">
                              Time Zone: {property.timeZone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-4 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!selectedPropertyId || isSubmitting || properties.length === 0}
              className="flex-1"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <InlineSpinner size={16} className="text-white" />
                  <span>Connecting...</span>
                </div>
              ) : (
                "Connect Selected Property"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-6"
            >
              Cancel
            </Button>
          </div>

          {properties.length === 0 && (
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Retry Loading Properties
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default GA4SetupPage;