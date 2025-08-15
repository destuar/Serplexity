/**
 * @file FadeIn.tsx
 * @description Animation component that provides fade-in effects for content.
 * Uses CSS animations and Intersection Observer for performance-optimized animations.
 *
 * @dependencies
 * - react: For component state and effects.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - FadeIn: The main fade-in animation component.
 */
import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface FadeInProps {
  children: ReactNode;
  delay?: number; // delay in ms
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  once?: boolean;
}

export const FadeIn: React.FC<FadeInProps> = ({ 
  children, 
  delay = 0, 
  className,
  direction = 'up',
  once = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const directionClasses = {
    up: 'translate-y-6',
    down: '-translate-y-6',
    left: 'translate-x-6',
    right: '-translate-x-6',
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Apply delay only when element becomes visible
            setTimeout(() => {
              setIsVisible(true);
            }, delay);
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      { 
        threshold: 0.2, // Trigger when 20% of the element is visible
        rootMargin: '0px 0px -50px 0px' // Start animation 50px before element enters viewport
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [delay, once]);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-&lsqb;cubic-bezier(0.25,0.46,0.45,0.94)&rsqb;',
        isVisible ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${directionClasses[direction]}`,
        className
      )}
    >
      {children}
    </div>
  );
}; 