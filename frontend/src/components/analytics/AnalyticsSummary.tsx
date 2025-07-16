/**
 * @file AnalyticsSummary.tsx
 * @description This component displays a summary of analytics data, including page views, unique users,
 * average session duration, conversion rate, and top pages. It's designed to provide administrators
 * with a quick overview of application usage. Currently, it uses mock data, but it's set up to integrate
 * with a backend analytics endpoint. It also tracks when the analytics dashboard is viewed.
 *
 * @dependencies
 * - react: The core React library.
 * - ../../utils/analytics: Utility for tracking Serplexity-specific events.
 *
 * @exports
 * - AnalyticsSummary: React functional component for displaying analytics data.
 */
import React, { useEffect, useState } from 'react';
import { trackSerplexityEvents } from '../../utils/analytics';

interface AnalyticsData {
  pageViews: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  topPages: Array<{ page: string; views: number }>;
  conversionRate: number;
}

export const AnalyticsSummary: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Track that admin viewed analytics
    trackSerplexityEvents.pageVisited('analytics-dashboard');

    // Fetch analytics data from your backend
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // This would be a call to your backend analytics endpoint
      // For now, showing mock data structure
      const mockData: AnalyticsData = {
        pageViews: 1250,
        uniqueUsers: 340,
        averageSessionDuration: 240, // seconds
        topPages: [
          { page: 'Dashboard Overview', views: 450 },
          { page: 'Visibility Report', views: 280 },
          { page: 'Sentiment Analysis', views: 220 },
          { page: 'Competitor Rankings', views: 180 },
          { page: 'Landing Page', views: 120 },
        ],
        conversionRate: 12.5,
      };

      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      trackSerplexityEvents.errorEncountered('analytics_fetch_failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading analytics...</div>;
  }

  if (!analyticsData) {
    return <div className="p-4">Failed to load analytics data</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Analytics Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="text-sm font-medium text-blue-600">Page Views</h3>
          <p className="text-2xl font-bold text-blue-900">{analyticsData.pageViews.toLocaleString()}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded">
          <h3 className="text-sm font-medium text-green-600">Unique Users</h3>
          <p className="text-2xl font-bold text-green-900">{analyticsData.uniqueUsers.toLocaleString()}</p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded">
          <h3 className="text-sm font-medium text-purple-600">Avg Session (min)</h3>
          <p className="text-2xl font-bold text-purple-900">
            {Math.round(analyticsData.averageSessionDuration / 60)}
          </p>
        </div>
        
        <div className="bg-orange-50 p-4 rounded">
          <h3 className="text-sm font-medium text-orange-600">Conversion Rate</h3>
          <p className="text-2xl font-bold text-orange-900">{analyticsData.conversionRate}%</p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
        <div className="space-y-2">
          {analyticsData.topPages.map((page, index) => (
            <div key={page.page} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">{index + 1}. {page.page}</span>
              <span className="text-gray-600">{page.views} views</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>Analytics powered by Google Analytics 4</p>
        <p>Track ID: G-J5R6K4M5SR</p>
      </div>
    </div>
  );
};