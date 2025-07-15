import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Menu, User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileModal from './ProfileModal';

export function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  
  const isLandingPage = location.pathname === '/';
  const isLandingStylePage = location.pathname === '/' || location.pathname === '/terms' || location.pathname === '/privacy' || location.pathname === '/research' || location.pathname.startsWith('/research/');
  const shouldApplyScrollStyles = isLandingStylePage && isScrolled;

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
    { label: 'Product', sectionId: 'product-preview' },
    { label: 'Research', sectionId: 'research' },
    { label: 'About', sectionId: 'comparison' },
    { label: 'Pricing', sectionId: 'pricing' },
  ];
  
  useEffect(() => {
    if (!isLandingStylePage) return;

    let lastScrolled = window.scrollY > 50;
    setIsScrolled(lastScrolled); // initialise

    const handleScroll = () => {
      // Throttle using rAF to avoid flooding updates
      requestAnimationFrame(() => {
        const nextScrolled = window.scrollY > 50;
        if (nextScrolled !== lastScrolled) {
          lastScrolled = nextScrolled;
          setIsScrolled(nextScrolled);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLandingStylePage]);

  // Close mobile menu and profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node) && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node) && isProfileDropdownOpen) {
        setIsProfileDropdownOpen(false);
      }
    };

    if (isMobileMenuOpen || isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen, isProfileDropdownOpen]);

  return (
    <>
      <nav 
        ref={navRef}
        className={cn(
          "fixed left-0 right-0 top-0 z-50",
          isLandingStylePage
            ? cn(
                "bg-black/20 border-b border-white/10 lg:bg-transparent lg:border-none lg:backdrop-blur-none lg:transition-[top] lg:duration-700 lg:ease-in-out",
                !isScrolled && "backdrop-blur-xl"
              )
            : "border-b bg-white/80 backdrop-blur-sm dark:border-transparent lg:relative",
          { "lg:top-4": shouldApplyScrollStyles }
        )}
      >
        {/* Backdrop blur element that's properly clipped */}
        {shouldApplyScrollStyles && (
          <div className="absolute inset-0 lg:flex lg:justify-center lg:items-center pointer-events-none">
            <div className="lg:w-full lg:max-w-5xl lg:h-full lg:rounded-full lg:backdrop-blur-xl lg:bg-black/5"></div>
          </div>
        )}
        
        <div
          className={cn(
            "mx-auto max-w-full relative z-10",
            isLandingStylePage
              ? "lg:transition-[background-color,max-width,box-shadow,border-radius] lg:duration-700 lg:ease-in-out"
              : "",
            { 
              "lg:max-w-5xl lg:rounded-full lg:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]": shouldApplyScrollStyles,
              "lg:bg-transparent": isLandingStylePage,
            }
          )}
        >
          <div 
            className={cn(
              "relative flex items-center h-16",
              "px-6",
              isLandingStylePage
                ? "lg:transition-[padding] lg:duration-700 lg:ease-in-out"
                : "lg:px-12",
              { 
                "lg:px-4": shouldApplyScrollStyles,
                "lg:px-12": isLandingStylePage && !isScrolled
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
                  isLandingStylePage ? "text-white" : "text-gray-900"
                )}>Serplexity</span>
              </Link>
            </div>

            <div 
              className={cn(
                "hidden lg:flex items-center justify-center gap-8 absolute left-1/2 transform -translate-x-1/2"
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
              ) : location.pathname === '/research' ? (
                // Research page navigation
                <>
                  <Link 
                    to="/" 
                    className="text-base font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Home
                  </Link>
                  <Link 
                    to="/overview" 
                    className="text-base font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                </>
              ) : location.pathname.startsWith('/research/') ? (
                // Blog post page navigation
                <>
                  <Link 
                    to="/" 
                    className="text-base font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Home
                  </Link>
                  <Link 
                    to="/research" 
                    className="text-base font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Research
                  </Link>
                  <Link 
                    to="/overview" 
                    className="text-base font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                </>
              ) : !isLandingStylePage ? (
                // Dashboard navigation
                <Link 
                  to="/overview" 
                  className="text-base font-medium text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
              ) : null}
            </div>

            <div 
              className={cn(
                "flex items-center flex-shrink-0 gap-3 ml-auto",
                isLandingStylePage ? "lg:transition-[gap] lg:duration-700 lg:ease-in-out" : "lg:gap-6",
                { "lg:gap-4": isLandingStylePage && isScrolled, "lg:gap-6": isLandingStylePage && !isScrolled }
              )}
            >
              <div className="hidden lg:flex items-center gap-4">
                  {user ? (
                    <div className="relative flex-shrink-0" ref={profileDropdownRef}>
                      <button 
                        onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0",
                          isLandingStylePage 
                            ? "bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white" 
                            : "bg-gray-200 hover:bg-gray-300 text-gray-600"
                        )}
                      >
                        <User size={20} />
                      </button>
                      
                      {/* Profile Dropdown - Positioned relative to profile button */}
                      {isProfileDropdownOpen && (
                        <>
                          {/* Backdrop for mobile/outside clicks */}
                          <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)}></div>
                          <div 
                            className="absolute right-0 top-12 w-52 z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isLandingStylePage ? (
                              // Liquid Glass Design for Landing Page
                              <div className="relative bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden">
                                {/* Glass morphism border glow */}
                                <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/10 via-[#7662ff]/10 to-[#9e52ff]/10 rounded-2xl blur-xl"></div>
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-2xl"></div>
                                
                                {/* Inner content */}
                                <div className="relative z-10 p-2">
                                  <button
                                    onClick={() => {
                                      setShowProfileModal(true);
                                      setIsProfileDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-all duration-200 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl group"
                                  >
                                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-r from-[#5271ff]/20 to-[#9e52ff]/20 group-hover:from-[#5271ff]/30 group-hover:to-[#9e52ff]/30 transition-all duration-200">
                                      <Settings size={16} />
                                    </div>
                                    <span className="font-medium">Edit Profile</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      logout();
                                      setIsProfileDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-all duration-200 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl group"
                                  >
                                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-r from-[#5271ff]/20 to-[#9e52ff]/20 group-hover:from-[#5271ff]/30 group-hover:to-[#9e52ff]/30 transition-all duration-200">
                                      <LogOut size={16} />
                                    </div>
                                    <span className="font-medium">Logout</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Standard Design for Other Pages
                              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      setShowProfileModal(true);
                                      setIsProfileDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors text-gray-700 hover:bg-gray-100"
                                  >
                                    <Settings size={16} />
                                    Edit Profile
                                  </button>
                                  <button
                                    onClick={() => {
                                      logout();
                                      setIsProfileDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors text-gray-700 hover:bg-gray-100"
                                  >
                                    <LogOut size={16} />
                                    Logout
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <Link to="/login" className={cn(
                        "text-base font-medium",
                        isLandingStylePage ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"
                      )}>
                        Login
                      </Link>
                      <Link to="/register">
                        <button className={cn(
                          "text-base rounded-full px-5 py-2",
                          isLandingStylePage 
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
                  isLandingStylePage ? "text-white" : "text-gray-800"
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
            isLandingStylePage 
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
                      <>
                        <button 
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button 
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
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
              ) : location.pathname === '/research' ? (
                // Research page mobile navigation
                <>
                  <Link 
                    to="/" 
                    className="block text-base font-medium text-gray-300 hover:text-white py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link 
                    to="/overview" 
                    className="block text-base font-medium text-gray-300 hover:text-white py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <div className="border-t border-white/10 pt-4 space-y-4">
                    {user ? (
                      <>
                        <button 
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button 
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
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
              ) : location.pathname.startsWith('/research/') ? (
                // Blog post page mobile navigation
                <>
                  <Link 
                    to="/" 
                    className="block text-base font-medium text-gray-300 hover:text-white py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link 
                    to="/research" 
                    className="block text-base font-medium text-gray-300 hover:text-white py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Research
                  </Link>
                  <Link 
                    to="/overview" 
                    className="block text-base font-medium text-gray-300 hover:text-white py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <div className="border-t border-white/10 pt-4 space-y-4">
                    {user ? (
                      <>
                        <button 
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button 
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
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
              ) : isLandingStylePage ? (
                // Terms/Privacy pages mobile navigation
                <>
                  <Link 
                    to="/" 
                    className="block text-base font-medium text-gray-300 hover:text-white py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <div className="border-t border-white/10 pt-4 space-y-4">
                    {user ? (
                      <>
                        <button 
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button 
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-300 hover:text-white py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
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
                      <>
                        <button 
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button 
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
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

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
} 