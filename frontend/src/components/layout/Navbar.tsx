import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navRef = useRef<HTMLElement>(null);
  
  const isLandingPage = location.pathname === '/';
  const shouldApplyScrollStyles = isLandingPage && isScrolled;
  const shouldApplyDesktopScrollStyles = isDesktop && shouldApplyScrollStyles;

  // Smooth scroll function
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
    setIsMobileMenuOpen(false); // Close mobile menu after navigation
  };

  // Navigation items for landing page
  const landingNavItems = [
    { label: 'Product', sectionId: 'features' },
    { label: 'About', sectionId: 'comparison' },
    { label: 'Pricing', sectionId: 'pricing' },
    { label: 'Resources', sectionId: 'faq' },
  ];
  
  useEffect(() => {
    if (isLandingPage) {
      const handleScroll = () => {
        setIsScrolled(window.scrollY > 50);
      };
      window.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [isLandingPage]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node) && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <nav 
        ref={navRef}
        className={cn(
          "fixed left-0 right-0 top-0 z-50",
          isLandingPage
            ? "bg-black/20 backdrop-blur-xl border-b border-white/10 lg:bg-transparent lg:border-none lg:transition-[top] lg:duration-700 lg:ease-in-out"
            : "border-b bg-white/80 backdrop-blur-sm dark:border-transparent lg:relative",
          { "lg:top-4": shouldApplyScrollStyles }
        )}
      >
        <div
          className={cn(
            "mx-auto max-w-full",
            isLandingPage
              ? "lg:transition-[background-color,max-width,box-shadow,backdrop-filter,border-radius] lg:duration-700 lg:ease-in-out"
              : "",
            { 
              "lg:max-w-5xl lg:rounded-full lg:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] lg:bg-black/5 lg:backdrop-blur-xl": shouldApplyScrollStyles,
              "lg:bg-transparent lg:backdrop-blur-none": isLandingPage && !isScrolled,
            }
          )}
        >
          <div 
            className={cn(
              "relative flex items-center justify-between h-16",
              "px-6",
              isLandingPage
                ? "lg:transition-[padding] lg:duration-700 lg:ease-in-out"
                : "lg:px-12",
              { 
                "lg:px-4": shouldApplyScrollStyles,
                "lg:px-12": isLandingPage && !isScrolled
              }
            )}
          >
            <div className="flex items-center flex-shrink-0">
              <Link to="/" className="flex items-center gap-2">
                <img 
                  src="/Serplexity.svg"
                  alt="Serplexity Logo" 
                  className={cn(
                    "w-auto h-10",
                    "lg:transition-all lg:duration-200 lg:ease-in-out",
                  )}
                />
                <span className={cn(
                  "text-xl font-bold",
                  isLandingPage ? "text-white" : "text-gray-900"
                )}>Serplexity</span>
              </Link>
            </div>

            <div 
              className={cn(
                "hidden lg:flex items-center justify-center gap-8"
              )}
            >
              {isLandingPage ? (
                // Landing page navigation with smooth scroll
                <>
                  {landingNavItems.map((item) => (
                    <button
                      key={item.sectionId}
                      onClick={() => scrollToSection(item.sectionId)}
                      className="text-base font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </>
              ) : (
                // Dashboard navigation
                <Link 
                  to="/overview" 
                  className="text-base font-medium text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
              )}
            </div>

            <div 
              className={cn(
                "flex items-center flex-shrink-0 gap-3",
                isLandingPage ? "lg:transition-[gap] lg:duration-700 lg:ease-in-out" : "lg:gap-6",
                { "lg:gap-4": isLandingPage && isScrolled, "lg:gap-6": isLandingPage && !isScrolled }
              )}
            >
              <div className="hidden lg:flex items-center gap-4">
                  {user ? (
                    <button onClick={logout} className={cn(
                      "text-base font-medium",
                      isLandingPage ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
                    )}>
                      Logout
                    </button>
                  ) : (
                    <>
                      <Link to="/login" className={cn(
                        "text-base font-medium",
                        isLandingPage ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
                      )}>
                        Login
                      </Link>
                      <Link to="/register">
                        <button className={cn(
                          "text-base rounded-full px-5 py-2",
                          isLandingPage 
                            ? "bg-[#7762ff] hover:bg-[#6650e6] text-white shadow-lg hover:shadow-xl transition-all duration-200"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        )}>
                          Sign up
                        </button>
                      </Link>
                    </>
                  )}
              </div>
              <button 
                className="p-2 lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <Menu className={cn(
                  "h-6 w-6",
                  isLandingPage ? "text-white" : "text-gray-800"
                )} />
                <span className="sr-only">Open navigation menu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={cn(
            "lg:hidden",
            isLandingPage 
              ? "bg-black/20 backdrop-blur-xl border-t border-white/10" 
              : "bg-white border-t border-gray-200"
          )}>
            <div className="px-6 py-4 space-y-4">
              {isLandingPage ? (
                // Landing page mobile navigation
                <>
                  {landingNavItems.map((item) => (
                    <button
                      key={item.sectionId}
                      onClick={() => scrollToSection(item.sectionId)}
                      className="block w-full text-left text-base font-medium text-gray-300 hover:text-white transition-colors py-2"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t border-white/10 pt-4 space-y-4">
                    {user ? (
                      <button 
                        onClick={() => {
                          logout();
                          setIsMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2"
                      >
                        Logout
                      </button>
                    ) : (
                      <>
                        <Link 
                          to="/login" 
                          className="block text-base font-medium text-gray-300 hover:text-white py-2"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Login
                        </Link>
                        <Link 
                          to="/register"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full bg-[#7762ff] hover:bg-[#6650e6] text-white text-base rounded-lg px-4 py-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200">
                            Sign up
                          </button>
                        </Link>
                      </>
                    )}
                  </div>
                </>
              ) : (
                // Dashboard mobile navigation
                <>
                  <Link 
                    to="/overview" 
                    className="block text-base font-medium text-gray-600 hover:text-gray-900 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <div className="border-t border-gray-200 pt-4">
                    {user ? (
                      <button 
                        onClick={() => {
                          logout();
                          setIsMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-base font-medium text-gray-600 hover:text-gray-900 py-2"
                      >
                        Logout
                      </button>
                    ) : (
                      <>
                        <Link 
                          to="/login" 
                          className="block text-base font-medium text-gray-600 hover:text-gray-900 py-2"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Login
                        </Link>
                        <Link 
                          to="/register"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full bg-[#7762ff] hover:bg-[#6650e6] text-white text-base rounded-lg px-4 py-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200">
                            Sign up
                          </button>
                        </Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
} 