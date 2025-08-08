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
import { CheckCircle } from 'lucide-react';
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

  const inputClassName = "flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-black placeholder:text-gray-500 ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)]";

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
        style={{
          WebkitTapHighlightColor: "transparent",
          WebkitUserSelect: "none",
          userSelect: "none",
          outline: "none",
          border: "none",
          color: "#000000 !important",
          WebkitTextFillColor: "#000000 !important",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(255,255,255,0.1)"
        }}
      />
      
      {isOpen && (
        <div
          className="absolute z-[9999] w-full mt-2 max-h-60 overflow-auto rounded-lg shadow-lg border bg-white border-gray-200"
          style={{ position: 'absolute', top: '100%', left: 0 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionClick(option)}
                className="w-full text-left px-4 py-3 text-sm transition-all text-black hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
              >
                {option}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 rounded-lg">
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
  const { createCompany, error } = useCompany();
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
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-black">Create Your Company Profile</h2>
        <p className="text-gray-600 mt-1">Setup a new company profile to track your brand's visibility across AI search engines.</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {/* Company Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-black mb-1"
          >
            Company Name
          </label>
          <input
            id="name"
            type="text"
            {...register('name')}
            className="flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-black placeholder:text-gray-500 ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)]"
            placeholder="Enter your company name"
            required
            autoFocus
            style={{
              WebkitTapHighlightColor: "transparent",
              WebkitUserSelect: "none",
              userSelect: "none",
              outline: "none",
              border: "none",
              color: "#000000 !important",
              WebkitTextFillColor: "#000000 !important",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(255,255,255,0.1)"
            }}
          />
          {errors.name && (
            <p className="mt-2 text-sm text-red-600">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Website */}
        <div>
          <label
            htmlFor="website"
            className="block text-sm font-medium text-black mb-1"
          >
            Website URL
          </label>
          <input
            id="website"
            type="text"
            {...register('website')}
            className="flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-black placeholder:text-gray-500 ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 select-none touch-manipulation shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)]"
            placeholder="https://example.com"
            required
            style={{
              WebkitTapHighlightColor: "transparent",
              WebkitUserSelect: "none",
              userSelect: "none",
              outline: "none",
              border: "none",
              color: "#000000 !important",
              WebkitTextFillColor: "#000000 !important",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(255,255,255,0.1)"
            }}
          />
          {errors.website && (
            <p className="mt-2 text-sm text-red-600">
              {errors.website.message}
            </p>
          )}
        </div>

        {/* Industry */}
        <div>
          <label
            htmlFor="industry"
            className="block text-sm font-medium text-black mb-1"
          >
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
          {errors.industry && (
            <p className="mt-2 text-sm text-red-600">
              {errors.industry.message}
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex h-11 items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <InlineSpinner size={16} />}
          {submitting ? '' : 'Create Company'}
        </button>

        {/* Cancel Button */}
        {onCancel && (
          <p className="text-sm text-center text-gray-600">
            <button
              type="button"
              onClick={onCancel}
              className="font-medium text-black hover:text-gray-700"
            >
              Cancel
            </button>
          </p>
        )}
      </form>
    </div>
  );
};

export default MultiStepCompanyForm;