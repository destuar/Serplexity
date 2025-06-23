import React from 'react';
import { UseFormRegister, FieldError, FieldValues, Path } from 'react-hook-form';
import { LucideIcon } from 'lucide-react';

interface FormInputProps<T extends FieldValues> extends React.InputHTMLAttributes<HTMLInputElement> {
  id: Path<T>;
  register: UseFormRegister<T>;
  error?: FieldError;
  label?: string;
  hideLabel?: boolean;
  Icon?: LucideIcon;
  isModal?: boolean;
}

const FormInput = <T extends FieldValues>({
  id,
  register,
  error,
  label,
  hideLabel = false,
  Icon,
  isModal = false,
  ...props
}: FormInputProps<T>) => {
  const inputClassName = isModal
    ? "flex h-11 w-full rounded-lg bg-gray-50 border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7762ff] focus:border-[#7762ff] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
    : "flex h-11 w-full rounded-lg bg-black/5 backdrop-blur-sm px-4 py-3 text-sm text-white placeholder:text-white/60 ring-offset-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 focus-visible:bg-black/8 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.1)] focus-visible:shadow-[inset_0_3px_6px_rgba(0,0,0,0.3),inset_0_-1px_3px_rgba(255,255,255,0.15)]";

  const labelClass = `flex items-center gap-2 text-sm font-medium ${isModal ? 'text-gray-700' : 'text-white/80'}`;

  return (
    <div className="space-y-2">
      {!hideLabel && label && (
        <label htmlFor={id} className={labelClass}>
          {Icon && <Icon size={16} />}
          {label}
        </label>
      )}
      <input
        id={id}
        {...register(id)}
        {...props}
        className={inputClassName}
      />
      {error && <p className="text-sm text-red-500 mt-1">{error.message}</p>}
    </div>
  );
};

export { FormInput }; 