/**
 * @file GoogleAnalyticsConnector.tsx
 * @description Connect to Google Analytics 4 via OAuth. Optional property ID hint.
 */

import React, { useState } from "react";
import { Button } from "../ui/Button";
import Card from "../ui/Card";
import { Input } from "../ui/Input";

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

const GoogleAnalyticsConnector: React.FC<Props> = ({
  onComplete,
  onCancel,
}) => {
  const [propertyId, setPropertyId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const useManual = !!propertyId.trim();
      const response = await fetch("/api/website-analytics/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationName: "google_analytics_4",
          verificationMethod: useManual ? "meta_tag" : "oauth",
          ...(useManual ? { ga4PropertyIdOrTag: propertyId.trim() } : {}),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to create GA4 integration");
      }
      const data = await response.json();
      if (!useManual && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        // Manual path completes immediately
        onComplete();
      }
    } catch (e) {
      setError((e as Error).message);
      setIsConnecting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connect Google Analytics 4
            </h2>
            <p className="text-gray-600">
              Connect your GA4 property to pull visitor and engagement metrics.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="ga4-property"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Property ID (optional)
              </label>
              <Input
                id="ga4-property"
                type="text"
                placeholder="e.g., 123456789"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full"
                disabled={isConnecting}
              />
              <p className="mt-1 text-sm text-gray-500">
                Provide a GA4 property ID to target a specific property, or
                leave blank to select later.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1"
            >
              {isConnecting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.3 3.5c.9 0 1.7.8 1.7 1.7v13.6c0 .9-.8 1.7-1.7 1.7H3.7c-.9 0-1.7-.8-1.7-1.7V5.2c0-.9.8-1.7 1.7-1.7h16.6z" />
                  </svg>
                  <span>Connect with Google</span>
                </div>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isConnecting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GoogleAnalyticsConnector;
