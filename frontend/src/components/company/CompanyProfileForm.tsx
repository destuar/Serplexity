import React, { useState, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building, Globe, Factory, Users, Loader, Plus, X, HelpCircle, ShoppingBag } from 'lucide-react';
import { FormInput } from '../ui/FormInput';
import { Button } from '../ui/Button';
import { useCompany, CompanyFormData, Company } from '../../contexts/CompanyContext';
import { Product, Competitor, BenchmarkingQuestion } from '../../types/schemas';

// Form validation schema
const companyFormSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Please enter a valid website URL'),
  industry: z.string().min(1, 'Industry is required'),
  products: z.array(z.object({
    name: z.string().min(1, 'Product name is required'),
  })).min(1, 'At least one product is required').max(5, 'You can add up to 5 products'),
  competitors: z.array(z.object({
    name: z.string().min(1, 'Competitor name is required'),
    website: z.string().url('Please enter a valid website URL'),
  })).min(1, 'At least one competitor is required'),
  benchmarkingQuestions: z.array(z.object({
    text: z.string().min(1, 'Question is required'),
  })).min(1, 'At least one benchmarking question is required').max(5, 'You can add up to 5 questions'),
});

type FormData = z.infer<typeof companyFormSchema>;

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
    ? "flex h-11 w-full rounded-lg bg-gray-50 border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
    : "flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-white placeholder:text-white/60 ring-offset-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 focus-visible:bg-black/8 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)] focus-visible:shadow-[inset_0_3px_6px_rgba(0,0,0,0.3),inset_0_-1px_3px_rgba(255,255,255,0.15)]";

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
  const { createCompany, updateCompany, loading, companies, maxCompanies } = useCompany();
  const [submitting, setSubmitting] = useState(false);
  
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      website: initialData?.website || '',
      industry: initialData?.industry || '',
      products: (() => {
        const userProducts = (initialData?.products || []).filter((p: Product) => !p.isGenerated);
        return userProducts.length > 0 ? userProducts.map((p) => ({ name: p.name })) : [{ name: '' }];
      })(),
      competitors: (() => {
        const userCompetitors = (initialData?.competitors || []).filter((c: Competitor) => !c.isGenerated);
        return userCompetitors.length > 0 ? userCompetitors.map((c) => ({ name: c.name, website: c.website || '' })) : [{ name: '', website: '' }];
      })(),
      benchmarkingQuestions: (() => {
        const userQuestions = (initialData?.benchmarkingQuestions || []).filter((q: BenchmarkingQuestion) => !q.isGenerated);
        return userQuestions.length > 0 ? userQuestions.map((q) => ({ text: q.text })) : [{ text: '' }];
      })(),
    },
  });
  
  const industry = watch('industry');
  const [industryValue, setIndustryValue] = useState(industry || '');

  useEffect(() => {
    setIndustryValue(industry);
  }, [industry]);
  
  const { 
    fields: productFields, 
    append: appendProduct, 
    remove: removeProduct 
  } = useFieldArray({
    control,
    name: "products",
  });

  const { 
    fields: competitorFields, 
    append: appendCompetitor, 
    remove: removeCompetitor 
  } = useFieldArray({
    control,
    name: "competitors",
  });

  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion
  } = useFieldArray({
    control,
    name: 'benchmarkingQuestions',
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    
    // Transform form data to match API expectation
    const apiData: CompanyFormData = {
      ...data,
      products: data.products.map(p => p.name),
      benchmarkingQuestions: data.benchmarkingQuestions.map(q => q.text),
    };

    try {
      if (mode === 'edit' && initialData?.id) {
        // The update payload is partial, so we can send the transformed data
        await updateCompany(initialData.id, apiData);
      } else {
        await createCompany(apiData);
      }
      
      // Small delay to ensure context state is updated before navigation
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
  
  const handleCancel = () => {
    if(onCancel) onCancel();
  };
  
  const canSubmit = isDirty || (mode === 'create');
  
  const formTitle = mode === 'create' ? 'Create Your Company Profile' : 'Edit Company Profile';
  const formSubtitle = mode === 'create'
    ? 'Start by telling us about your company.'
    : `You are editing the profile for ${initialData?.name}.`;
    
  const containerClass = isModal
    ? "bg-white w-full"
    : "max-w-2xl mx-auto bg-black/5 backdrop-blur-xl rounded-2xl p-8";
  
  const labelClass = isModal ? 'text-gray-700' : 'text-white/80';
  
  if (mode === 'create' && companies.length >= maxCompanies) {
    return (
      <div className={containerClass}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Maximum Company Limit Reached</h2>
          <p className={labelClass}>
            You can only create up to {maxCompanies} company profiles. Please delete an existing company to create a new one.
          </p>
          {onCancel && (
            <Button onClick={onCancel} className="mt-6">
              Go Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
       {isModal && onCancel && (
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </Button>
        </div>
      )}
      <div className="text-center mb-8">
        <h2 className={`text-3xl font-bold ${isModal ? 'text-gray-900' : 'text-white'}`}>{formTitle}</h2>
        <p className={`mt-2 text-md ${isModal ? 'text-gray-600' : 'text-white/60'}`}>{formSubtitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Single Column Layout */}
        <div className="space-y-6">
          {/* Company Details */}
          <div className={`space-y-4 rounded-lg p-6 ${isModal ? 'bg-gray-50 border' : 'bg-white/5'}`}>
            <FormInput<FormData>
              id="name"
              label="Company Name"
              register={register}
              error={errors.name}
              placeholder="e.g. Company Name"
              Icon={Building}
              isModal={isModal}
            />
            <FormInput<FormData>
              id="website"
              label="Company Website"
              register={register}
              error={errors.website}
              placeholder="https://www.companyname.com"
              Icon={Globe}
              isModal={isModal}
            />
            <div className="space-y-2">
              <label htmlFor="industry" className={`flex items-center gap-2 text-sm font-medium ${labelClass}`}>
                <Factory size={16} />
                Industry
              </label>
                              <IndustryAutocomplete
                  value={industryValue}
                  onChange={handleIndustryChange}
                  onBlur={() => {
                    // Only set the value if it's different to avoid unnecessary re-renders
                    if (industryValue !== industry) {
                      setValue('industry', industryValue, { shouldValidate: true });
                    }
                  }}
                  isModal={isModal}
                />
              {errors.industry && <p className="text-sm text-red-500 mt-1">{errors.industry.message}</p>}
            </div>
          </div>

          {/* Products Section */}
          <div className={`space-y-4 rounded-lg p-6 ${isModal ? 'bg-gray-50 border' : 'bg-white/5'}`}>
            <h3 className={`text-xl font-semibold flex items-center gap-3 ${isModal ? 'text-gray-800' : 'text-white/90'}`}>
              <ShoppingBag size={22} />
              Your Products or Services
            </h3>
            {productFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <div className="flex-grow">
                  <FormInput<FormData>
                    id={`products.${index}.name`}
                    register={register}
                    error={errors.products?.[index]?.name}
                    placeholder={`Product or Service #${index + 1}`}
                    hideLabel
                    isModal={isModal}
                  />
                </div>
                                  {productFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProduct(index)}
                      className={isModal ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-600' : 'text-white/60 hover:bg-white/10 hover:text-white/80'}
                    >
                      <X size={18} />
                    </Button>
                  )}
              </div>
            ))}
                          {productFields.length < 5 && (
                <Button
                  type="button"
                  onClick={() => appendProduct({ name: '' })}
                  className={`w-full ${isModal ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  <Plus size={16} className="mr-2" /> Add Product
                </Button>
              )}
            {errors.products && <p className="text-sm text-red-500 mt-1">{errors.products.message || errors.products.root?.message}</p>}
          </div>

          {/* Competitors Section */}
          <div className={`space-y-4 rounded-lg p-6 ${isModal ? 'bg-gray-50 border' : 'bg-white/5'}`}>
            <h3 className={`text-xl font-semibold flex items-center gap-3 ${isModal ? 'text-gray-800' : 'text-white/90'}`}>
              <Users size={22} />
              Your Competitors
            </h3>
            {competitorFields.map((field, index) => (
              <div key={field.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-grow space-y-2">
                    <FormInput<FormData>
                      id={`competitors.${index}.name`}
                      register={register}
                      error={errors.competitors?.[index]?.name}
                      placeholder={`Competitor Name #${index + 1}`}
                      hideLabel
                      isModal={isModal}
                    />
                    <FormInput<FormData>
                      id={`competitors.${index}.website`}
                      register={register}
                      error={errors.competitors?.[index]?.website}
                      placeholder={`https://www.companyname.com`}
                      hideLabel
                      isModal={isModal}
                    />
                  </div>
                                     {competitorFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCompetitor(index)}
                        className={isModal ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-600' : 'text-white/60 hover:bg-white/10 hover:text-white/80'}
                      >
                        <X size={18} />
                      </Button>
                    )}
                </div>
              </div>
            ))}
                         {competitorFields.length < 10 && (
                <Button
                  type="button"
                  onClick={() => appendCompetitor({ name: '', website: '' })}
                  className={`w-full ${isModal ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  <Plus size={16} className="mr-2" /> Add Competitor
                </Button>
              )}
            {errors.competitors && <p className="text-sm text-red-500 mt-1">{errors.competitors.message || errors.competitors.root?.message}</p>}
          </div>

          {/* Benchmarking Questions Section */}
          <div className={`space-y-4 rounded-lg p-6 ${isModal ? 'bg-gray-50 border' : 'bg-white/5'}`}>
             <h3 className={`text-xl font-semibold flex items-center gap-3 ${isModal ? 'text-gray-800' : 'text-white/90'}`}>
              <HelpCircle size={22} />
              Benchmarking Questions
            </h3>
            {questionFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <div className="flex-grow">
                  <FormInput<FormData>
                    id={`benchmarkingQuestions.${index}.text`}
                    register={register}
                    error={errors.benchmarkingQuestions?.[index]?.text}
                    placeholder={`e.g., "Which company is best for..."`}
                    hideLabel
                    isModal={isModal}
                  />
                </div>
                                 {questionFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(index)}
                      className={isModal ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-600' : 'text-white/60 hover:bg-white/10 hover:text-white/80'}
                    >
                      <X size={18} />
                    </Button>
                  )}
              </div>
            ))}
                         {questionFields.length < 5 && (
                <Button
                  type="button"
                  onClick={() => appendQuestion({ text: '' })}
                  className={`w-full ${isModal ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  <Plus size={16} className="mr-2" /> Add Question
                </Button>
              )}
            {errors.benchmarkingQuestions && <p className="text-sm text-red-500 mt-1">{errors.benchmarkingQuestions.message || errors.benchmarkingQuestions.root?.message}</p>}
          </div>
        </div>
        
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-4 pt-4">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={handleCancel} className={isModal ? 'w-full sm:w-auto text-gray-700 hover:bg-gray-100' : 'text-white/80 hover:bg-white/10 w-full sm:w-auto'}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting || loading || !canSubmit}
            className={`w-full sm:w-auto ${isModal 
              ? 'bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6]' 
              : 'bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6]'}`}
          >
            {submitting || loading ? (
              <>
                <Loader className="animate-spin mr-2" size={20} />
                {mode === 'create' ? 'Creating...' : 'Saving...'}
              </>
            ) : (
              mode === 'create' ? 'Create Company Profile' : 'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CompanyProfileForm; 