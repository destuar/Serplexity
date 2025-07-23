/**
 * @file Card.tsx
 * @description Reusable card component for displaying content in a contained, styled container.
 * Provides consistent styling and layout for content sections throughout the application.
 *
 * @dependencies
 * - react: For component rendering.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - Card: The main card component.
 * - CardHeader: Header section of the card.
 * - CardTitle: Title component for the card.
 * - CardDescription: Description component for the card.
 * - CardContent: Content section of the card.
 * - CardFooter: Footer section of the card.
 */
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ children, className, style }) => {
  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-lg shadow-md border border-white/20 p-4 h-full flex flex-col ${className}`} style={style}>
      {children}
    </div>
  );
};

export default Card; 