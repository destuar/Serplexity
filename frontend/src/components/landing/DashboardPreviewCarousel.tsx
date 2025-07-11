import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MockOverviewPage from './mock-dashboard/pages/MockOverviewPage';
import MockVisibilityReportPage from './mock-dashboard/pages/MockVisibilityReportPage';
import MockSentimentAnalysisPage from './mock-dashboard/pages/MockSentimentAnalysisPage';
import MockResponseDetailsPage from './mock-dashboard/pages/MockResponseDetailsPage';
import MockCompetitorRankingsPage from './mock-dashboard/pages/MockCompetitorRankingsPage';
import MockModelComparisonPage from './mock-dashboard/pages/MockModelComparisonPage';

// Memoized page components for performance
const MemoizedOverviewPage = React.memo(MockOverviewPage);
const MemoizedVisibilityReportPage = React.memo(MockVisibilityReportPage);
const MemoizedSentimentAnalysisPage = React.memo(MockSentimentAnalysisPage);
const MemoizedResponseDetailsPage = React.memo(MockResponseDetailsPage);
const MemoizedCompetitorRankingsPage = React.memo(MockCompetitorRankingsPage);
const MemoizedModelComparisonPage = React.memo(MockModelComparisonPage);

const pages = [
  { name: 'Overview', component: <MemoizedOverviewPage /> },
  { name: 'Progress Report', component: <MemoizedVisibilityReportPage /> },
  { name: 'Sentiment Analysis', component: <MemoizedSentimentAnalysisPage /> },
  { name: 'Response Details', component: <MemoizedResponseDetailsPage /> },
  { name: 'Competitor Rankings', component: <MemoizedCompetitorRankingsPage /> },
  { name: 'Model Comparison', component: <MemoizedModelComparisonPage /> },
];

const DashboardPreviewCarousel: React.FC = () => {
  // Real index for the actual page (0 to pages.length - 1)
  const [currentIndex, setCurrentIndex] = useState(0);
  // Display index for the transform (includes cloned slides)
  const [displayIndex, setDisplayIndex] = useState(1); // Start at 1 because we have a cloned slide at index 0
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance for touch navigation
  const minSwipeDistance = 50;

  // Create slides with clones for infinite effect
  const infiniteSlides = useMemo(() => {
    const lastSlide = pages[pages.length - 1];
    const firstSlide = pages[0];
    return [
      { ...lastSlide, isClone: true }, // Clone of last slide at beginning
      ...pages.map(page => ({ ...page, isClone: false })),
      { ...firstSlide, isClone: true } // Clone of first slide at end
    ];
  }, []);

  const goToPrevious = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    if (displayIndex === 1) {
      // Going from first real slide to last slide
      setDisplayIndex(0); // Move to cloned last slide
      setTimeout(() => {
        setDisplayIndex(pages.length); // Jump to real last slide without animation
        setCurrentIndex(pages.length - 1);
        setIsTransitioning(false);
      }, 500);
    } else {
      // Normal previous navigation
      const newDisplayIndex = displayIndex - 1;
      const newCurrentIndex = currentIndex === 0 ? pages.length - 1 : currentIndex - 1;
      setDisplayIndex(newDisplayIndex);
      setCurrentIndex(newCurrentIndex);
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [currentIndex, displayIndex, isTransitioning]);

  const goToNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    if (displayIndex === pages.length) {
      // Going from last real slide to first slide
      setDisplayIndex(pages.length + 1); // Move to cloned first slide
      setTimeout(() => {
        setDisplayIndex(1); // Jump to real first slide without animation
        setCurrentIndex(0);
        setIsTransitioning(false);
      }, 500);
    } else {
      // Normal next navigation
      const newDisplayIndex = displayIndex + 1;
      const newCurrentIndex = currentIndex === pages.length - 1 ? 0 : currentIndex + 1;
      setDisplayIndex(newDisplayIndex);
      setCurrentIndex(newCurrentIndex);
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [currentIndex, displayIndex, isTransitioning]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setDisplayIndex(index + 1); // +1 because of cloned slide at beginning
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [currentIndex, isTransitioning]);

  // Touch handlers for mobile swipe support
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  }, [touchStart, touchEnd, goToNext, goToPrevious]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNext();
      } else if (event.key >= '1' && event.key <= '6') {
        event.preventDefault();
        const index = parseInt(event.key) - 1;
        if (index < pages.length) {
          goToSlide(index);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, goToSlide]);

  // Auto-advance functionality (paused on hover)
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || isTransitioning) return;

    const interval = setInterval(() => {
      goToNext();
    }, 8000); // Auto-advance every 8 seconds

    return () => clearInterval(interval);
  }, [isPaused, isTransitioning, goToNext]);

  // Memoized transform style for performance
  const transformStyle = useMemo(() => ({
    transform: `translateX(-${displayIndex * 100}%)`,
    transition: isTransitioning ? 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
  }), [displayIndex, isTransitioning]);

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 mb-16 px-4">
      <div
        className="relative group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        role="region"
        aria-label="Dashboard Preview Carousel"
        tabIndex={0}
      >
        <div className="absolute -inset-4 bg-gradient-to-r from-[#7762ff] to-purple-600 rounded-full blur-3xl animate-glow pointer-events-none"></div>
        <div 
          className="relative bg-black backdrop-blur-xl rounded-lg md:rounded-2xl aspect-[32/17] overflow-hidden shadow-2xl drop-shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#7762ff] focus:ring-offset-2"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex h-full"
            style={transformStyle}
            aria-live="polite"
            aria-atomic="true"
          >
            {infiniteSlides.map((slide, index) => (
              <div 
                key={`${slide.isClone ? 'clone' : 'original'}-${index}`}
                className="w-full flex-shrink-0 h-full bg-gray-50 overflow-hidden"
                aria-hidden={index !== displayIndex}
              >
                <div 
                  className="w-full h-full transform scale-[0.7] origin-top-left flex flex-col" 
                  style={{ width: '143%', height: '143%' }}
                >
                  {/* Only render current and adjacent slides for performance */}
                  {Math.abs(index - displayIndex) <= 1 ? (
                    <div className="flex-grow h-full">
                      {slide.component}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <button
          onClick={goToPrevious}
          disabled={isTransitioning}
          className="absolute top-1/2 -left-4 md:-left-12 transform -translate-y-1/2 group-hover:-translate-x-2 text-white/70 hover:text-white z-20 transition-all duration-300 ease-in-out hover:scale-110 opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#7762ff] focus:ring-offset-2 rounded-full p-2"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-12 w-12" />
        </button>
        <button
          onClick={goToNext}
          disabled={isTransitioning}
          className="absolute top-1/2 -right-4 md:-right-12 transform -translate-y-1/2 group-hover:translate-x-2 text-white/70 hover:text-white z-20 transition-all duration-300 ease-in-out hover:scale-110 opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#7762ff] focus:ring-offset-2 rounded-full p-2"
          aria-label="Next slide"
        >
          <ChevronRight className="h-12 w-12" />
        </button>
      </div>

      {/* Slide Indicators */}
      <div className="flex justify-center items-center space-x-4 mt-8">
        {pages.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            disabled={isTransitioning}
            className={`rounded-full transition-all duration-500 ease-in-out focus:outline-none ring-offset-black/50 focus:ring-2 focus:ring-white/70 focus:ring-offset-2 ${
              index === currentIndex 
                ? 'w-5 h-2 bg-white/90' 
                : 'w-2 h-2 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${index + 1}: ${pages[index].name}`}
          />
        ))}
      </div>
    </div>
  );
};

export default DashboardPreviewCarousel;