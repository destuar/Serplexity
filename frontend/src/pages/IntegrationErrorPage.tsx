/**
 * @file IntegrationErrorPage.tsx
 * @description Error page for failed OAuth integrations
 */

import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useNavigation } from "../hooks/useNavigation";

const IntegrationErrorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { setBreadcrumbs } = useNavigation();
  const errorMessage = searchParams.get("message") || "Integration failed";

  useEffect(() => {
    setBreadcrumbs([
      { label: "SEO Performance" },
      { label: "Integration Error" },
    ]);
  }, [setBreadcrumbs]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-medium text-gray-900 mb-2">
            Integration Failed
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {decodeURIComponent(errorMessage)}
          </p>
          <div className="space-y-3">
            <Link
              to="/web-analytics"
              className="w-full inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              Try Again
            </Link>
            <Link
              to="/overview"
              className="w-full inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationErrorPage;