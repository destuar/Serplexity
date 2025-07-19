/**
 * @file Breadcrumb.tsx
 * @description Breadcrumb navigation component with interactive links
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigation } from '../../hooks/useNavigation';

const Breadcrumb: React.FC = () => {
  const { breadcrumbs } = useNavigation();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight size={14} className="text-gray-400" />
          )}
          {crumb.onClick || crumb.path ? (
            <button
              onClick={crumb.onClick}
              className="hover:text-[#7762ff] transition-colors font-medium"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="text-gray-900 font-medium">
              {crumb.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;