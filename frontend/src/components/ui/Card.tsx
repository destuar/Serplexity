import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ children, className, style }) => {
  return (
    <div className={`bg-white p-4 rounded-lg shadow-md border border-gray-100 h-full flex flex-col ${className}`} style={style}>
      {children}
    </div>
  );
};

export default Card; 