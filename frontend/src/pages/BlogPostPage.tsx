import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types/schemas';
import { Button } from '../components/ui/Button';

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

const BlogPostPage: React.FC = () => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { slug } = useParams();
  const { user } = useAuth();
  // const navigate = useNavigate();

  const isAdmin = user?.role === Role.ADMIN;

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/blog/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Article not found');
        } else {
          throw new Error('Failed to fetch blog post');
        }
        return;
      }
      const data = await response.json();
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      fetchPost();
    }
  }, [slug, fetchPost]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Article not found'}
          </h1>
          <Link to="/research">
            <Button variant="secondary">Back to Research</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <Link to="/research" className="text-blue-600 hover:text-blue-700">
              ← Back to Research
            </Link>
            {isAdmin && (
              <Link to={`/research/edit/${post.id}`}>
                <Button variant="secondary" size="sm">
                  Edit Article
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Meta */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {post.title}
          </h1>
          <div className="flex items-center text-gray-600">
            <span>By {post.author.name || post.author.email}</span>
            <span className="mx-2">•</span>
            <time dateTime={post.publishedAt || post.createdAt}>
              {formatDate(post.publishedAt || post.createdAt)}
            </time>
          </div>
          {!post.published && isAdmin && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                This article is not published and is only visible to admins.
              </p>
            </div>
          )}
        </div>

        {/* Cover Image */}
        {post.coverImage && (
          <div className="mb-8">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-96 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Content */}
        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>
    </div>
  );
};

export default BlogPostPage;