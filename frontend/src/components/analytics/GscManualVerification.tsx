/**
 * @file GscManualVerification.tsx
 * @description Guided manual verification for Google Search Console (HTML tag / HTML file / DNS)
 * Note: Manual verification helps the user verify ownership in GSC. To fetch data via API, they still
 * must connect with Google (OAuth) afterwards.
 */

import React, { useMemo, useState } from "react";
import { useCompany } from "../../hooks/useCompany";
import { Button } from "../ui/Button";
import Card from "../ui/Card";
import InlineSpinner from "../ui/InlineSpinner";

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

const GscManualVerification: React.FC<Props> = ({ onComplete, onCancel }) => {
  const { selectedCompany } = useCompany();
  const [siteUrl, setSiteUrl] = useState<string>(
    selectedCompany?.website || ""
  );
  const normalizedUrl = useMemo(() => {
    if (!siteUrl) return "";
    return siteUrl.startsWith("http://") || siteUrl.startsWith("https://")
      ? siteUrl
      : `https://${siteUrl}`;
  }, [siteUrl]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectGoogle = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const res = await fetch("/api/website-analytics/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationName: "google_search_console",
          verificationMethod: "oauth",
          ...(normalizedUrl ? { gscPropertyUrl: normalizedUrl } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to start Google connection");
      }
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
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
              Verify your site in GSC (manually)
            </h2>
            <p className="text-gray-600">
              Use one of Google Search Console's manual methods to verify
              ownership of your site. We recommend URL-prefix with HTML tag or
              HTML file. Domain properties require DNS TXT.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="gsc-site-url"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Site URL (URL-prefix recommended)
              </label>
              <input
                id="gsc-site-url"
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">
                This is the property URL you will verify in Google Search
                Console.
              </p>
            </div>

            <Card className="p-4 bg-gray-50 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Steps</h3>
              <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
                <li>
                  Open Google Search Console and add a property for your site.
                </li>
                <li>
                  Choose URL-prefix to allow HTML tag or HTML file verification
                  (Domain requires DNS TXT).
                </li>
                <li>
                  If using HTML tag, paste the meta tag into the &lt;head&gt; of
                  your homepage and publish.
                </li>
                <li>
                  If using HTML file, upload the provided file to your site root
                  and retry verification.
                </li>
                <li>
                  Once verified in GSC, click “Connect Google” below so we can
                  read rankings data.
                </li>
              </ol>
            </Card>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="flex-1"
            >
              {isConnecting ? (
                <div className="flex items-center space-x-2">
                  <InlineSpinner size={16} className="text-white" />
                  <span>Connecting…</span>
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
                  <span>Connect Google</span>
                </div>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isConnecting}
            >
              Back
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GscManualVerification;
