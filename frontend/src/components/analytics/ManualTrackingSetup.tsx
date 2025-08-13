/**
 * @file ManualTrackingSetup.tsx
 * @description Component for setting up manual tracking via JavaScript snippet
 */

import React, { useState } from "react";
import { Button } from "../ui/Button";
import Card from "../ui/Card";

interface ManualTrackingSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface VerificationDetails {
  verificationToken: string;
  metaTag: string;
  dnsRecord: string;
  fileName: string;
  fileContent: string;
  trackingCode: string;
}

const ManualTrackingSetup: React.FC<ManualTrackingSetupProps> = ({
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<
    "method" | "implement" | "verify"
  >("method");
  const [verificationMethod, setVerificationMethod] = useState<
    "meta_tag" | "dns_record" | "file_upload" | null
  >(null);
  const [verificationDetails, setVerificationDetails] =
    useState<VerificationDetails | null>(null);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    verified?: boolean;
    error?: string;
  } | null>(null);

  const handleMethodSelect = async (
    method: "meta_tag" | "dns_record" | "file_upload"
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/website-analytics/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationName: "manual_tracking",
          verificationMethod: method,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create integration");
      }

      const data = await response.json();
      setVerificationDetails(data.verificationDetails);
      setIntegrationId(data.integration.id);
      setVerificationMethod(method);
      setCurrentStep("implement");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!integrationId) return;

    try {
      setIsVerifying(true);
      setError(null);

      const response = await fetch(
        `/api/website-analytics/integrations/${integrationId}/verify`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Verification failed");
      }

      const result = await response.json();
      setVerificationResult(result);

      if (result.verified) {
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderMethodSelection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Verification Method
        </h2>
        <p className="text-gray-600">
          Select how you'd like to verify ownership of your website.
        </p>
      </div>

      <div className="space-y-4">
        {/* HTML Meta Tag */}
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200">
          <div onClick={() => handleMethodSelect("meta_tag")}>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  HTML Meta Tag
                </h3>
                <p className="text-gray-600 mb-3">
                  Add a meta tag to your website's homepage HTML. Best for sites
                  where you can edit the HTML directly.
                </p>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-green-600 font-medium">
                    ✓ Quick setup
                  </span>
                  <span className="text-green-600 font-medium">
                    ✓ No DNS changes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* DNS Record */}
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200">
          <div onClick={() => handleMethodSelect("dns_record")}>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  DNS TXT Record
                </h3>
                <p className="text-gray-600 mb-3">
                  Add a TXT record to your domain's DNS settings. Ideal if you
                  manage your own DNS or use a hosting provider.
                </p>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-green-600 font-medium">
                    ✓ Works for any website
                  </span>
                  <span className="text-orange-600 font-medium">
                    ⚠ Requires DNS access
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* File Upload */}
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200">
          <div onClick={() => handleMethodSelect("file_upload")}>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  HTML File Upload
                </h3>
                <p className="text-gray-600 mb-3">
                  Upload a verification file to your website's root directory.
                  Good for traditional hosting setups.
                </p>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-green-600 font-medium">
                    ✓ Simple file upload
                  </span>
                  <span className="text-orange-600 font-medium">
                    ⚠ Requires FTP/file access
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderImplementation = () => {
    if (!verificationDetails || !verificationMethod) return null;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Implement Verification
          </h2>
          <p className="text-gray-600">
            Follow the steps below to verify your website ownership.
          </p>
        </div>

        {/* Step 1: Add Verification */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Step 1: Add Verification Code
          </h3>

          {verificationMethod === "meta_tag" && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Add the following meta tag to the &lt;head&gt; section of your
                website's homepage:
              </p>
              <div className="bg-gray-50 border rounded-lg p-4">
                <code className="text-sm text-gray-800 break-all">
                  {verificationDetails.metaTag}
                </code>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(verificationDetails.metaTag)}
                  >
                    Copy Code
                  </Button>
                </div>
              </div>
            </div>
          )}

          {verificationMethod === "dns_record" && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Add the following TXT record to your domain's DNS settings:
              </p>
              <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                <div>
                  <strong>Type:</strong> TXT
                </div>
                <div>
                  <strong>Name/Host:</strong> @ (or leave blank)
                </div>
                <div>
                  <strong>Value:</strong>
                  <code className="ml-2 text-sm bg-white px-2 py-1 rounded">
                    {verificationDetails.verificationToken}
                  </code>
                </div>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(verificationDetails.verificationToken)
                    }
                  >
                    Copy Value
                  </Button>
                </div>
              </div>
              <p className="text-sm text-orange-600">
                Note: DNS changes can take up to 48 hours to propagate.
              </p>
            </div>
          )}

          {verificationMethod === "file_upload" && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Upload a file named{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {verificationDetails.fileName}
                </code>{" "}
                to your website's root directory with the following content:
              </p>
              <div className="bg-gray-50 border rounded-lg p-4">
                <code className="text-sm text-gray-800">
                  {verificationDetails.fileContent}
                </code>
                <div className="mt-2 space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(verificationDetails.fileContent)
                    }
                  >
                    Copy Content
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const blob = new Blob([verificationDetails.fileContent], {
                        type: "text/plain",
                      });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = verificationDetails.fileName;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }}
                  >
                    Download File
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Step 2: Add Tracking Code */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Step 2: Add Tracking Code
          </h3>
          <p className="text-gray-600 mb-4">
            Add the following tracking code to every page of your website, just
            before the closing &lt;/head&gt; tag:
          </p>
          <div className="bg-gray-50 border rounded-lg p-4">
            <pre className="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">
              {verificationDetails.trackingCode}
            </pre>
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  copyToClipboard(verificationDetails.trackingCode)
                }
              >
                Copy Tracking Code
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex space-x-4">
          <Button onClick={() => setCurrentStep("verify")} className="flex-1">
            Continue to Verification
          </Button>
          <Button variant="outline" onClick={() => setCurrentStep("method")}>
            Back
          </Button>
        </div>
      </div>
    );
  };

  const renderVerification = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Verify Installation
        </h2>
        <p className="text-gray-600">
          Click the button below to verify that you've correctly implemented the
          verification code and tracking script.
        </p>
      </div>

      {verificationResult && (
        <Card
          className={`p-6 ${verificationResult.verified ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
        >
          <div className="flex items-center space-x-3">
            {verificationResult.verified ? (
              <svg
                className="w-8 h-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <div>
              <h3
                className={`text-lg font-semibold ${verificationResult.verified ? "text-green-800" : "text-red-800"}`}
              >
                {verificationResult.verified
                  ? "Verification Successful!"
                  : "Verification Failed"}
              </h3>
              <p
                className={`${verificationResult.verified ? "text-green-700" : "text-red-700"}`}
              >
                {verificationResult.verified
                  ? "Your website has been successfully verified and analytics tracking is now active."
                  : verificationResult.error ||
                    "Please check your implementation and try again."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex space-x-4">
        <Button
          onClick={handleVerify}
          disabled={isVerifying}
          className="flex-1"
        >
          {isVerifying ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Verifying...</span>
            </div>
          ) : (
            "Verify Installation"
          )}
        </Button>
        <Button variant="outline" onClick={() => setCurrentStep("implement")}>
          Back
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {currentStep === "method" && renderMethodSelection()}
      {currentStep === "implement" && renderImplementation()}
      {currentStep === "verify" && renderVerification()}
    </div>
  );
};

export default ManualTrackingSetup;
