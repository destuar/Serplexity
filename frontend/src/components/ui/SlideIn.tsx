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
        rootMargin: '0px 0px -50px 0px'
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
    <div ref={ref} className={cn('overflow-hidden', className)}>
      <div
        className={cn(
          'transition-transform duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          isVisible ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {children}
      </div>
    </div>
  );
};
