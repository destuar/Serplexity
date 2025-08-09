import React from "react";

interface InlineSpinnerProps {
  size?: number;
  className?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  size = 16,
  className = "",
}) => {
  return (
    <div className={`inline-block align-middle ${className}`}>
      <div
        className="animate-spin rounded-full border-2 border-current/30 border-t-current"
        style={{ width: size, height: size }}
      />
    </div>
  );
};

export default InlineSpinner;
