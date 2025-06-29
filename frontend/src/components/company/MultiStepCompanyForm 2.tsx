import React, { useState, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building, Globe, Factory, Users, Loader, Plus, X, HelpCircle, ShoppingBag, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { FormInput } from '../ui/FormInput';
import { Button } from '../ui/Button';
import { useCompany, CompanyFormData } from '../../contexts/CompanyContext';

// Step-specific validation schemas
const step1Schema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Please enter a valid website URL'),
  industry: z.string().min(1, 'Industry is required'),
});

const step2Schema = z.object({
  products: z.array(z.object({
    name: z.string().min(1, 'Product name is required'),
  })).min(1, 'At least one product/service is required').max(5, 'You can add up to 5 products/services'),
});

const step3Schema = z.object({
  competitors: z.array(z.object({
    name: z.string().min(1, 'Competitor name is required'),
    website: z.string().url('Please enter a valid website URL'),
  })).min(1, 'At least one competitor is required'),
});

const step4Schema = z.object({
  benchmarkingQuestions: z.array(z.object({
    text: z.string().min(1, 'Question is required'),
  })).min(1, 'At least one benchmarking question is required').max(5, 'You can add up to 5 questions'),
});

// Complete form schema
const completeFormSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema);

type FormData = z.infer<typeof completeFormSchema>;

interface MultiStepCompanyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Industry options
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

// Industry Autocomplete Component
interface IndustryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

