/**
 * @file MultiStepCompanyForm.tsx
 * @description Simplified single-step form for creating a new company profile.
 * Now only collects essential information: company name, website, and industry.
 * Uses react-hook-form and zod for form management and validation.
 *
 * @dependencies
 * - react: The core React library.
 * - react-hook-form: For flexible and extensible forms with easy-to-use validation.
 * - @hookform/resolvers/zod: Zod resolver for React Hook Form.
 * - zod: For schema validation.
 * - lucide-react: Icon library for React.
 * - ../../contexts/CompanyContext: Provides company-related data and actions.
 * - ../../utils/urlNormalizer: Utility for URL validation.
 *
 * @exports
 * - MultiStepCompanyForm: React functional component for simplified company profile creation.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building, Globe as _Globe, Factory as _Factory, CheckCircle } from 'lucide-react';
import { InlineSpinner } from '../ui/InlineSpinner';
import { useCompany, CompanyFormData } from '../../contexts/CompanyContext';
import { flexibleUrlSchema } from '../../utils/urlNormalizer';

// Simplified validation schema - only required fields
const formSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: flexibleUrlSchema,
  industry: z.string().min(1, 'Industry is required'),
});

type FormData = z.infer<typeof formSchema>;

interface MultiStepCompanyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
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
  'Retail & E-commerce',
  'Software Development',
  'Telecommunications',
  'Transportation',
  'Travel & Leisure',
];

// Industry Autocomplete Component
const IndustryAutocomplete: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}> = ({ value, onChange, onBlur }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(INDUSTRY_OPTIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const filtered = INDUSTRY_OPTIONS.filter(option =>
      option.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredOptions(filtered);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
  };

  const handleOptionClick = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredOptions.length === 0) {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const inputClassName = "w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600/30 transition-all text-gray-900 placeholder:text-gray-500 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(255_255_255)] [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(17_24_39)!important]";

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder="Select or type your industry"
        className={inputClassName}
        autoComplete="off"
      />
      
      {isOpen && (
        <div
          className="absolute z-[9999] w-full mt-2 max-h-60 overflow-auto rounded-xl shadow-2xl border bg-white/95 backdrop-blur-xl border-gray-200"
          style={{ position: 'absolute', top: '100%', left: 0 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionClick(option)}
                className="w-full text-left px-4 py-3 text-sm transition-all text-gray-900 hover:bg-gray-50/80 first:rounded-t-xl last:rounded-b-xl"
              >
                {option}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 rounded-xl">
              No matches found. Press Enter to use "{value}" as custom industry.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MultiStepCompanyForm: React.FC<MultiStepCompanyFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const { createCompany } = useCompany();
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      website: '',
      industry: '',
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

      await createCompany(apiData);
      setIsSuccess(true);
      
      // Small delay before calling onSuccess
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
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

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Company Created!</h2>
        <p className="text-gray-600">Your company profile has been successfully created.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Building className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Company Profile</h2>
        <p className="text-gray-600">Tell us about your company to get started with AI visibility tracking</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Company Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <span className="w-1.5 h-1.5 bg-purple-600 rounded-full"></span>
            Company Name
          </label>
          <input
            type="text"
            {...register('name')}
            className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/30 transition-all text-gray-900 placeholder:text-gray-500 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(255_255_255)] [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(17_24_39)!important]"
            placeholder="Enter your company name"
            required
            autoFocus
          />
          {errors.name && <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.name.message}
          </p>}
        </div>

        {/* Website */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
            Website URL
          </label>
          <input
            type="text"
            {...register('website')}
            className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600/30 transition-all text-gray-900 placeholder:text-gray-500 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(255_255_255)] [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(17_24_39)!important]"
            placeholder="https://example.com"
            required
          />
          <p className="text-xs text-gray-500 mt-2">We'll use this to fetch your company logo and branding</p>
          {errors.website && <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.website.message}
          </p>}
        </div>

        {/* Industry */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
            Industry
          </label>
          <IndustryAutocomplete
            value={industryValue}
            onChange={handleIndustryChange}
            onBlur={() => {
              if (industryValue !== industry) {
                setValue('industry', industryValue, { shouldValidate: true });
              }
            }}
          />
          <p className="text-xs text-gray-500 mt-2">Helps us provide industry-specific insights and benchmarks</p>
          {errors.industry && <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.industry.message}
          </p>}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/20 transition-all font-medium shadow-lg disabled:shadow-none"
          >
            {submitting && <InlineSpinner size={16} />}
            {submitting ? 'Creating Company...' : 'Create Company'}
          </button>

          {/* Cancel Button */}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-50/50 transition-all rounded-xl font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MultiStepCompanyForm;