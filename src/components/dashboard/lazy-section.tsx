'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface LazySectionProps {
  children: ReactNode;
  /** IntersectionObserver rootMargin (default: "200px") */
  rootMargin?: string;
  /** Skeleton height (default: "h-64") */
  skeletonHeight?: string;
  /** Minimum delay before showing skeleton (ms, default: 100) */
  minDelay?: number;
  /** Framer motion fade-in duration (default: 0.4) */
  fadeInDuration?: number;
  className?: string;
}

export function LazySection({
  children,
  rootMargin = "200px",
  skeletonHeight = "h-64",
  minDelay = 100,
  fadeInDuration = 0.4,
  className
}: LazySectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShowSkeleton, setShouldShowSkeleton] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShouldShowSkeleton(false), minDelay);
    return () => clearTimeout(timer);
  }, [minDelay]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: fadeInDuration, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {children}
        </motion.div>
      ) : shouldShowSkeleton ? (
        <div className={`${skeletonHeight} w-full rounded-2xl bg-muted/40 animate-pulse`} />
      ) : null}
    </div>
  );
}
