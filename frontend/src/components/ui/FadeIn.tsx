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
    up: 'translate-y-5',
    down: '-translate-y-5',
    left: 'translate-x-5',
    right: '-translate-x-5',
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% of the element is visible
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
  }, [once]);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all ease-out',
        isVisible ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${directionClasses[direction]}`,
        className
      )}
      style={{ 
        transitionDuration: '800ms',
        transitionDelay: `${delay}ms` 
      }}
    >
      {children}
    </div>
  );
}; 