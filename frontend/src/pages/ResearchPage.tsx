import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types/schemas';
import { Button } from '../components/ui/Button';
import Card from '../components/ui/Card';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  // const { slug } = useParams();

  const isAdmin = user?.role === Role.ADMIN;

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/blog?published=true');
      if (!response.ok) {
        throw new Error('Failed to fetch blog posts');
      }
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Research</h1>
              <p className="text-gray-600 mt-2">
                Insights and analysis from our team
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-3">
                <Link to="/research/new">
                  <Button>Add New Article</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No articles yet
            </h2>
            <p className="text-gray-600">
              Check back soon for insights and research from our team.
            </p>
            {isAdmin && (
              <Link to="/research/new" className="inline-block mt-4">
                <Button>Create First Article</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <Card key={post.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      <Link 
                        to={`/research/${post.slug}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {post.title}
                      </Link>
                    </h2>
                    {post.excerpt && (
                      <p className="text-gray-600 mb-3">{post.excerpt}</p>
                    )}
                    <div className="flex items-center text-sm text-gray-500">
                      <span>By {post.author.name || post.author.email}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 ml-4">
                      <Link to={`/research/edit/${post.id}`}>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
                {post.coverImage && (
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchPage;