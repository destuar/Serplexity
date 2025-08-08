/**
 * @file GoogleSerpPane.tsx
 * @description This component displays Google search results within an iframe. It takes a search query as a prop
 * and renders the Google search page, allowing users to view live search results directly within the application.
 *
 * @dependencies
 * - react: The core React library for component logic and state management.
 * - ../ui/Card: A generic UI component used for consistent styling and containment of the pane.
 *
 * @exports
 * - GoogleSerpPane: React functional component for displaying Google search results.
 */
import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { InlineSpinner } from '../ui/InlineSpinner';

interface Props {
  query: string;
}

const GoogleSerpPane: React.FC<Props> = ({ query }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
  }, [query]);

  const src = query
    ? `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1&gws_rd=ssl`
    : 'https://www.google.com/webhp?igu=1&gws_rd=ssl';

  const SCALE = 0.8;

  return (
    <Card className="h-full flex flex-col overflow-hidden relative">
      <div className="flex-1 overflow-auto">
        <div
          style={{ transform: `scale(${SCALE})`, transformOrigin: '0 0', width: `${100 / SCALE}%`, height: `${100 / SCALE}%` }}
        >
          <iframe
            key={src}
            src={src}
            onLoad={() => setLoading(false)}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups"
            title="Google Results"
          />
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <InlineSpinner size={20} />
        </div>
      )}
    </Card>
  );
};

export default GoogleSerpPane; 