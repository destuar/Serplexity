/**
 * @file Accordion.tsx
 * @description Collapsible accordion component that provides expandable/collapsible content sections.
 * Built using Radix UI primitives for accessibility and consistent behavior.
 *
 * @dependencies
 * - react: For component rendering.
 * - @radix-ui/react-accordion: For accordion functionality.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - Accordion: The main accordion component.
 * - AccordionItem: Individual accordion item component.
 * - AccordionTrigger: Trigger component for expanding/collapsing.
 * - AccordionContent: Content component for accordion items.
 */
import { ChevronDown } from "lucide-react";
import React, { ReactNode, useState } from "react";
import { cn } from "../../lib/utils";

interface AccordionItemProps {
  question: string;
  children: ReactNode;
  isOpen: boolean;
  onClick: () => void;
}

const AccordionItem: React.FC<AccordionItemProps> = ({
  question,
  children,
  isOpen,
  onClick,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-300">
      <button
        onClick={onClick}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
      >
        <span className="font-medium text-black text-lg">{question}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-gray-600 transition-transform duration-300 flex-shrink-0",
            { "transform rotate-180": isOpen }
          )}
        />
      </button>
      <div
        style={{
          maxHeight: isOpen ? "1000px" : "0px",
          transition: "max-height 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-6 pt-2 text-gray-600 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};

interface AccordionProps {
  items: {
    question: string;
    answer: ReactNode;
  }[];
}

export const Accordion: React.FC<AccordionProps> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleClick = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <AccordionItem
          key={index}
          question={item.question}
          isOpen={openIndex === index}
          onClick={() => handleClick(index)}
        >
          {item.answer}
        </AccordionItem>
      ))}
    </div>
  );
};
