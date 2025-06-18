import React, { useState } from 'react';
import { Building } from 'lucide-react';

interface CompanyLogoProps {
  company: {
    name: string;
    website?: string | null;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CompanyLogo: React.FC<CompanyLogoProps> = ({
  company,
  size = 'md',
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);

  // Size mappings
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  // Generate company initials
  const initials = company.name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  // Generate a color based on company name
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-cyan-500'];
  const colorIndex = company.name.length % colors.length;

  // Extract domain from website URL
  const getDomainFromUrl = (url: string): string => {
    try {
      // Remove protocol and www
      let domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
      // Remove path, query params, etc.
      domain = domain.split('/')[0].split('?')[0].split('#')[0];
      return domain.toLowerCase();
    } catch {
      return '';
    }
  };

  // If image failed to load or no website, show initials
  if (!company.website || imageError) {
    return (
      <div className={`${sizeClasses[size]} ${className} ${colors[colorIndex]} rounded-lg flex items-center justify-center`}>
        <span className="text-white font-bold text-sm">
          {initials}
        </span>
      </div>
    );
  }

  // Try to show favicon from website
  const domain = getDomainFromUrl(company.website);
  if (!domain) {
    return (
      <div className={`${sizeClasses[size]} ${className} ${colors[colorIndex]} rounded-lg flex items-center justify-center`}>
        <span className="text-white font-bold text-sm">
          {initials}
        </span>
      </div>
    );
  }

  // Use multiple favicon sources as fallbacks
  const faviconSources = [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
    `https://${domain}/favicon.ico`
  ];

  return (
    <div className={`${sizeClasses[size]} ${className} bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center`}>
      <img
        src={faviconSources[0]} // Start with Clearbit
        alt={`${company.name} logo`}
        className="w-full h-full object-contain"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          const currentSrc = img.src;
          
          // Try next favicon source
          if (currentSrc === faviconSources[0]) {
            img.src = faviconSources[1]; // Try Google favicon
          } else if (currentSrc === faviconSources[1]) {
            img.src = faviconSources[2]; // Try direct favicon
          } else {
            // All failed, show initials
            setImageError(true);
          }
        }}
      />
    </div>
  );
};

export default CompanyLogo; 