/**
 * @file ProfessionalCard.tsx
 * @description Professional Card Component matching NFT collection reference aesthetic
 * Features floating design, glassmorphism effects, and professional typography
 */

import { motion } from "framer-motion";
import React from "react";
import {
  cn,
  componentVariants,
  motionPresets,
  type DesignSystemProps,
} from "../../utils/designSystem";

interface ProfessionalCardProps extends DesignSystemProps {
  variant?: "light" | "dark" | "glass" | "floating" | "floatingDark";
  hover?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

export const ProfessionalCard: React.FC<ProfessionalCardProps> = ({
  variant = "floating",
  hover = true,
  glow = false,
  className,
  children,
  ...props
}) => {
  const cardClasses = cn(
    componentVariants.card[variant],
    hover && "hover:transform hover:-translate-y-2",
    glow && "glow-blue",
    className
  );

  return (
    <motion.div
      className={cardClasses}
      {...motionPresets.fadeInUp}
      whileHover={hover ? { y: -8 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface FeatureCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  variant?: "light" | "dark";
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  variant = "light",
  className,
}) => {
  return (
    <ProfessionalCard
      variant={variant === "dark" ? "floatingDark" : "floating"}
      className={cn("text-center", className)}
    >
      {icon && (
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-heading-3 font-semibold mb-4 text-gray-900">
        {title}
      </h3>
      <p className="text-body text-gray-600 leading-relaxed">{description}</p>
    </ProfessionalCard>
  );
};

interface StatCardProps {
  value: string;
  label: string;
  subtitle?: string;
  variant?: "light" | "dark" | "glass";
  animated?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  subtitle,
  variant = "glass",
  animated = true,
  className,
}) => {
  return (
    <ProfessionalCard
      variant={variant}
      glow={animated}
      className={cn("text-center", className)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="text-display font-bold text-gray-900 mb-2">{value}</div>
        <div className="text-body font-medium text-gray-700 mb-1">{label}</div>
        {subtitle && (
          <div className="text-body-small text-gray-500">{subtitle}</div>
        )}
      </motion.div>
    </ProfessionalCard>
  );
};

interface ProductCardProps {
  image?: string;
  title: string;
  description: string;
  badge?: string;
  price?: string;
  onAction?: () => void;
  actionLabel?: string;
  variant?: "light" | "dark";
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  image,
  title,
  description,
  badge,
  price,
  onAction,
  actionLabel = "Learn More",
  variant = "light",
  className,
}) => {
  return (
    <ProfessionalCard
      variant={variant === "dark" ? "floatingDark" : "floating"}
      className={cn("overflow-hidden", className)}
    >
      {image && (
        <div className="relative mb-6 -mx-6 -mt-6">
          <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-2xl overflow-hidden">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
          {badge && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-black/80 text-white text-sm font-medium rounded-full backdrop-blur-sm">
              {badge}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-heading-3 font-semibold text-gray-900 mb-2">
            {title}
          </h3>
          <p className="text-body text-gray-600">{description}</p>
        </div>

        <div className="flex items-center justify-between pt-4">
          {price && (
            <div className="text-heading-3 font-bold text-gray-900">
              {price}
            </div>
          )}
          {onAction && (
            <button
              onClick={onAction}
              className="btn-primary text-sm px-4 py-2"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </ProfessionalCard>
  );
};

export default ProfessionalCard;
