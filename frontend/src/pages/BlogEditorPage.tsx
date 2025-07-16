/**
 * @file BlogEditorPage.tsx
 * @description Blog editor page for creating and editing blog posts.
 * Provides rich text editing, SEO optimization, and content management functionality.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - react-hook-form: For form handling.
 * - lucide-react: For icons.
 * - ../hooks/useBlogPosts: For blog post management.
 *
 * @exports
 * - BlogEditorPage: The main blog editor page component.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types/schemas';
import { Button } from '../components/ui/Button';
import RichTextEditor from '../components/blog/RichTextEditor';
import Card from '../components/ui/Card';
import apiClient from '../lib/apiClient';
import { toast } from 'sonner';

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
    status?: number;
  };
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
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
  estimatedReadTime?: number;
}

const BlogEditorPage: React.FC = () => {
  const [post, setPost] = useState<BlogPost>({
    id: '',
    title: '',
    slug: '',
    content: '',
    excerpt: null,
    coverImage: null,
    published: false,
    publishedAt: null,
    metaTitle: null,
    metaDescription: null,
    tags: [],
    estimatedReadTime: 0
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const initialPostRef = useRef<string>('');
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const isEditing = Boolean(id && id !== 'new');
  const isAdmin = user?.role === Role.ADMIN;

  const fetchPost = useCallback(async () => {
    if (!id || id === 'new') return;
    
    try {
      setLoading(true);
      const response = await apiClient.get(`/blog/admin/${id}`);
      const data = response.data;
      setPost(data);
      
      // Set initial state with only the fields we monitor for changes
      const initialState = JSON.stringify({ 
        title: data.title, 
        content: data.content, 
        excerpt: data.excerpt, 
        coverImage: data.coverImage,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        tags: data.tags
      });
      initialPostRef.current = initialState;
      setHasUnsavedChanges(false);
    } catch (err: unknown) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.error || 'Failed to fetch blog post';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleSave = useCallback(async (published: boolean = false, showToast: boolean = true) => {
    if (!post.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!post.content.trim()) {
      toast.error('Content is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        title: post.title.trim(),
        content: post.content.trim(),
        excerpt: post.excerpt?.trim() || undefined,
        coverImage: post.coverImage?.trim() || undefined,
        metaTitle: post.metaTitle?.trim() || undefined,
        metaDescription: post.metaDescription?.trim() || undefined,
        tags: post.tags || [],
        published
      };

      let response;
      if (isEditing) {
        response = await apiClient.put(`/blog/${post.id}`, payload);
      } else {
        response = await apiClient.post('/blog', payload);
      }

      const savedPost = response.data;
      setPost(savedPost);
      
      // Update change tracking with the same fields we monitor
      const savedPostState = JSON.stringify({ 
        title: savedPost.title, 
        content: savedPost.content, 
        excerpt: savedPost.excerpt, 
        coverImage: savedPost.coverImage,
        metaTitle: savedPost.metaTitle,
        metaDescription: savedPost.metaDescription,
        tags: savedPost.tags
      });
      initialPostRef.current = savedPostState;
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      if (showToast) {
        toast.success(published ? 'Article published successfully!' : 'Draft saved successfully!');
      }
      
      if (published) {
        navigate(`/research/${savedPost.slug}`);
      } else if (!isEditing) {
        // Redirect to edit page for new drafts
        navigate(`/research/edit/${savedPost.id}`);
      }
    } catch (err: unknown) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.error || 'Failed to save blog post';
      setError(errorMessage);
      if (showToast) {
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  }, [post, isEditing, navigate]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges || !post.title.trim() || !post.content.trim() || saving) {
      return;
    }
    
    try {
      await handleSave(false, false); // Don't show toast for auto-save
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [hasUnsavedChanges, post.title, post.content, saving, handleSave]);

  // Track changes for auto-save
  useEffect(() => {
    const currentPost = JSON.stringify({ 
      title: post.title, 
      content: post.content, 
      excerpt: post.excerpt, 
      coverImage: post.coverImage,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      tags: post.tags
    });
    const hasChanges = currentPost !== initialPostRef.current;
    setHasUnsavedChanges(hasChanges);

    if (hasChanges && (post.title.trim() || post.content.trim())) {
      // Clear existing auto-save timeout
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
      
      // Set new auto-save timeout (30 seconds)
      autoSaveRef.current = setTimeout(() => {
        autoSave();
      }, 30000);
    }

    // Cleanup timeout on unmount
    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [post.title, post.content, post.excerpt, post.coverImage, post.metaTitle, post.metaDescription, post.tags, autoSave]);

  // Warn about unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/research');
      return;
    }
    
    if (isEditing) {
      fetchPost();
    } else {
      // For new posts, set initial state
      initialPostRef.current = JSON.stringify({ title: '', content: '', excerpt: null, coverImage: null });
    }
  }, [isAdmin, navigate, isEditing, fetchPost]);

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await apiClient.post('/blog/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data.url;
    } catch (err: unknown) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.error || 'Failed to upload image';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleCoverImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCover(true);
      const imageUrl = await handleImageUpload(file);
      setPost({ ...post, coverImage: imageUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload cover image');
    } finally {
      setUploadingCover(false);
    }
  };


  const handleDelete = async () => {
    if (!isEditing || !confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await apiClient.delete(`/blog/${post.id}`);
      toast.success('Article deleted successfully');
      navigate('/research');
    } catch (err: unknown) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.error || 'Failed to delete blog post';
      setError(errorMessage);
      toast.error(errorMessage);
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
      {/* Header - Match dashboard header style */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto px-8 py-6" style={{ maxWidth: 'calc(100vw - 4rem)' }}>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link to="/research" className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                  ← Research
                </Link>
                {isEditing && post.title && (
                  <>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-500 text-sm">
                      {post.published ? 'Published' : 'Drafts'}
                    </span>
                    <span className="text-gray-300">/</span>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                      {post.title}
                    </span>
                  </>
                )}
                {!isEditing && (
                  <>
                    <span className="text-gray-300">/</span>
                    <span className="text-sm font-medium text-gray-700">
                      New Article
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing && post.title ? post.title : (isEditing ? 'Edit Article' : 'Create New Article')}
              </h1>
              {isEditing && !post.published && (
                <p className="text-sm text-gray-500 mt-1">Draft</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Auto-save indicator */}
              {lastSaved && (
                <div className="text-xs text-gray-500">
                  {hasUnsavedChanges ? (
                    <span className="text-yellow-600">Unsaved changes</span>
                  ) : (
                    <span>Last saved {lastSaved.toLocaleTimeString()}</span>
                  )}
                </div>
              )}
              
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={saving || !post.title.trim() || !post.content.trim()}
                className="px-6"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || !post.title.trim() || !post.content.trim()}
                className="px-6 bg-[#7762ff] hover:bg-[#6650e6] text-white"
              >
                {saving ? 'Publishing...' : 'Publish'}
              </Button>
              {isEditing && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-6"
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto px-8 py-8" style={{ maxWidth: 'calc(100vw - 4rem)' }}>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Editor - Full Left Side */}
          <div className="lg:col-span-3">
            <Card className="h-full">
              <div className="h-full flex flex-col">
                <div className="border border-gray-200 rounded-lg overflow-hidden flex-1">
                  <RichTextEditor
                    content={post.content}
                    onChange={(content) => setPost({ ...post, content })}
                    onImageUpload={handleImageUpload}
                    placeholder="Start writing your article..."
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar - 1/3 width */}
          <div className="space-y-6">
            {/* Article Settings Card */}
            <Card>
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">Article Settings</h3>
                
                {/* Article Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={post.title}
                    onChange={(e) => setPost({ ...post, title: e.target.value })}
                    placeholder="Enter a compelling title..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] text-sm text-gray-900 placeholder:text-gray-400 font-medium"
                  />
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Excerpt
                  </label>
                  <textarea
                    value={post.excerpt || ''}
                    onChange={(e) => setPost({ ...post, excerpt: e.target.value || null })}
                    placeholder="Brief description of the article..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] text-sm text-gray-900 placeholder:text-gray-400 resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will appear in article previews and search results.
                  </p>
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cover Image
                  </label>
                  
                  {!post.coverImage ? (
                    <label className="block w-full cursor-pointer group">
                      <div className="flex flex-col items-center justify-center px-6 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors group-hover:bg-gray-50">
                        <div className="text-center">
                          {uploadingCover ? (
                            <div className="text-sm text-gray-600">Uploading...</div>
                          ) : (
                            <>
                              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <div className="text-sm text-gray-600 mb-1">
                                <span className="font-medium text-[#7762ff] group-hover:text-[#6650e6]">Upload an image</span>
                              </div>
                              <div className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</div>
                            </>
                          )}
                        </div>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleCoverImageUpload}
                        disabled={uploadingCover}
                      />
                    </label>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative group">
                        <img
                          src={post.coverImage}
                          alt="Cover preview"
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => setPost({ ...post, coverImage: null })}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                          disabled={uploadingCover}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <label className="block w-full cursor-pointer">
                        <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-gray-50 hover:bg-gray-100">
                          <span className="text-sm text-gray-600 font-medium">
                            {uploadingCover ? 'Uploading...' : 'Replace image'}
                          </span>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleCoverImageUpload}
                          disabled={uploadingCover}
                        />
                      </label>
                    </div>
                  )}
                </div>

                                 {/* Tags */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Tags
                   </label>
                   <input
                     type="text"
                     value={(post.tags || []).join(', ')}
                     onChange={(e) => {
                       const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                       setPost({ ...post, tags });
                     }}
                     placeholder="Enter tags separated by commas..."
                     className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] text-sm text-gray-900 placeholder:text-gray-400"
                   />
                   <p className="text-xs text-gray-500 mt-1">
                     Separate tags with commas. These help with categorization and SEO.
                   </p>
                   {(post.tags || []).length > 0 && (
                     <div className="flex flex-wrap gap-1 mt-2">
                       {(post.tags || []).map((tag, index) => (
                         <span
                           key={index}
                           className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#7762ff]/10 text-[#7762ff]"
                         >
                           {tag}
                         </span>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* SEO Section */}
                 <div className="pt-4 border-t border-gray-100">
                   <h4 className="text-sm font-semibold text-gray-700 mb-4">SEO & Metadata</h4>
                   
                   <div className="space-y-4">
                     {/* Meta Title */}
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Meta Title
                       </label>
                       <input
                         type="text"
                         value={post.metaTitle || ''}
                         onChange={(e) => setPost({ ...post, metaTitle: e.target.value || null })}
                         placeholder="Custom title for search engines..."
                         className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] text-sm text-gray-900 placeholder:text-gray-400"
                         maxLength={60}
                       />
                       <p className="text-xs text-gray-500 mt-1">
                         {(post.metaTitle || '').length}/60 characters. Leave empty to use article title.
                       </p>
                     </div>

                     {/* Meta Description */}
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Meta Description
                       </label>
                       <textarea
                         value={post.metaDescription || ''}
                         onChange={(e) => setPost({ ...post, metaDescription: e.target.value || null })}
                         placeholder="Description for search engine results..."
                         className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] text-sm text-gray-900 placeholder:text-gray-400 resize-none"
                         rows={3}
                         maxLength={160}
                       />
                       <p className="text-xs text-gray-500 mt-1">
                         {(post.metaDescription || '').length}/160 characters. Leave empty to use excerpt.
                       </p>
                     </div>

                     {/* URL Slug */}
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         URL Slug
                       </label>
                       <div className="relative">
                         <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                           /research/
                         </span>
                         <input
                           type="text"
                           value={post.slug || ''}
                           onChange={(e) => {
                             const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                             setPost({ ...post, slug });
                           }}
                           placeholder="url-friendly-title"
                           className="w-full pl-20 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] text-sm text-gray-900 placeholder:text-gray-400"
                         />
                       </div>
                       <p className="text-xs text-gray-500 mt-1">
                         Auto-generated from title. Only use lowercase letters, numbers, and hyphens.
                       </p>
                     </div>
                   </div>
                 </div>

                 {/* Publication Status */}
                 {isEditing && (
                   <div className="pt-4 border-t border-gray-100">
                     <div className="flex items-center justify-between">
                       <span className="text-sm font-medium text-gray-700">Status</span>
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                         post.published 
                           ? 'bg-green-100 text-green-800' 
                           : 'bg-yellow-100 text-yellow-800'
                       }`}>
                         {post.published ? 'Published' : 'Draft'}
                       </span>
                     </div>
                     {post.publishedAt && (
                       <p className="text-xs text-gray-500 mt-1">
                         Published {new Date(post.publishedAt).toLocaleDateString()}
                       </p>
                     )}
                   </div>
                 )}
               </div>
             </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogEditorPage;