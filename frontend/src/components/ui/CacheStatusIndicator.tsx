/**
 * @file CacheStatusIndicator.tsx
 * @description Cache status indicator component showing cache hit/miss status and refresh controls.
 * Provides visual feedback about data freshness and caching performance.
 * 
 * @author 10x Engineering Team
 * @version 1.0.0 - Smart Navigation Caching Implementation
 */

import React from 'react';
import { RefreshCw, Clock, Database, Wifi } from 'lucide-react';
import { CacheStatus } from '../../hooks/usePageCache';

interface CacheStatusIndicatorProps {
  cacheStatus: CacheStatus;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const CacheStatusIndicator: React.FC<CacheStatusIndicatorProps> = ({
  cacheStatus,
  loading = false,
  refreshing = false,
  onRefresh,
  showDetails = false,
  className = ''
}) => {
  const { isFromCache, isFresh, lastUpdated, expiresAt, hitCount } = cacheStatus;
  
  const getStatusIcon = () => {
    if (loading || refreshing) {
      return <RefreshCw size={14} className="animate-spin text-blue-500" />;
    }
    
    if (isFromCache) {
      return <Database size={14} className="text-green-500" />;
    }
    
    return <Wifi size={14} className="text-blue-500" />;
  };
  
  const getStatusText = () => {
    if (loading) return 'Loading...';
    if (refreshing) return 'Refreshing...';
    if (isFromCache) return 'Cached';
    if (isFresh) return 'Fresh';
    return 'Unknown';
  };
  
  const getTimeAgo = (date: Date | null) => {
    if (!date) return null;
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };
  
  if (!showDetails && (!isFromCache || process.env.NODE_ENV !== 'development')) {
    return null; // Hide in production unless explicitly showing details
  }
  
  return (
    <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>
      
      {lastUpdated && (
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{getTimeAgo(lastUpdated)}</span>
        </div>
      )}
      
      {process.env.NODE_ENV === 'development' && hitCount > 0 && (
        <span className="text-green-600">
          {hitCount} hit{hitCount !== 1 ? 's' : ''}
        </span>
      )}
      
      {onRefresh && !loading && !refreshing && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-gray-100 transition-colors"
          title="Refresh data"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      )}
      
      {showDetails && expiresAt && (
        <div className="text-xs text-gray-400">
          Expires {getTimeAgo(expiresAt)}
        </div>
      )}
    </div>
  );
};

export default CacheStatusIndicator;