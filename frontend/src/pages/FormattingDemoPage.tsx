import React from 'react';
import FormattedResponseViewer from '../components/ui/FormattedResponseViewer';

const FormattingDemoPage: React.FC = () => {
  const examples = [
    {
      title: "JSON Array Example",
      text: `["In the Los Angeles area, top destinations include Rodeo Drive in Beverly Hills, The Grove in Los Angeles, Westfield Century City in Century City, and the Beverly Center.", "For Orange County, highly rated options are South Coast Plaza in Costa Mesa, and Fashion Island in Newport Beach.", "In the San Francisco Bay Area, explore Union Square in San Francisco, which features department stores like Macy's and Nordstrom, Westfield San Francisco Centre, and Stanford Shopping Center in Palo Alto."]`,
      description: "Gemini often returns JSON arrays of strings"
    },
    {
      title: "JSON Object Example",
      text: `{"answer": "Some of the top attire retailers in California include Nordstrom, known for its wide selection of brands and customer service; Macy's, a long-standing department store with diverse offerings; and fast-fashion favorites like Zara and H&M. For more casual wear, Old Navy and Target are popular choices."}`,
      description: "Common JSON wrapper format"
    },
    {
      title: "Markdown Bullet List Example",
      text: `For formal events, accessories should complement the sophisticated and elegant atmosphere. Typical accessories include:
- Jewelry: Classic pieces like pearl or diamond stud earrings, subtle bracelets, and delicate necklaces enhance formal attire without overpowering it.
- Watches: A sleek, dress-style watch adds refinement.
- Clutches or small handbags: Compact and elegant bags in materials like satin or leather suit formal settings.
- Ties and Bow Ties: Silk ties or bow ties in solid colors or understated patterns are standard for men.
- Cufflinks and Tie Clips: These small details elevate suits and tuxedos.
- Shoes: Polished leather dress shoes for men; heels or refined flats for women.
- Hair Accessories: Simple, stylish pieces such as jeweled pins or elegant combs.
- Pocket Squares: A tasteful pocket square can add a splash of color or texture to men's jackets.

Selecting accessories that are tasteful and understated generally best suits formal occasions, enhancing the wearer's outfit without drawing excessive attention.`,
      description: "Perplexity and other models often format with bullet lists"
    },
    {
      title: "Mixed Formatting Example",
      text: `**Nordstrom** stands out as a premier destination for fashion enthusiasts. Here's what makes it special:

- **Wide Selection**: From luxury brands to accessible fashion
- **Customer Service**: Personal shopping and styling services
- **Multiple Locations**: Available in major cities across California
- **Online Experience**: Seamless integration between in-store and online shopping

Whether you're looking for formal attire or casual wear, **Nordstrom** provides a comprehensive shopping experience.`,
      description: "Combination of bold text, bullet points, and brand mentions"
    },
    {
      title: "Numbered List Example",
      text: `To improve your brand visibility in AI responses, follow these steps:

1. Create authoritative, well-researched content
2. Use clear headings and structured formatting
3. Include relevant keywords naturally
4. Optimize for featured snippets
5. Build domain authority through quality backlinks

Tools like **Serplexity** can help you track your progress and measure the impact of these optimizations.`,
      description: "Numbered lists with brand highlighting"
    },
    {
      title: "Nordstrom Locations Debug Example",
      text: `**Nordstrom** locations in California:

• Los Angeles: Nordstrom Westfield Century City
• San Francisco: Nordstrom San Francisco Centre  
• Costa Mesa: Nordstrom South Coast Plaza
• San Diego: Nordstrom Fashion Valley
• Palo Alto: Nordstrom Stanford Shopping Center
• Sacramento: Nordstrom Downtown Commons

Visit any of these locations for the best shopping experience.`,
      description: "Debug test for potential double bullet issue"
    },
    {
      title: "User Reported Double Bullet Issue",
      text: `detection_methods:

method: Visual Inspection
details: Examine the quality of stitching, fabric, logos, and labels. Counterfeit items often have poor craftsmanship, misspelled words, or incorrect fonts.

method: Material Analysis
details: Authentic items use specific high-quality materials. Counterfeits may use cheaper, inferior fabrics or components.

method: Authentication Tags/Codes
details: Many brands use unique serial numbers, QR codes, RFID tags, or holographic stickers that can be scanned or verified through their official apps.`,
      description: "Exact example from user showing double bullet issue"
    },
    {
      title: "User Reported Numbered List Issue",
      text: `When discussing the authenticity of designer clothing, there are several key considerations:

Purchasing from Authorized Retailers The most reliable way to ensure authenticity is to buy directly from:
1. Official brand boutiques
2. Nordstrom  
3. Neiman Marcus
4. Saks Fifth Avenue
5. Official brand websites

Authentication Techniques
1. Check for high-quality stitching
2. Examine fabric and material quality
3. Verify serial numbers and authenticity cards
4. Compare with official brand specifications`,
      description: "Exact numbered list example from user showing formatting issues"
    }
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Enhanced Response Formatting Demo
        </h1>
        <p className="text-gray-600">
          Demonstrating production-grade formatting for AI model responses including JSON arrays, objects, bullet lists, and markdown.
        </p>
      </div>

      <div className="space-y-8">
        {examples.map((example, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {example.title}
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {example.description}
              </p>
              
              {/* Raw input display */}
              <details className="mb-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Show raw input
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded border text-sm font-mono text-gray-700 whitespace-pre-wrap">
                  {example.text}
                </div>
              </details>
            </div>

            {/* Formatted output */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Formatted Output:
              </h3>
              <FormattedResponseViewer 
                text={example.text}
                className="shadow-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          Key Features
        </h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Automatically detects and formats JSON arrays and objects</li>
          <li>• Converts various bullet point formats to consistent markdown</li>
          <li>• Preserves paragraph structure and line breaks</li>
          <li>• Highlights brand names with purple styling</li>
          <li>• Supports markdown formatting (bold, lists, links)</li>
          <li>• Handles mixed content formats intelligently</li>
        </ul>
      </div>
    </div>
  );
};

export default FormattingDemoPage; 