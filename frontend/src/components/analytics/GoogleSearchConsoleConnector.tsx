/**
 * @file GoogleSearchConsoleConnector.tsx
 * @description Component for connecting to Google Search Console via OAuth
 */

import React, { useState } from "react";
import { Button } from "../ui/Button";
import Card from "../ui/Card";
import { Input } from "../ui/Input";

interface GoogleSearchConsoleConnectorProps {
  onComplete: () => void;
  onCancel: () => void;
}

const GoogleSearchConsoleConnector: React.FC<
  GoogleSearchConsoleConnectorProps
> = ({ onComplete, onCancel }) => {
  const [gscPropertyUrl, setGscPropertyUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Create the integration
      const response = await fetch("/api/website-analytics/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationName: "google_search_console",
          verificationMethod: "oauth",
          // Pass URL only if user provided an override; otherwise backend will default to company website
          ...(gscPropertyUrl.trim()
            ? { gscPropertyUrl: gscPropertyUrl.trim() }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create integration");
      }

      const data = await response.json();

      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (err) {
      setError((err as Error).message);
      setIsConnecting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connect Google Search Console
            </h2>
            <p className="text-gray-600">
              Connect your website to Google Search Console to get comprehensive
              search performance data.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="gsc-url"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Website URL (optional)
              </label>
              <Input
                id="gsc-url"
                type="url"
                placeholder="https://your-website.com"
                value={gscPropertyUrl}
                onChange={(e) => setGscPropertyUrl(e.target.value)}
                className="w-full"
                disabled={isConnecting}
              />
              <p className="mt-1 text-sm text-gray-500">
                Leave blank to use the company website on file. Enter a URL only
                to override it.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              What you'll need:
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • A verified Google Search Console property for your website
              </li>
              <li>• Owner or Full User permissions for the property</li>
              <li>
                • A Google account with access to your Search Console data
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2">
              What data we'll access:
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Search queries and their performance metrics</li>
              <li>• Click-through rates, impressions, and average positions</li>
              <li>• Device and country breakdowns</li>
              <li>• Page-level search performance data</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              We only request read-only access to your Search Console data. We
              cannot modify your website or Search Console settings.
            </p>
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
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

export default GoogleSearchConsoleConnector;
