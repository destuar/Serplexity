import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types/schemas';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import RichTextEditor from '../components/blog/RichTextEditor';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  published: boolean;
  publishedAt: string | null;
}

const BlogEditorPage: React.FC = () => {
  const [post, setPost] = useState<BlogPost>({
    id: '',
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    coverImage: '',
    published: false,
    publishedAt: null
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const isEditing = Boolean(id && id !== 'new');
  const isAdmin = user?.role === Role.ADMIN;

  const fetchPost = useCallback(async () => {
    if (!id || id === 'new') return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/blog/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch blog post');
      }
      
      const data = await response.json();
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/research');
      return;
    }
    
    if (isEditing) {
      fetchPost();
    }
  }, [isAdmin, navigate, isEditing, fetchPost]);

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('token');
    const response = await fetch('/api/blog/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.url;
  };

  const handleSave = async (published: boolean = false) => {
    try {
      setSaving(true);
      setError(null);

      const token = localStorage.getItem('token');
      const payload = {
        ...post,
        published,
        excerpt: post.excerpt || undefined,
        coverImage: post.coverImage || undefined
      };

      const url = isEditing ? `/api/blog/${post.id}` : '/api/blog';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save blog post');
      }

      const savedPost = await response.json();
      setPost(savedPost);
      
      if (published) {
        navigate(`/research/${savedPost.slug}`);
      } else {
        navigate('/research');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !confirm('Are you sure you want to delete this article?')) {
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/blog/${post.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete blog post');
      }

      navigate('/research');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              <div className="h-12 bg-gray-300 rounded"></div>
              <div className="h-64 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? 'Edit Article' : 'New Article'}
              </h1>
              <Link to="/research" className="text-blue-600 hover:text-blue-700 text-sm">
                ← Back to Research
              </Link>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={saving || !post.title || !post.content}
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || !post.title || !post.content}
              >
                {saving ? 'Publishing...' : 'Publish'}
              </Button>
              {isEditing && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <Input
              type="text"
              value={post.title}
              onChange={(e) => setPost({ ...post, title: e.target.value })}
              placeholder="Enter article title..."
              className="text-xl font-semibold"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excerpt (optional)
            </label>
            <textarea
              value={post.excerpt || ''}
              onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
              placeholder="Brief description of the article..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cover Image URL (optional)
            </label>
            <Input
              type="url"
              value={post.coverImage || ''}
              onChange={(e) => setPost({ ...post, coverImage: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
            {post.coverImage && (
              <div className="mt-3">
                <img
                  src={post.coverImage}
                  alt="Cover preview"
                  className="h-32 object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <RichTextEditor
              content={post.content}
              onChange={(content) => setPost({ ...post, content })}
              onImageUpload={handleImageUpload}
              placeholder="Start writing your article..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogEditorPage;