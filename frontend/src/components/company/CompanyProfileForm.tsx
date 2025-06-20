import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building, Globe, Factory, Users, Loader, ChevronDown } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCompany, CompanyFormData } from '../../contexts/CompanyContext';

// Form validation schema
const companyFormSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Please enter a valid website URL').optional(),
  industry: z.string().min(1, 'Industry is required'),
  competitors: z.array(z.string().min(1, 'Competitor name is required'))
    .length(3, 'All 3 competitor names are required'),
});

type FormData = z.infer<typeof companyFormSchema>;

interface CompanyProfileFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
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

const CompanyProfileForm: React.FC<CompanyProfileFormProps> = ({
  onSuccess,
  onCancel,
  isModal = false
}) => {
  const { createCompany, loading, error } = useCompany();
  const [competitors, setCompetitors] = useState<string[]>(['', '', '']);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      website: '',
      industry: '',
      competitors: ['', '', ''],
    },
  });

  // Update competitor value
  const updateCompetitor = (index: number, value: string) => {
    const newCompetitors = [...competitors];
    newCompetitors[index] = value;
    setCompetitors(newCompetitors);
    setValue('competitors', newCompetitors);
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    try {
      setSubmitting(true);
      
      // All competitors are now required, so we use them all
      const companyData: CompanyFormData = {
        name: data.name,
        website: data.website || undefined,
        industry: data.industry,
        competitors: data.competitors,
      };

      await createCompany(companyData);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error creating company:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formContainerClass = isModal 
    ? "bg-white p-4 rounded-lg max-w-2xl w-full mx-4" 
    : "max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6";

  return (
    <div className={formContainerClass}>
      <div className="mb-4 text-center">
        <h2 className="text-xl font-bold text-gray-900">Create Company Profile</h2>
        <p className="text-sm text-gray-600">
          Set up your company profile to start tracking your AI visibility
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Company Name */}
        <div>
          <label htmlFor="name" className="flex items-center text-sm font-medium text-gray-700 mb-1">
            <Building className="w-4 h-4 mr-2" />
            Company Name
          </label>
          <Input
            id="name"
            type="text"
            placeholder="e.g. Example Corporation"
            {...register('name')}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="flex items-center text-sm font-medium text-gray-700 mb-1">
            <Globe className="w-4 h-4 mr-2" />
            Website (Optional)
          </label>
          <Input
            id="website"
            type="url"
            placeholder="https://example.com"
            {...register('website')}
          />
          {errors.website && (
            <p className="mt-1 text-sm text-red-600">{errors.website.message}</p>
          )}
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="industry" className="flex items-center text-sm font-medium text-gray-700 mb-1">
            <Factory className="w-4 h-4 mr-2" />
            Industry
          </label>
          <div className="relative">
            <select
              id="industry"
              {...register('industry')}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">Select an industry</option>
              {INDUSTRY_OPTIONS.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {errors.industry && (
            <p className="mt-1 text-sm text-red-600">{errors.industry.message}</p>
          )}
        </div>

        {/* Competitors */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
            <Users className="w-4 h-4 mr-2" />
            Competitors
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Add 3 competitor companies to track your relative performance (all required)
          </p>
          
          <div className="space-y-2">
            {competitors.map((competitor, index) => (
              <div key={index}>
                <Input
                  type="text"
                  placeholder={`Company Name # ${index + 1}`}
                  value={competitor}
                  onChange={(e) => updateCompetitor(index, e.target.value)}
                />
                {errors.competitors?.[index] && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.competitors[index]?.message}
                  </p>
                )}
              </div>
            ))}
          </div>

          {errors.competitors && (
            <p className="mt-1 text-sm text-red-600">{errors.competitors.message}</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-2">
          {onCancel && (
            <Button
              type="button"
              onClick={onCancel}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting || loading}
            className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Company Profile'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CompanyProfileForm; 