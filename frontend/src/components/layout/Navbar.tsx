/**
 * @file Navbar.tsx
 * @description Navigation bar component that provides main navigation links and user interface controls.
 * Handles responsive design, user authentication state, and navigation between different sections of the application.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation and routing.
 * - lucide-react: For icons.
 * - ../../contexts/AuthContext: For user authentication state.
 * - ../../contexts/CompanyContext: For company data.
 *
 * @exports
 * - Navbar: The main navigation component.
 */
import { LogOut, Menu, Settings, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import ProfileModal from "./ProfileModal";

export function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const isLandingPage = location.pathname === "/";
  const isLandingStylePage =
    location.pathname === "/" ||
    location.pathname === "/terms" ||
    location.pathname === "/privacy" ||
    location.pathname === "/research" ||
    location.pathname.startsWith("/research/");
  const shouldApplyScrollStyles = isLandingStylePage && isScrolled;

  // Smooth scroll function
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    setIsMobileMenuOpen(false); // Close mobile menu after navigation
  };

  // Navigation items for landing page
  const landingNavItems = [
    { label: "Product", sectionId: "product-preview" },
    { label: "Research", sectionId: "research" },
    { label: "About", sectionId: "comparison" },
    { label: "Pricing", sectionId: "pricing" },
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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLandingStylePage]);

  // Close mobile menu and profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        navRef.current &&
        !navRef.current.contains(event.target as Node) &&
        isMobileMenuOpen
      ) {
        setIsMobileMenuOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node) &&
        isProfileDropdownOpen
      ) {
        setIsProfileDropdownOpen(false);
      }
    };

    if (isMobileMenuOpen || isProfileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
            <div className="lg:w-full lg:max-w-5xl lg:h-full lg:rounded-lg lg:backdrop-blur-xl"></div>
          </div>
        )}

        <div
          className={cn(
            "mx-auto max-w-full relative z-10",
            isLandingStylePage
              ? "lg:transition-[background-color,max-width,box-shadow,border-radius] lg:duration-700 lg:ease-in-out"
              : "",
            {
              "lg:max-w-5xl lg:rounded-lg lg:shadow-[0_4px_16px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.05)]":
                shouldApplyScrollStyles,
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
                "lg:px-12": isLandingStylePage && !isScrolled,
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
                    "lg:transition-all lg:duration-200 lg:ease-in-out"
                  )}
                />
                <span className="text-xl font-bold text-gray-900">
                  Serplexity
                </span>
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
                      className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </>
              ) : location.pathname === "/research" ? (
                // Research page navigation
                <>
                  <Link
                    to="/"
                    className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Home
                  </Link>
                  <a
                    href="/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Dashboard
                  </a>
                </>
              ) : location.pathname.startsWith("/research/") ? (
                // Blog post page navigation
                <>
                  <Link
                    to="/"
                    className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    to="/research"
                    className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Research
                  </Link>
                  <a
                    href="/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Dashboard
                  </a>
                </>
              ) : !isLandingStylePage ? (
                // Dashboard navigation
                <a
                  href="/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-medium text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </a>
              ) : null}
            </div>

            <div
              className={cn(
                "flex items-center flex-shrink-0 gap-3 ml-auto",
                isLandingStylePage
                  ? "lg:transition-[gap] lg:duration-700 lg:ease-in-out"
                  : "lg:gap-6",
                {
                  "lg:gap-4": isLandingStylePage && isScrolled,
                  "lg:gap-6": isLandingStylePage && !isScrolled,
                }
              )}
            >
              <div className="hidden lg:flex items-center gap-4">
                {user ? (
                  <div
                    className="relative flex-shrink-0"
                    ref={profileDropdownRef}
                  >
                    <button
                      onClick={() =>
                        setIsProfileDropdownOpen(!isProfileDropdownOpen)
                      }
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0",
                        isLandingStylePage
                          ? "bg-gray-200 hover:bg-gray-300 text-gray-600"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-600"
                      )}
                    >
                      <User size={20} />
                    </button>

                    {/* Profile Dropdown - Positioned relative to profile button */}
                    {isProfileDropdownOpen && (
                      <>
                        {/* Backdrop for mobile/outside clicks */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsProfileDropdownOpen(false)}
                        ></div>
                        <div
                          className="absolute right-0 top-12 w-52 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isLandingStylePage ? (
                            // Clean Design for Landing Page
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
                    <Link
                      to="/login"
                      className={cn(
                        "text-base font-medium",
                        isLandingStylePage
                          ? "text-gray-700 hover:text-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      Login
                    </Link>
                    <Link to="/register">
                      <button
                        className={cn(
                          "text-base rounded-lg px-5 py-2",
                          isLandingStylePage
                            ? "bg-black hover:bg-gray-800 text-white shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200"
                            : "bg-black hover:bg-gray-800 text-white shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200"
                        )}
                      >
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
                <Menu className="h-6 w-6 text-gray-800" />
                <span className="sr-only">Open navigation menu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div
            className={cn(
              "lg:hidden",
              isLandingStylePage
                ? "bg-white/95 backdrop-blur-xl border-t border-gray-200"
                : "bg-white border-t border-gray-200"
            )}
          >
            <div className="px-6 py-4 space-y-4">
              {isLandingPage ? (
                // Landing page mobile navigation
                <>
                  {landingNavItems.map((item) => (
                    <button
                      key={item.sectionId}
                      onClick={() => scrollToSection(item.sectionId)}
                      className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 transition-colors py-2"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-200 pt-4 space-y-4">
                    {user ? (
                      <>
                        <button
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Login
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base rounded-lg px-4 py-2 font-medium shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200">
                            Sign up
                          </button>
                        </Link>
                      </>
                    )}
                  </div>
                </>
              ) : location.pathname === "/research" ? (
                // Research page mobile navigation
                <>
                  <Link
                    to="/"
                    className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <a
                    href="/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </a>
                  <div className="border-t border-gray-200 pt-4 space-y-4">
                    {user ? (
                      <>
                        <button
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Login
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base rounded-lg px-4 py-2 font-medium shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200">
                            Sign up
                          </button>
                        </Link>
                      </>
                    )}
                  </div>
                </>
              ) : location.pathname.startsWith("/research/") ? (
                // Blog post page mobile navigation
                <>
                  <Link
                    to="/"
                    className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    to="/research"
                    className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Research
                  </Link>
                  <a
                    href="/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </a>
                  <div className="border-t border-gray-200 pt-4 space-y-4">
                    {user ? (
                      <>
                        <button
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Login
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full bg-black hover:bg-gray-800 text-white text-base rounded-lg px-4 py-2 font-medium shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200">
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
                    className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <div className="border-t border-gray-200 pt-4 space-y-4">
                    {user ? (
                      <>
                        <button
                          onClick={() => {
                            setShowProfileModal(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            logout();
                            setIsMobileMenuOpen(false);
                          }}
                          className="block w-full text-left text-base font-medium text-gray-700 hover:text-gray-900 py-2 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          className="block text-base font-medium text-gray-700 hover:text-gray-900 py-2"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          Login
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full bg-black hover:bg-gray-800 text-white text-base rounded-lg px-4 py-2 font-medium shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200">
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
                          <button className="w-full bg-black hover:bg-gray-800 text-white text-base rounded-lg px-4 py-2 font-medium shadow-md hover:shadow-lg active:shadow-inner transition-all duration-200">
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
