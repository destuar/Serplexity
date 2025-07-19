/**
 * @file CompanyProfileForm.tsx
 * @description This component provides a comprehensive form for creating and editing company profiles.
 * It includes fields for company name, website, industry (with an autocomplete feature), products/services,
 * competitors, and benchmarking questions. It uses `react-hook-form` and `zod` for form management and validation,
 * and integrates with the `CompanyContext` for data submission. This form is crucial for users to set up and
 * manage their company information within the application.
 *
 * @dependencies
 * - react: The core React library.
 * - react-hook-form: For flexible and extensible forms with easy-to-use validation.
 * - @hookform/resolvers/zod: Zod resolver for React Hook Form.
 * - zod: For schema validation.
 * - lucide-react: Icon library for React.
 * - ../ui/FormInput: Custom form input component.
 * - ../ui/Button: Custom button component.
 * - ../../contexts/CompanyContext: Provides company-related data and actions.
 * - ../../types/schemas: Type definitions for Company, Product, Competitor, and BenchmarkingQuestion.
 * - ../../utils/urlNormalizer: Utility for URL validation.
 *
 * @exports
 * - CompanyProfileForm: React functional component for company profile management.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader } from 'lucide-react';
import { useCompany, CompanyFormData, Company } from '../../contexts/CompanyContext';
import { flexibleUrlSchema } from '../../utils/urlNormalizer';

// Simplified form validation schema - only required fields
const formSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: flexibleUrlSchema,
  industry: z.string().min(1, 'Industry is required'),
});

type FormData = z.infer<typeof formSchema>;

interface CompanyProfileFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
  initialData?: Company;
  mode?: 'create' | 'edit';
}

// Comprehensive industry options
const INDUSTRY_OPTIONS = [
  'Advertising & Marketing',
  'Aerospace & Defense',
  'Agriculture & Farming',
  'Architecture & Construction',
  'Automotive',
  'Banking & Financial Services',
  'Biotechnology',
  'Chemical & Petrochemical',
  'Consulting',
  'Consumer Electronics',
  'Consumer Goods',
  'Cybersecurity',
  'E-commerce & Retail',
  'Education & Training',
  'Energy & Utilities',
  'Entertainment & Media',
  'Environmental Services',
  'Fashion & Apparel',
  'Financial Technology (FinTech)',
  'Food & Beverage',
  'Gaming',
  'Government & Public Sector',
  'Healthcare & Medical',
  'Hospitality & Tourism',
  'Human Resources',
  'Insurance',
  'Internet & Software',
  'Investment & Asset Management',
  'Legal Services',
  'Logistics & Supply Chain',
  'Manufacturing',
  'Mining & Metals',
  'Non-Profit',
  'Oil & Gas',
  'Pharmaceutical',
  'Professional Services',
  'Real Estate',
  'Renewable Energy',
  'Research & Development',
  'Retail & Consumer',
  'Sports & Recreation',
  'Telecommunications',
  'Transportation & Logistics',
  'Travel & Tourism',
  'Venture Capital & Private Equity',
  'Waste Management',
  'Other',
];

// Autocomplete Industry Input Component
interface IndustryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  isModal?: boolean;
}

const IndustryAutocomplete: React.FC<IndustryAutocompleteProps> = ({
  value,
  onChange,
  onBlur,
  isModal = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(INDUSTRY_OPTIONS);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const filtered = INDUSTRY_OPTIONS.filter(option =>
        option.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(INDUSTRY_OPTIONS);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    setIsOpen(true);
  };

  const handleOptionClick = (option: string) => {
    onChange(option);
    setIsOpen(false);
    // Don't blur immediately to avoid conflicts with the blur handler
    setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Delay blur to allow option click, but don't call onBlur if dropdown was just closed
    setTimeout(() => {
      if (!isOpen) {
        onBlur();
      }
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const inputClassName = isModal 
    ? "w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-200 text-gray-900 placeholder:text-gray-500 transition-colors [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:text-gray-900 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white]"
    : "flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-white placeholder:text-white/60 ring-offset-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 focus-visible:bg-black/8 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)] focus-visible:shadow-[inset_0_3px_6px_rgba(0,0,0,0.3),inset_0_-1px_3px_rgba(255,255,255,0.15)] focus-visible:border-purple-500 [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:text-gray-900 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white]";

  return (
    <div className="relative" style={{ zIndex: 1 }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Example Industry"
        className={inputClassName}
        autoComplete="off"
      />
      
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-[9999] w-full mt-1 max-h-60 overflow-auto rounded-lg shadow-lg border ${
            isModal
              ? 'bg-white border-gray-200'
              : 'bg-white/95 backdrop-blur-xl border-gray-200'
          }`}
          style={{ position: 'absolute', top: '100%', left: 0 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionClick(option)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isModal
                    ? 'text-gray-900 hover:bg-gray-100'
                    : 'text-gray-900 hover:bg-gray-100'
                }`}
              >
                {option}
              </button>
            ))
          ) : (
            <div className={`px-4 py-2 text-sm ${
              isModal ? 'text-gray-500' : 'text-gray-500'
            }`}>
              No matches found. Press Enter to use "{value}" as custom industry.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CompanyProfileForm: React.FC<CompanyProfileFormProps> = ({
  onSuccess,
  onCancel,
  isModal = false,
  initialData,
  mode = 'create'
}) => {
  const { createCompany, updateCompany, loading: _loading, companies, maxCompanies } = useCompany();
  const [submitting, setSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      website: initialData?.website || '',
      industry: initialData?.industry || '',
    }
  });
  
  const industry = watch('industry');
  const [industryValue, setIndustryValue] = useState(industry || '');

  useEffect(() => {
    setIndustryValue(industry);
  }, [industry]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const apiData: CompanyFormData = {
        name: data.name,
        website: data.website,
        industry: data.industry,
      };

      if (mode === 'edit' && initialData?.id) {
        await updateCompany(initialData.id, apiData);
      } else {
        await createCompany(apiData);
      }
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 100);
      }
    } catch {
      // Error is handled in the context
    } finally {
      setSubmitting(false);
    }
  };

  const handleIndustryChange = (newValue: string) => {
    setIndustryValue(newValue);
    setValue('industry', newValue, { shouldValidate: true, shouldDirty: true });
  };
  
  const containerClass = isModal
    ? "company-profile-form bg-white w-full max-w-none rounded-lg shadow-xl relative"
    : "company-profile-form max-w-2xl mx-auto bg-black/5 backdrop-blur-xl rounded-2xl p-8";
  
  if (mode === 'create' && companies.length >= maxCompanies) {
    return (
      <div className={containerClass}>
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Limit Reached</h2>
          <p className="text-gray-600 mb-6">
            You can only create up to {maxCompanies} company profiles. Please delete an existing company to create a new one.
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Header */}
      {isModal && (
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add Company' : 'Edit Company Profile'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      )}

      {/* Form Content */}
      <div className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">Company Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                {...register('name')}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-200 [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:text-gray-900 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white]"
                placeholder="Enter company name"
                required
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website URL *
              </label>
              <input
                type="url"
                {...register('website')}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-200 [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:text-gray-900 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white]"
                placeholder="https://example.com"
                required
              />
              {errors.website && <p className="text-sm text-red-500 mt-1">{errors.website.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry *
              </label>
              <IndustryAutocomplete
                value={industryValue}
                onChange={handleIndustryChange}
                onBlur={() => {
                  if (industryValue !== industry) {
                    setValue('industry', industryValue, { shouldValidate: true });
                  }
                }}
                isModal={isModal}
              />
              {errors.industry && <p className="text-sm text-red-500 mt-1">{errors.industry.message}</p>}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white rounded-lg hover:from-[#6650e6] hover:to-[#8a47e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Loader className="w-4 h-4 animate-spin" />}
              {submitting ? 'Saving...' : mode === 'create' ? 'Create Company' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyProfileForm; 