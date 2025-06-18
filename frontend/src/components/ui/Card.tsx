import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-full flex flex-col ${className}`}>
      {children}
    </div>
  );
};

export default Card; 