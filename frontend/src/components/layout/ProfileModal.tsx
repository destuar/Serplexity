/**
 * @file ProfileModal.tsx
 * @description Modal component for user profile management, including profile editing, password changes, and account settings.
 * Provides a comprehensive interface for users to manage their account information and preferences.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../../contexts/AuthContext: For user authentication and profile management.
 * - ../../services/companyService: For company-related API calls.
 *
 * @exports
 * - ProfileModal: The main profile modal component.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  Stars,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
// Note: buttonClasses and formClasses imports removed as they're unused
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "../../lib/apiClient";
import { MODEL_CONFIGS, getModelDisplayName } from "../../types/dashboard";
import { Button } from "../ui/Button";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Validation schemas
const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message: string;
}

type ProfileFormData = z.infer<typeof profileUpdateSchema>;
type PasswordFormData = z.infer<typeof passwordChangeSchema>;

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [_modelsSuccess, setModelsSuccess] = useState(false);

  // Model preferences state
  const [modelPreferences, setModelPreferences] = useState<
    Record<string, boolean>
  >({
    "gpt-4.1-mini": true,
    "claude-3-5-haiku-20241022": true,
    "gemini-2.5-flash": true,
    sonar: true,
  });

  // Load model preferences when modal opens
  const loadModelPreferences = async () => {
    try {
      const response = await apiClient.get("/users/me/model-preferences");
      setModelPreferences(response.data.modelPreferences);
    } catch (error) {
      console.error("Failed to load model preferences:", error);
      // Keep default preferences on error
    }
  };

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordChangeSchema),
  });

  // Load model preferences when modal opens
  useEffect(() => {
    if (isOpen) {
      loadModelPreferences();
    }
  }, [isOpen]);

  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      resetProfile({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user, resetProfile]);

  if (!isOpen) return null;

  const onUpdateProfile = async (data: ProfileFormData) => {
    setIsUpdatingProfile(true);
    setProfileError(null);

    try {
      const response = await apiClient.put("/users/me/profile", data);

      // Update the user context with new data
      updateUser(response.data.user);
    } catch (error) {
      const apiError = error as ApiError;
      setProfileError(
        apiError.response?.data?.error || "Failed to update profile"
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onChangePassword = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await apiClient.put("/users/me/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      setPasswordSuccess(true);
      resetPassword();
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      const apiError = error as ApiError;
      setPasswordError(
        apiError.response?.data?.error || "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
      onClose(); // Close the modal after successful logout
    } catch (error) {
      console.error("Sign out failed:", error);
      // Even if logout fails, we should still close the modal
      // as the logout function in AuthContext handles clearing local state
      onClose();
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleManageSubscription = () => {
    // If user has active subscription, redirect to customer portal
    if (user?.subscriptionStatus === "active") {
      // This would typically be a customer portal link from Stripe
      const billingUrl = process.env.VITE_STRIPE_BILLING_PORTAL_URL || "#";
      if (billingUrl !== "#") {
        window.open(billingUrl, "_blank");
      }
    } else {
      // Navigate to the payment page to choose a plan
      navigate("/payment");
    }
  };

  const handleModelToggle = (modelId: string) => {
    setModelPreferences((prev) => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  const handleUpdateModels = async () => {
    setIsUpdatingModels(true);
    setModelsError(null);
    setModelsSuccess(false);

    try {
      await apiClient.put("/users/me/model-preferences", {
        modelPreferences,
      });

      setModelsSuccess(true);
      setTimeout(() => setModelsSuccess(false), 3000);
    } catch (error) {
      const apiError = error as ApiError;
      setModelsError(
        apiError.response?.data?.error || "Failed to update model preferences"
      );
    } finally {
      setIsUpdatingModels(false);
    }
  };

  const handleClose = () => {
    resetProfile({
      name: user?.name || "",
      email: user?.email || "",
    });
    resetPassword();
    setProfileError(null);
    setPasswordError(null);
    setModelsError(null);
    setPasswordSuccess(false);
    setModelsSuccess(false);
    setActiveTab("profile");
    onClose();
  };

  const isOAuthUser = user?.provider !== "credentials";

  const tabs = [
    { id: "profile", label: "Profile Info", icon: User },
    { id: "models", label: "Models", icon: Stars },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    {
      id: "password",
      label: "Change Password",
      icon: Lock,
      disabled: isOAuthUser,
    },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Profile Settings</h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row h-[calc(95vh-80px)] sm:h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-full sm:w-64 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 p-3 sm:p-4 flex-shrink-0">
            <nav className="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 overflow-x-auto sm:overflow-x-visible">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    className={`flex-shrink-0 sm:w-full flex items-center justify-center sm:justify-start px-3 sm:px-4 py-2 sm:py-3 text-left rounded-lg transition-colors focus:outline-none whitespace-nowrap sm:whitespace-normal min-w-[44px] sm:min-w-0 ${
                      activeTab === tab.id
                        ? "bg-black text-white"
                        : tab.disabled
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-5 h-5 sm:mr-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.disabled && (
                      <span className="hidden sm:inline ml-auto text-xs text-gray-400">
                        OAuth
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                    Profile Information
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4">
                    Update your account details below.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmitProfile(onUpdateProfile)}
                  className="space-y-4 sm:space-y-6"
                >
                  <div>
                    <label
                      htmlFor="name"
                      className="flex items-center text-sm font-medium text-gray-700 mb-1"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Account Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      {...registerProfile("name")}
                      className="flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-black placeholder:text-gray-500 ring-offset-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)]"
                      placeholder="Enter your account name"
                      style={{
                        WebkitTapHighlightColor: "transparent",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                        outline: "none",
                        border: "none",
                      }}
                    />
                    {profileErrors.name && (
                      <p className="mt-1 text-xs text-red-600">
                        {profileErrors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="flex items-center text-sm font-medium text-gray-700 mb-1"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      {...registerProfile("email")}
                      className="flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-black placeholder:text-gray-500 ring-offset-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)]"
                      placeholder="Enter your email address"
                      style={{
                        WebkitTapHighlightColor: "transparent",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                        outline: "none",
                        border: "none",
                      }}
                    />
                    {profileErrors.email && (
                      <p className="mt-1 text-xs text-red-600">
                        {profileErrors.email.message}
                      </p>
                    )}
                  </div>

                  {profileError && (
                    <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      {profileError}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>

                {/* Sign Out Section */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Account Actions
                    </h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Sign out of your account on this device.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="flex items-center text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {isSigningOut ? "Signing out..." : "Sign Out"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "models" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    AI Model Preferences
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Select which AI model responses you'd like to track.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* ChatGPT */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["gpt-4.1-mini"]?.logoUrl ? (
                          <img
                            src={MODEL_CONFIGS["gpt-4.1-mini"].logoUrl}
                            alt={getModelDisplayName("gpt-4.1-mini")}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName("gpt-4.1-mini").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {getModelDisplayName("gpt-4.1-mini")}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {MODEL_CONFIGS["gpt-4.1-mini"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["gpt-4.1-mini"]}
                        onChange={() => handleModelToggle("gpt-4.1-mini")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>

                  {/* Claude */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["claude-3-5-haiku-20241022"]?.logoUrl ? (
                          <img
                            src={
                              MODEL_CONFIGS["claude-3-5-haiku-20241022"].logoUrl
                            }
                            alt={getModelDisplayName(
                              "claude-3-5-haiku-20241022"
                            )}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName(
                              "claude-3-5-haiku-20241022"
                            ).charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {getModelDisplayName("claude-3-5-haiku-20241022")}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {MODEL_CONFIGS["claude-3-5-haiku-20241022"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["claude-3-5-haiku-20241022"]}
                        onChange={() =>
                          handleModelToggle("claude-3-5-haiku-20241022")
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>

                  {/* Gemini */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["gemini-2.5-flash"]?.logoUrl ? (
                          <img
                            src={MODEL_CONFIGS["gemini-2.5-flash"].logoUrl}
                            alt={getModelDisplayName("gemini-2.5-flash")}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName("gemini-2.5-flash").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {getModelDisplayName("gemini-2.5-flash")}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {MODEL_CONFIGS["gemini-2.5-flash"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["gemini-2.5-flash"]}
                        onChange={() => handleModelToggle("gemini-2.5-flash")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>

                  {/* Perplexity */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                        {MODEL_CONFIGS["sonar"]?.logoUrl ? (
                          <img
                            src={MODEL_CONFIGS["sonar"].logoUrl}
                            alt={getModelDisplayName("sonar")}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">
                            {getModelDisplayName("sonar").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {getModelDisplayName("sonar")}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {MODEL_CONFIGS["sonar"]?.company}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelPreferences["sonar"]}
                        onChange={() => handleModelToggle("sonar")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>
                </div>

                {modelsError && (
                  <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {modelsError}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-8">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpdateModels}
                    disabled={isUpdatingModels}
                  >
                    {isUpdatingModels ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "subscription" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Subscription Management
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Manage your Serplexity Pro subscription.
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        Current Plan
                      </h4>
                      <p className="text-sm text-gray-600">
                        {user?.subscriptionStatus === "active"
                          ? "Serplexity Pro"
                          : "Free Plan"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Status</p>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user?.subscriptionStatus === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {user?.subscriptionStatus === "active"
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Button
                      onClick={handleManageSubscription}
                      className="w-full"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {user?.subscriptionStatus === "active"
                        ? "Manage Subscription"
                        : "Upgrade to Pro"}
                    </Button>

                    {user?.subscriptionStatus === "active" && (
                      <div className="text-sm text-gray-600">
                        <p>• Update payment method</p>
                        <p>• Download invoices</p>
                        <p>• Cancel subscription</p>
                        <p>• Change billing frequency</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "password" && !isOAuthUser && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Change Password
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Update your password to keep your account secure.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmitPassword(onChangePassword)}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="currentPassword"
                      className="flex items-center text-sm font-medium text-gray-700 mb-1"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        {...registerPassword("currentPassword")}
                        className="flex h-11 w-full rounded-lg bg-white shadow-lg px-4 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation"
                        placeholder="Enter your current password"
                        style={{
                          WebkitTapHighlightColor: "transparent",
                          WebkitUserSelect: "none",
                          userSelect: "none",
                          outline: "none",
                          border: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.currentPassword && (
                      <p className="mt-1 text-xs text-red-600">
                        {passwordErrors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="newPassword"
                      className="flex items-center text-sm font-medium text-gray-700 mb-1"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        {...registerPassword("newPassword")}
                        className="flex h-11 w-full rounded-lg bg-white shadow-lg px-4 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation"
                        placeholder="Enter your new password"
                        style={{
                          WebkitTapHighlightColor: "transparent",
                          WebkitUserSelect: "none",
                          userSelect: "none",
                          outline: "none",
                          border: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="mt-1 text-xs text-red-600">
                        {passwordErrors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="flex items-center text-sm font-medium text-gray-700 mb-1"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        {...registerPassword("confirmPassword")}
                        className="flex h-11 w-full rounded-lg bg-white shadow-lg px-4 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation"
                        placeholder="Confirm your new password"
                        style={{
                          WebkitTapHighlightColor: "transparent",
                          WebkitUserSelect: "none",
                          userSelect: "none",
                          outline: "none",
                          border: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600">
                        {passwordErrors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {passwordError && (
                    <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="flex items-center p-3 text-sm text-green-700 bg-green-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Password changed successfully!
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isChangingPassword}>
                      {isChangingPassword ? "Changing..." : "Change Password"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