const IndustryAutocomplete: React.FC<IndustryAutocompleteProps> = ({
  value,
  onChange,
  onBlur,
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
    setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
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
        placeholder="e.g. Software Technology"
        className="flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-white placeholder:text-white/60 ring-offset-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 focus-visible:bg-black/8 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)] focus-visible:shadow-[inset_0_3px_6px_rgba(0,0,0,0.3),inset_0_-1px_3px_rgba(255,255,255,0.15)]"
        autoComplete="off"
      />
      
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 max-h-60 overflow-auto rounded-lg shadow-lg border bg-white/95 backdrop-blur-xl border-gray-200"
          style={{ position: 'absolute', top: '100%', left: 0 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionClick(option)}
                className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 transition-colors"
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

// Step progress indicator
const StepIndicator: React.FC<{ currentStep: number; completedSteps: number[] }> = ({
  currentStep,
  completedSteps
}) => {
  const steps = [
    { number: 1, title: "Company Details", description: "Basic information" },
    { number: 2, title: "Products", description: "What you offer" },
    { number: 3, title: "Competitors", description: "Market analysis" },
    { number: 4, title: "Benchmarking", description: "Key questions" },
  ];

  const progress = completedSteps.length > 0 ? (completedSteps.length / (steps.length - 1)) * 100 : 0;

  return (
    <div className="mb-12 w-full">
      <div className="relative">
        {/* Padded container for the lines */}
        <div className="absolute top-5 left-16 right-16" style={{ transform: 'translateY(-50%)' }}>
          {/* Background line */}
          <div className="w-full h-0.5 bg-white/20" />
          
          {/* Progress line */}
          <div 
            className="absolute top-0 left-0 h-0.5 bg-green-500 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="relative flex justify-between items-start">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center w-32">
              <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200 ${
                completedSteps.includes(step.number)
                  ? 'bg-green-500 border-green-500 text-white'
                  : currentStep === step.number
                  ? 'bg-[#7762ff] border-[#7762ff] text-white'
                  : 'bg-[#1e1b4b] border-white/30 text-white/60'
              }`}>
                {completedSteps.includes(step.number) ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-sm font-semibold">{step.number}</span>
                )}
              </div>
              <div className="mt-3">
                <div className={`text-sm font-medium ${
                  currentStep === step.number ? 'text-white' : 'text-white/60'
                }`}>
                  {step.title}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MultiStepCompanyForm: React.FC<MultiStepCompanyFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { createCompany, loading } = useCompany();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(completeFormSchema),
    defaultValues: {
      name: '',
      website: '',
      industry: '',
      products: [{ name: '' }],
      competitors: [{ name: '', website: '' }],
      benchmarkingQuestions: [{ text: '' }],
    },
    mode: 'onChange',
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

  const handleIndustryChange = (newValue: string) => {
    setIndustryValue(newValue);
    setValue('industry', newValue, { shouldValidate: true });
  };

  const validateStep = async (step: number): Promise<boolean> => {
    let isValid = false;
    
    switch (step) {
      case 1:
        isValid = await trigger(['name', 'website', 'industry']);
        break;
      case 2:
        isValid = await trigger(['products']);
        break;
      case 3:
        isValid = await trigger(['competitors']);
        break;
      case 4:
        isValid = await trigger(['benchmarkingQuestions']);
        break;
    }
    
    return isValid;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    
    if (isValid) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    
    // Transform form data to match API expectation
    const apiData: CompanyFormData = {
      ...data,
      products: data.products.map(p => p.name),
      benchmarkingQuestions: data.benchmarkingQuestions.map(q => q.text),
    };

    try {
      await createCompany(apiData);
      
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

  const handleFinalSubmit = async () => {
    const isValid = await validateStep(4);
    if (isValid) {
      const formData = getValues();
      await onSubmit(formData);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Company Details</h2>
              <p className="text-white/60">Let's start with your basic company information</p>
            </div>
            <div className="space-y-4 rounded-lg p-6 bg-white/5">
              <FormInput<FormData>
                id="name"
                label="Company Name"
                register={register}
                error={errors.name}
                placeholder="e.g. Acme Corporation"
                Icon={Building}
              />
              <FormInput<FormData>
                id="website"
                label="Company Website"
                register={register}
                error={errors.website}
                placeholder="https://www.acme.com"
                Icon={Globe}
              />
              <div className="space-y-2">
                <label htmlFor="industry" className="flex items-center gap-2 text-sm font-medium text-white/80">
                  <Factory size={16} />
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
                {errors.industry && <p className="text-sm text-red-500 mt-1">{errors.industry.message}</p>}
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <Button
                type="button"
                onClick={handleNext}
                className="bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6] w-48 justify-center"
              >
                Next Step
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Products & Services</h2>
              <p className="text-white/60">Add up to 5 product or service keywords that your brand offers. Visibility questions are generated based on your industry and these keywords.</p>
            </div>
            <div className="space-y-4 rounded-lg p-6 bg-white/5">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-white/90">
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
                    />
                  </div>
                  {productFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProduct(index)}
                      className="text-white/60 hover:bg-white/10 hover:text-white/80"
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
                  className="w-full bg-white/10 text-white hover:bg-white/20"
                >
                  <Plus size={16} className="mr-2" /> Add Product or Service
                </Button>
              )}
              {errors.products && <p className="text-sm text-red-500 mt-1">{errors.products.message || errors.products.root?.message}</p>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Competitor Analysis</h2>
              <p className="text-white/60">Add competitor names and websites for competitor analysis. We identify all mentioned competitors, but these guarantee these companies will also be benchmarked.</p>
            </div>
            <div className="space-y-4 rounded-lg p-6 bg-white/5">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-white/90">
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
                      />
                      <FormInput<FormData>
                        id={`competitors.${index}.website`}
                        register={register}
                        error={errors.competitors?.[index]?.website}
                        placeholder="https://www.competitor.com"
                        hideLabel
                      />
                    </div>
                    {competitorFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCompetitor(index)}
                        className="text-white/60 hover:bg-white/10 hover:text-white/80"
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
                  className="w-full bg-white/10 text-white hover:bg-white/20"
                >
                  <Plus size={16} className="mr-2" /> Add Competitor
                </Button>
              )}
              {errors.competitors && <p className="text-sm text-red-500 mt-1">{errors.competitors.message || errors.competitors.root?.message}</p>}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Benchmarking Questions</h2>
              <p className="text-white/60">Add up to 5 benchmarking questions that you want to rank for that your customer market is searching.</p>
            </div>
            <div className="space-y-4 rounded-lg p-6 bg-white/5">
              <h3 className="text-xl font-semibold flex items-center gap-3 text-white/90">
                <HelpCircle size={22} />
                Key Questions Your Customers Ask
              </h3>
              {questionFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <div className="flex-grow">
                    <FormInput<FormData>
                      id={`benchmarkingQuestions.${index}.text`}
                      register={register}
                      error={errors.benchmarkingQuestions?.[index]?.text}
                      placeholder={`e.g., "Which company offers the best..."`}
                      hideLabel
                    />
                  </div>
                  {questionFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(index)}
                      className="text-white/60 hover:bg-white/10 hover:text-white/80"
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
                  className="w-full bg-white/10 text-white hover:bg-white/20"
                >
                  <Plus size={16} className="mr-2" /> Add Question
                </Button>
              )}
              {errors.benchmarkingQuestions && <p className="text-sm text-red-500 mt-1">{errors.benchmarkingQuestions.message || errors.benchmarkingQuestions.root?.message}</p>}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-black/5 backdrop-blur-xl rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]">
      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />
      
      <form onSubmit={handleSubmit(onSubmit)}>
        {renderStep()}
        
        <div className="flex items-center justify-center gap-4 pt-8 mt-8">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={handlePrev}
              className="text-white/80 hover:bg-white/10"
            >
              <ArrowLeft size={16} className="mr-2" />
              Previous
            </Button>
          )}
          
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} className="text-white/80 hover:bg-white/10">
              Cancel
            </Button>
          )}
          
          {currentStep > 1 && currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6] w-48 justify-center"
            >
              Next Step
              <ArrowRight size={16} className="ml-2" />
            </Button>
          ) : null}
          
          {currentStep === 4 && (
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting || loading}
              className="bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6] w-56 justify-center"
            >
              {submitting || loading ? (
                <>
                  <Loader className="animate-spin mr-2" size={20} />
                  Creating Profile...
                </>
              ) : (
                'Create Company Profile'
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MultiStepCompanyForm; 