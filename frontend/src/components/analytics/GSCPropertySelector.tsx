/**
 * @file GSCPropertySelector.tsx
 * @description Component for selecting a Google Search Console property after OAuth
 */

import React, { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import Card from "../ui/Card";
import InlineSpinner from "../ui/InlineSpinner";
import apiClient from "../../lib/apiClient";

interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

interface Props {
  integrationId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const GSCPropertySelector: React.FC<Props> = ({ 
  integrationId, 
  onComplete, 
  onCancel 
}) => {
  const [properties, setProperties] = useState<GSCProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/website-analytics/integrations/${integrationId}/properties`);
        setProperties(response.data.properties || []);
        
        // Auto-select if there's only one property
        if (response.data.properties?.length === 1) {
          setSelectedProperty(response.data.properties[0].siteUrl);
        }
      } catch (err) {
        const error = err as { response?: { data?: { error?: string } }; message?: string };
        setError(error.response?.data?.error || error.message || "Failed to load properties");
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [integrationId]);

  const handleSave = async () => {
    if (!selectedProperty) {
      setError("Please select a property");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await apiClient.post(`/website-analytics/integrations/${integrationId}/gsc-property`, {
        siteUrl: selectedProperty
      });

      onComplete();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || error.message || "Failed to save property selection");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <InlineSpinner size={24} className="text-gray-600" />
            <span className="ml-3 text-gray-600">Loading Search Console properties...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Search Console Properties Found
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              You need to verify your website in Google Search Console before you can connect it here.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => window.open('https://search.google.com/search-console', '_blank')}
                className="w-full"
              >
                Open Google Search Console
              </Button>
              <Button variant="outline" onClick={onCancel} className="w-full">
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Select Search Console Property
            </h2>
            <p className="text-gray-600">
              Choose which website property you'd like to connect for SEO performance tracking.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Available Properties
            </label>
            {properties.map((property) => (
              <label
                key={property.siteUrl}
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedProperty === property.siteUrl
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="property"
                  value={property.siteUrl}
                  checked={selectedProperty === property.siteUrl}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="h-4 w-4 text-black border-gray-300 focus:ring-black"
                />
                <div className="ml-3 flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {property.siteUrl}
                  </div>
                  <div className="text-xs text-gray-500">
                    Permission: {property.permissionLevel}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={handleSave}
              disabled={!selectedProperty || saving}
              className="flex-1"
            >
              {saving ? (
                <div className="flex items-center space-x-2">
                  <InlineSpinner size={16} className="text-white" />
                  <span>Connecting...</span>
                </div>
              ) : (
                'Connect Property'
              )}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GSCPropertySelector;