/**
 * @file SlideIn.tsx
 * @description Animation component that provides slide-in effects for content from different directions.
 * Uses CSS animations and Intersection Observer for performance-optimized slide animations.
 *
 * @dependencies
 * - react: For component state and effects.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - SlideIn: The main slide-in animation component.
 */
import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface SlideInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}

export const SlideIn: React.FC<SlideInProps> = ({ 
  children, 
  delay = 0, 
  className,
  once = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
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
        threshold: 0.1,
        rootMargin: '0px 0px 50px 0px'
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
    <div ref={ref} className={cn(className)}>
      <div
        className={cn(
          'transition-all duration-800 ease-out',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        )}
      >
        {children}
      </div>
    </div>
  );
};
