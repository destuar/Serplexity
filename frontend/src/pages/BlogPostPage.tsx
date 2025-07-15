import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types/schemas';
import { Navbar } from '../components/layout/Navbar';
import apiClient from '../lib/apiClient';
import { useBlogPosts } from '../hooks/useBlogPosts';
import { formatBlogDate, estimateReadTime, extractFirstCategory, truncateText, stripHtmlTags } from '../utils/blogUtils';
import { ArrowRight, Calendar, Clock, Edit } from 'lucide-react';
import { FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

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
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  media: BlogMedia[];
}

const BlogPostPage: React.FC = () => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const starContainerRef = useRef<HTMLDivElement>(null);

  // Fetch other blog posts for the carousel
  const { posts: otherPosts, loading: _postsLoading } = useBlogPosts({ limit: 6 });

  const isAdmin = user?.role === Role.ADMIN;

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/blog/${slug}`);
      setPost(response.data);
    } catch (err: unknown) {
      const error = err as ApiError;
      if (error.response?.status === 404) {
        setError('Article not found');
      } else {
        setError(error.response?.data?.error || 'Failed to fetch blog post');
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      fetchPost();
    }
  }, [slug, fetchPost]);

  // Static stars effect - same as landing page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const starContainer = starContainerRef.current;

    const createStaticStars = () => {
      if (!starContainerRef.current) return;
      const numStars = 200;
      for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'absolute rounded-full bg-white';
        const size = Math.random() * 1.5 + 0.5;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        const glowSize = Math.random() * 4 + 2;
        star.style.boxShadow = `0 0 ${glowSize}px ${glowSize / 4}px rgba(255, 255, 255, 0.5)`;
        const initialOpacity = Math.random() * 0.5 + 0.3;
        star.style.opacity = `${initialOpacity}`;

        const twinkleDuration = Math.random() * 4 + 2;
        star.animate(
          [
            { opacity: initialOpacity },
            { opacity: initialOpacity * 0.3 },
            { opacity: initialOpacity },
          ],
          {
            duration: twinkleDuration * 1000,
            iterations: Infinity,
            easing: 'ease-in-out',
          }
        );

        starContainerRef.current.appendChild(star);
      }
    };
    createStaticStars();

    return () => {
      if (starContainer) {
        starContainer.innerHTML = '';
      }
    };
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Filter out the current post from other posts
  const relatedPosts = post ? otherPosts.filter(p => p.id !== post.id).slice(0, 3) : otherPosts.slice(0, 3);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510] text-white relative min-h-screen">
        <style>{`
          /* Vertical Grid Lines */
          .vertical-grid-container {
            position: relative;
          }
          
          .vertical-grid-container::before,
          .vertical-grid-container::after {
            content: '';
            position: fixed;
            top: 0;
            bottom: 0;
            width: 1px;
            background: linear-gradient(
              to bottom,
              transparent 0%,
              rgba(82, 113, 255, 0.3) 10%,
              rgba(118, 98, 255, 0.4) 50%,
              rgba(158, 82, 255, 0.3) 90%,
              transparent 100%
            );
            box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
            z-index: 1;
            pointer-events: none;
            opacity: 0;
            animation: gridFadeIn 1.5s ease-out 0.5s forwards, gridPulse 4s ease-in-out infinite 2s;
          }
          
          .vertical-grid-container::before {
            left: max(2rem, calc(50vw - 576px));
          }
          
          .vertical-grid-container::after {
            right: max(2rem, calc(50vw - 576px));
          }
          
          @keyframes gridFadeIn {
            to { opacity: 1; }
          }
          
          @keyframes gridPulse {
            0%, 100% { 
              opacity: 1;
              box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
            }
            50% { 
              opacity: 0.7;
              box-shadow: 0 0 12px rgba(118, 98, 255, 0.7);
            }
          }
          
          @media (max-width: 768px) {
            .vertical-grid-container::before,
            .vertical-grid-container::after {
              display: none;
            }
          }
        `}</style>
        
        {/* Background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
        
        {/* Static Stars */}
        <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0" />
        
        <div className="relative z-10 vertical-grid-container">
          <Navbar />
          
          <div className="flex items-center justify-center min-h-screen pt-24">
            <div className="text-center max-w-4xl mx-auto px-4">
              <div className="animate-pulse space-y-6">
                <div className="h-8 bg-white/10 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-white/10 rounded w-1/2 mx-auto"></div>
                <div className="space-y-4 mt-12">
                  <div className="h-4 bg-white/10 rounded"></div>
                  <div className="h-4 bg-white/10 rounded"></div>
                  <div className="h-4 bg-white/10 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510] text-white relative min-h-screen">
        <style>{`
          /* Vertical Grid Lines */
          .vertical-grid-container {
            position: relative;
          }
          
          .vertical-grid-container::before,
          .vertical-grid-container::after {
            content: '';
            position: fixed;
            top: 0;
            bottom: 0;
            width: 1px;
            background: linear-gradient(
              to bottom,
              transparent 0%,
              rgba(82, 113, 255, 0.3) 10%,
              rgba(118, 98, 255, 0.4) 50%,
              rgba(158, 82, 255, 0.3) 90%,
              transparent 100%
            );
            box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
            z-index: 1;
            pointer-events: none;
            opacity: 0;
            animation: gridFadeIn 1.5s ease-out 0.5s forwards, gridPulse 4s ease-in-out infinite 2s;
          }
          
          .vertical-grid-container::before {
            left: max(2rem, calc(50vw - 576px));
          }
          
          .vertical-grid-container::after {
            right: max(2rem, calc(50vw - 576px));
          }
          
          @keyframes gridFadeIn {
            to { opacity: 1; }
          }
          
          @keyframes gridPulse {
            0%, 100% { 
              opacity: 1;
              box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
            }
            50% { 
              opacity: 0.7;
              box-shadow: 0 0 12px rgba(118, 98, 255, 0.7);
            }
          }
          
          @media (max-width: 768px) {
            .vertical-grid-container::before,
            .vertical-grid-container::after {
              display: none;
            }
          }
        `}</style>
        
        {/* Background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
        
        {/* Static Stars */}
        <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0" />
        
        <div className="relative z-10 vertical-grid-container">
          <Navbar />
          
          <div className="flex items-center justify-center min-h-screen pt-24">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                {error || 'Article not found'}
              </h1>
              <Link to="/research">
                <button className="px-6 py-3 bg-[#7762ff] hover:bg-[#6650e6] text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl">
                  Back to Research
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-black via-[#0a0a1a] to-[#050510] text-white relative min-h-screen">
      <style>{`
        /* Vertical Grid Lines */
        .vertical-grid-container {
          position: relative;
        }
        
        .vertical-grid-container::before,
        .vertical-grid-container::after {
          content: '';
          position: fixed;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(82, 113, 255, 0.3) 10%,
            rgba(118, 98, 255, 0.4) 50%,
            rgba(158, 82, 255, 0.3) 90%,
            transparent 100%
          );
          box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
          z-index: 1;
          pointer-events: none;
          opacity: 0;
          animation: gridFadeIn 1.5s ease-out 0.5s forwards, gridPulse 4s ease-in-out infinite 2s;
        }
        
        .vertical-grid-container::before {
          left: max(2rem, calc(50vw - 576px));
        }
        
        .vertical-grid-container::after {
          right: max(2rem, calc(50vw - 576px));
        }
        
        @keyframes gridFadeIn {
          to { opacity: 1; }
        }
        
        @keyframes gridPulse {
          0%, 100% { 
            opacity: 1;
            box-shadow: 0 0 8px rgba(118, 98, 255, 0.5);
          }
          50% { 
            opacity: 0.7;
            box-shadow: 0 0 12px rgba(118, 98, 255, 0.7);
          }
        }
        
        @media (max-width: 768px) {
          .vertical-grid-container::before,
          .vertical-grid-container::after {
            display: none;
          }
        }

        /* Custom prose styling for dark theme */
        .prose-dark {
          color: #e5e7eb;
          max-width: none;
        }
        
        .prose-dark h1,
        .prose-dark h2,
        .prose-dark h3,
        .prose-dark h4,
        .prose-dark h5,
        .prose-dark h6 {
          color: #ffffff;
          font-weight: 600;
        }
        
        .prose-dark h1 { font-size: 2.25rem; line-height: 2.5rem; margin-bottom: 2rem; margin-top: 3rem; }
        .prose-dark h2 { font-size: 1.875rem; line-height: 2.25rem; margin-bottom: 1.5rem; margin-top: 2.5rem; }
        .prose-dark h3 { font-size: 1.5rem; line-height: 2rem; margin-bottom: 1rem; margin-top: 2rem; }
        .prose-dark h4 { font-size: 1.25rem; line-height: 1.75rem; margin-bottom: 0.75rem; margin-top: 1.5rem; }
        
        .prose-dark p {
          margin-bottom: 1.5rem;
          line-height: 1.75;
          font-size: 1.125rem;
        }
        
        .prose-dark a {
          color: #7762ff;
          text-decoration: underline;
          transition: color 0.2s;
        }
        
        .prose-dark a:hover {
          color: #6650e6;
        }
        
        .prose-dark strong {
          color: #ffffff;
          font-weight: 600;
        }
        
        .prose-dark em {
          font-style: italic;
          color: #d1d5db;
        }
        
        .prose-dark ul,
        .prose-dark ol {
          margin-bottom: 1.5rem;
          padding-left: 1.5rem;
        }
        
        .prose-dark li {
          margin-bottom: 0.5rem;
          line-height: 1.75;
        }
        
        .prose-dark blockquote {
          border-left: 4px solid #7762ff;
          padding-left: 1.5rem;
          margin: 2rem 0;
          font-style: italic;
          color: #d1d5db;
          background: rgba(119, 98, 255, 0.05);
          padding: 1.5rem;
          border-radius: 0.5rem;
        }
        
        .prose-dark code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          color: #ffffff;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
        
        .prose-dark pre {
          background: rgba(0, 0, 0, 0.5);
          padding: 1.5rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin: 2rem 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .prose-dark pre code {
          background: none;
          padding: 0;
          color: #e5e7eb;
        }
        
        .prose-dark img {
          border-radius: 0.75rem;
          margin: 2rem 0;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .prose-dark hr {
          border: none;
          height: 1px;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(255, 255, 255, 0.2) 50%,
            transparent 100%
          );
          margin: 3rem 0;
        }
        
        .prose-dark table {
          width: 100%;
          border-collapse: collapse;
          margin: 2rem 0;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 0.75rem;
          overflow: hidden;
        }
        
        .prose-dark th,
        .prose-dark td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .prose-dark th {
          background: rgba(119, 98, 255, 0.2);
          color: #ffffff;
          font-weight: 600;
        }
      `}</style>
      
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,113,255,0.08),transparent_50%)]"></div>
      
      {/* Static Stars */}
      <div ref={starContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-0" />
      
      <div className="relative z-10 vertical-grid-container">
        <Navbar />
        
        {/* Article Content */}
        <article className="relative px-4 pt-28 pb-12">
          <div className="max-w-4xl mx-auto">
            {/* Header with left-aligned breadcrumb */}
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Link to="/" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
                  ← Home
                </Link>
                <span className="text-gray-600">/</span>
                <Link to="/research" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
                  Research
                </Link>
                <span className="text-gray-600">/</span>
                <span className="text-sm font-medium text-gray-300 truncate max-w-[200px]">
                  {post.title}
                </span>
              </div>
              
              {/* Article Meta */}
              <div className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8">
                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-[#5271ff]/20 text-[#5271ff] rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  {post.title}
                </h1>
                
                {post.excerpt && (
                  <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                    {post.excerpt}
                  </p>
                )}
                
                <div className="flex flex-wrap items-center gap-4 text-gray-400 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {(post.author.name || post.author.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span>By {post.author.name || post.author.email}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <time dateTime={post.publishedAt || post.createdAt}>
                      {formatDate(post.publishedAt || post.createdAt)}
                    </time>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{estimateReadTime(post.content)} min read</span>
                  </div>
                  {isAdmin && (
                    <>
                      <span>•</span>
                      <Link to={`/research/edit/${post.id}`}>
                        <button className="flex items-center gap-1 px-3 py-1 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-xs font-medium">
                          <Edit className="h-3 w-3" />
                          Edit
                        </button>
                      </Link>
                    </>
                  )}
                </div>
                
                {!post.published && isAdmin && (
                  <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300">
                      This article is not published and is only visible to admins.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Cover Image */}
            {post.coverImage && (
              <div className="mb-12">
                <div className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-2 overflow-hidden">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-96 md:h-[500px] object-cover rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Article Content */}
            <div className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-8 md:p-12">
              <div 
                className="prose-dark"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>
          </div>
        </article>

        {/* Related Articles Section */}
        {relatedPosts.length > 0 && (
          <section className="relative px-4 pb-12">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  More Research & Insights
                </h2>
                <p className="text-xl text-gray-300">
                  Continue exploring our latest findings
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {relatedPosts.map((relatedPost) => (
                  <article
                    key={relatedPost.id}
                    onClick={() => navigate(`/research/${relatedPost.slug}`)}
                    className="bg-black/5 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] p-6 hover:bg-black/10 transition-all duration-200 group cursor-pointer"
                  >
                    {/* Blog Post Image */}
                    <div className="w-full h-48 bg-gradient-to-br from-[#5271ff]/20 to-[#9e52ff]/20 rounded-xl mb-6 overflow-hidden">
                      {relatedPost.coverImage ? (
                        <img
                          src={relatedPost.coverImage}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Blog Post Content */}
                    <div className="space-y-4">
                      {/* Category Tag & Date */}
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-[#5271ff]/20 text-[#5271ff] rounded-full text-xs font-medium">
                          {extractFirstCategory(relatedPost.tags)}
                        </span>
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatBlogDate(relatedPost.publishedAt || relatedPost.createdAt)}
                        </span>
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-xl font-semibold text-white group-hover:text-gray-100 transition-colors line-clamp-2">
                        {relatedPost.title}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-gray-300 text-sm line-clamp-3">
                        {relatedPost.excerpt 
                          ? truncateText(stripHtmlTags(relatedPost.excerpt), 120)
                          : truncateText(stripHtmlTags(relatedPost.content), 120)
                        }
                      </p>
                      
                      {/* Read More Link & Read Time */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-[#5271ff] text-sm font-medium group-hover:text-[#7662ff] transition-colors">
                          <span>Read more</span>
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <div className="flex items-center text-gray-400 text-xs gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{estimateReadTime(relatedPost.content)} min read</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              
              {/* View All Posts Button */}
              <div className="text-center mt-12">
                <button 
                  onClick={() => navigate('/research')}
                  className="bg-white/10 text-white hover:bg-white/20 px-8 py-3 rounded-full font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 mx-auto"
                >
                  View All Articles
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="bg-transparent">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="inline-grid grid-cols-3 md:grid-cols-4 gap-8 text-left">
                {/* Links */}
                {[
                  { title: "Product", links: [
                    { label: "About", href: "/#solutions" },
                    { label: "Pricing", href: "/#pricing" }
                  ]},
                  { title: "Legal", links: [
                    { label: "Privacy Policy", href: "/privacy" },
                    { label: "Terms of Service", href: "/terms" }
                  ]},
                  { title: "Pages", links: [
                    { label: "Login", href: "/login" },
                    { label: "Sign Up", href: "/register" }
                  ]}
                ].map((column, i) => (
                  <div key={i}>
                    <h3 className="font-semibold text-white mb-4">{column.title}</h3>
                    <ul className="space-y-2">
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <a href={link.href} className="text-gray-400 hover:text-white transition-colors">
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
                      { href: 'https://www.linkedin.com/company/serplexity', icon: <FaLinkedin className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> },
                      { href: '#', icon: <FaXTwitter className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> }
                    ].map((social, i) => (
                      <a href={social.href} key={i} className="group w-8 h-8 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-200 cursor-pointer">
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 mt-12 pt-8 text-gray-400">
              {/* Desktop Footer */}
              <div className="hidden md:flex items-center justify-between">
                <p className="text-sm">&copy; {new Date().getFullYear()} Serplexity. All rights reserved.</p>
                <div className="flex items-center">
                  <img src="/Serplexity.png" alt="Serplexity" className="w-6 h-6 mr-2" />
                  <span className="text-lg font-bold text-white">Serplexity</span>
                </div>
              </div>
              {/* Mobile Footer */}
              <div className="md:hidden">
                <div className="flex items-center justify-center gap-x-6">
                  <div className="flex items-center">
                    <img src="/Serplexity.png" alt="Serplexity" className="w-6 h-6 mr-2" />
                    <span className="text-lg font-bold text-white">Serplexity</span>
                  </div>
                  <div className="flex space-x-4">
                    {[
                      { href: 'https://www.linkedin.com/company/serplexity', icon: <FaLinkedin className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> },
                      { href: '#', icon: <FaXTwitter className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" /> }
                    ].map((social, i) => (
                      <a href={social.href} key={i} className="group w-8 h-8 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-200 cursor-pointer">
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-center mt-8">&copy; {new Date().getFullYear()} Serplexity. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default BlogPostPage;