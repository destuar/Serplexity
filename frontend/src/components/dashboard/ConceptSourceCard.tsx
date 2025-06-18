import React from "react";
import Card from "../ui/Card";

interface Concept {
  name: string;
  text: string;
  sentiment: "Positive" | "Neutral" | "Negative";
}

const concepts: Concept[] = [
  {
    name: "Quality",
    text: "...it offers best-in-class...",
    sentiment: "Positive",
  },
  {
    name: "Comfort",
    text: "...not the highest standard...",
    sentiment: "Positive",
  },
  { name: "Price", text: "...considered as quite cheap...", sentiment: "Neutral" },
  {
    name: "Features",
    text: "...positioned as a reliable...",
    sentiment: "Positive",
  },
];

const ConceptSourceCard = () => {
  const getSentimentClass = (sentiment: Concept["sentiment"]) => {
    switch (sentiment) {
      case "Positive":
        return "bg-green-100 text-green-800";
      case "Neutral":
        return "bg-gray-100 text-gray-800";
      case "Negative":
        return "bg-red-100 text-red-800";
    }
  };

  return (
    <Card className="w-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">
        Concept Source
      </h2>
      <div className="flex-1 space-y-4 overflow-y-auto">
        {concepts.map((concept) => (
          <div key={concept.name} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center flex-1">
              <span className="font-semibold text-gray-800 w-20 text-sm">{concept.name}</span>
              <span className="text-gray-600 text-sm ml-4">{concept.text}</span>
            </div>
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full ml-4 ${getSentimentClass(
                concept.sentiment
              )}`}
            >
              {concept.sentiment}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ConceptSourceCard; 