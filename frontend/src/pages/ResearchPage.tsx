/**
 * @file ResearchPage.tsx
 * @description Research page for conducting AI-powered research and analysis.
 * Provides research tools, data visualization, and insights generation functionality.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 * - ../hooks/useReportGeneration: For research functionality.
 *
 * @exports
 * - ResearchPage: The main research page component.
 */
import {
  Calendar,
  Edit,
  Eye,
  Plus,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Navbar } from "../components/layout/Navbar";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../lib/apiClient";
import { Role } from "../types/schemas";

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
    status?: number;
  };
}

interface BlogMedia {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  media: BlogMedia[];
}

const ResearchPage: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [drafts, setDrafts] = useState<BlogPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"published" | "drafts">(
    "published"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  // const { slug } = useParams();

  const isAdmin = user?.role === Role.ADMIN;

  // Filter and sort posts
  useEffect(() => {
    const currentPosts = activeTab === "published" ? posts : drafts;
    let filtered = currentPosts;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.excerpt?.toLowerCase().includes(query) ||
          post.author.name?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    setFilteredPosts(filtered);
  }, [posts, drafts, activeTab, searchQuery, sortBy]);

  const fetchPosts = useCallback(
    async (showToast = false) => {
      try {
        if (showToast) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // Fetch published posts
        const publishedResponse = await apiClient.get("/blog?published=true");
        setPosts(publishedResponse.data);

        // Fetch drafts if admin
        if (isAdmin) {
          try {
            const draftsResponse = await apiClient.get("/blog?published=false");
            setDrafts(draftsResponse.data);
          } catch (err: unknown) {
            console.error("Failed to fetch drafts:", err);
          }
        }

        if (showToast) {
          toast.success("Articles refreshed");
        }
      } catch (err: unknown) {
        const error = err as ApiError;
        const errorMessage =
          error.response?.data?.error || "Failed to fetch articles";
        setError(errorMessage);
        if (showToast) {
          toast.error(errorMessage);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Remove star effects for light mode

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-50 text-black relative min-h-screen">
        <div className="relative z-10">
          <Navbar />

          <div className="flex items-center justify-center min-h-screen pt-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="text-gray-600">Loading articles...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 text-black relative min-h-screen">
        <div className="relative z-10">
          <Navbar />

          <div className="flex items-center justify-center min-h-screen pt-24">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-black mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => fetchPosts(true)}
                className="px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-full font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 text-black relative min-h-screen">
      <div className="relative z-10">
        <Navbar />

        {/* Research Content Section */}
        <section className="relative px-4 pt-28 pb-12">
          <div className="max-w-6xl mx-auto">
            {/* Header with left-aligned breadcrumb */}
            <div className="mb-16">
              <div className="flex items-center gap-2 mb-4">
                <Link
                  to="/"
                  className="text-gray-600 hover:text-black text-sm font-medium transition-colors"
                >
                  ← Home
                </Link>
                <span className="text-gray-400">/</span>
                <span className="text-sm font-medium text-gray-800">
                  Research
                </span>
              </div>

              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">
                  Research & Insights
                </h1>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Deep insights and analysis on AI search optimization
                </p>
              </div>
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
                <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto max-w-md">
                  <button
                    onClick={() => setActiveTab("published")}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === "published"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="whitespace-nowrap">
                      Published ({posts.length})
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("drafts")}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === "drafts"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Edit className="h-4 w-4" />
                    <span className="whitespace-nowrap">
                      Drafts ({drafts.length})
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fetchPosts(true)}
                    disabled={isRefreshing}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                    <span className="whitespace-nowrap">
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </span>
                  </button>
                  <Link to="/research/new">
                    <button className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-lg hover:shadow-xl">
                      <Plus className="h-4 w-4" />
                      <span className="whitespace-nowrap">New Article</span>
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm text-black placeholder:text-gray-400 shadow-sm"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-black text-black min-w-[140px] shadow-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Alphabetical</option>
              </select>
            </div>

            {/* Results Summary */}
            {(searchQuery.trim() ||
              filteredPosts.length !==
                (activeTab === "published" ? posts.length : drafts.length)) && (
              <div className="text-sm text-gray-600 mb-6">
                {searchQuery.trim() ? (
                  <span>
                    Found {filteredPosts.length} articles matching "
                    {searchQuery}"
                  </span>
                ) : (
                  <span>
                    Showing {filteredPosts.length} of{" "}
                    {activeTab === "published" ? posts.length : drafts.length}{" "}
                    articles
                  </span>
                )}
              </div>
            )}

            {/* Articles */}
            {(() => {
              if (filteredPosts.length === 0) {
                const messages = {
                  noResults: {
                    title: "No articles found",
                    subtitle: searchQuery.trim()
                      ? `No articles match "${searchQuery}". Try adjusting your search terms.`
                      : "No articles match the current filters.",
                  },
                  noDrafts: {
                    title: "No drafts yet",
                    subtitle: "Start writing your first draft to see it here.",
                  },
                  noPublished: {
                    title: "No published articles",
                    subtitle:
                      "Publish your first article to share your insights.",
                  },
                };

                const currentMessage = searchQuery.trim()
                  ? messages.noResults
                  : activeTab === "drafts"
                    ? messages.noDrafts
                    : messages.noPublished;

                return (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      {searchQuery.trim() ? (
                        <Search className="h-6 w-6 text-gray-500" />
                      ) : (
                        <svg
                          className="w-8 h-8 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold text-black mb-2">
                      {currentMessage.title}
                    </h2>
                    <p className="text-gray-600 mb-6">
                      {currentMessage.subtitle}
                    </p>
                    {searchQuery.trim() ? (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="px-6 py-3 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        Clear Search
                      </button>
                    ) : (
                      isAdmin && (
                        <Link to="/research/new">
                          <button className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl mx-auto">
                            <Plus className="h-4 w-4" />
                            Create First Article
                          </button>
                        </Link>
                      )
                    )}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredPosts.map((post) => (
                    <article
                      key={post.id}
                      className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-200 group"
                    >
                      {/* Cover Image */}
                      {post.coverImage && (
                        <div className="w-full h-48 bg-gray-100 rounded-xl mb-6 overflow-hidden">
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}

                      <div className="space-y-4">
                        {/* Title and Status */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            {!post.published && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                Draft
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-semibold text-black group-hover:text-gray-800 transition-colors line-clamp-2">
                            {post.published ? (
                              <Link
                                to={`/research/${post.slug}`}
                                className="hover:text-gray-800 transition-colors"
                              >
                                {post.title}
                              </Link>
                            ) : (
                              post.title
                            )}
                          </h2>
                        </div>

                        {/* Excerpt */}
                        {post.excerpt && (
                          <p className="text-gray-600 text-sm line-clamp-3">
                            {post.excerpt}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex items-center text-xs text-gray-500 flex-wrap gap-2">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{post.author.name || post.author.email}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {post.published && post.publishedAt
                                ? formatDate(post.publishedAt)
                                : formatDate(post.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          {post.published && (
                            <Link to={`/research/${post.slug}`}>
                              <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                                <Eye className="h-3 w-3" />
                                View
                              </button>
                            </Link>
                          )}
                          {isAdmin && (
                            <Link to={`/research/edit/${post.id}`}>
                              <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                                <Edit className="h-3 w-3" />
                                Edit
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-transparent">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="inline-grid grid-cols-3 md:grid-cols-4 gap-8 text-left">
                {/* Links */}
                {[
                  {
                    title: "Product",
                    links: [
                      { label: "About", href: "/#solutions" },
                      { label: "Pricing", href: "/#pricing" },
                    ],
                  },
                  {
                    title: "Legal",
                    links: [
                      { label: "Privacy Policy", href: "/privacy" },
                      { label: "Terms of Service", href: "/terms" },
                    ],
                  },
                  {
                    title: "Pages",
                    links: [
                      { label: "Login", href: "/login" },
                      { label: "Sign Up", href: "/register" },
                    ],
                  },
                ].map((column, i) => (
                  <div key={i}>
                    <h3 className="font-semibold text-black mb-4">
                      {column.title}
                    </h3>
                    <ul className="space-y-2">
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            className="text-gray-600 hover:text-black transition-colors"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {/* Company Info - Desktop Only */}
                <div className="hidden md:block md:col-span-1 md:order-first">
                  <div className="flex space-x-4 md:justify-start">
                    {[
                      {
                        href: "https://www.linkedin.com/company/serplexity",
                        icon: (
                          <FaLinkedin className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                      {
                        href: "#",
                        icon: (
                          <FaXTwitter className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                    ].map((social, i) => (
                      <a
                        href={social.href}
                        key={i}
                        className="group w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-all duration-200 cursor-pointer"
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 mt-12 pt-8 text-gray-600">
              {/* Desktop Footer */}
              <div className="hidden md:flex items-center justify-between">
                <p className="text-sm">
                  &copy; {new Date().getFullYear()} Serplexity. All rights
                  reserved.
                </p>
                <div className="flex items-center">
                  <img
                    src="/Serplexity.png"
                    alt="Serplexity"
                    className="w-6 h-6 mr-2"
                  />
                  <span className="text-lg font-bold text-black">
                    Serplexity
                  </span>
                </div>
              </div>
              {/* Mobile Footer */}
              <div className="md:hidden">
                <div className="flex items-center justify-center gap-x-6">
                  <div className="flex items-center">
                    <img
                      src="/Serplexity.png"
                      alt="Serplexity"
                      className="w-6 h-6 mr-2"
                    />
                    <span className="text-lg font-bold text-black">
                      Serplexity
                    </span>
                  </div>
                  <div className="flex space-x-4">
                    {[
                      {
                        href: "https://www.linkedin.com/company/serplexity",
                        icon: (
                          <FaLinkedin className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                      {
                        href: "#",
                        icon: (
                          <FaXTwitter className="w-5 h-5 text-gray-600 group-hover:text-black transition-colors" />
                        ),
                      },
                    ].map((social, i) => (
                      <a
                        href={social.href}
                        key={i}
                        className="group w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-all duration-200 cursor-pointer"
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-center mt-8">
                  &copy; {new Date().getFullYear()} Serplexity. All rights
                  reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ResearchPage;
