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
import { Building, Globe, Factory, Loader, CheckCircle } from 'lucide-react';
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

  const inputClassName = "w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-200 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:hover]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:focus]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:active]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:active]:[-webkit-text-fill-color:rgb(17_24_39)!important]";

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
          className="absolute z-[9999] w-full mt-1 max-h-60 overflow-auto rounded-lg shadow-lg border bg-white/95 backdrop-blur-xl border-gray-200"
          style={{ position: 'absolute', top: '100%', left: 0 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionClick(option)}
                className="w-full text-left px-4 py-2 text-sm transition-colors text-gray-900 hover:bg-gray-100"
              >
                {option}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">
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
    <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Company Profile</h2>
        <p className="text-gray-600">Tell us about your company to get started</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Company Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Building className="w-4 h-4" />
            Company Name *
          </label>
          <input
            type="text"
            {...register('name')}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-200 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:hover]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:focus]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:active]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:active]:[-webkit-text-fill-color:rgb(17_24_39)!important]"
            placeholder="Enter your company name"
            required
          />
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        {/* Website */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Globe className="w-4 h-4" />
            Website URL *
          </label>
          <input
            type="url"
            {...register('website')}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-200 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:hover]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:focus]:[-webkit-text-fill-color:rgb(17_24_39)!important] [&:-webkit-autofill:active]:shadow-[inset_0_0_0_1000px_rgb(239_246_255)] [&:-webkit-autofill:active]:[-webkit-text-fill-color:rgb(17_24_39)!important]"
            placeholder="https://example.com"
            required
          />
          {errors.website && <p className="text-sm text-red-500 mt-1">{errors.website.message}</p>}
        </div>

        {/* Industry */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Factory className="w-4 h-4" />
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
          />
          {errors.industry && <p className="text-sm text-red-500 mt-1">{errors.industry.message}</p>}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white rounded-lg hover:from-[#6650e6] hover:to-[#8a47e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting && <Loader className="w-4 h-4 animate-spin" />}
          {submitting ? 'Creating Company...' : 'Create Company'}
        </button>

        {/* Cancel Button */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
};

export default MultiStepCompanyForm;