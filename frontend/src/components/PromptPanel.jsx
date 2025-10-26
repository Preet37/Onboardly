import { useState } from 'react';
import { motion } from 'framer-motion';

const EXAMPLE_PROMPTS = [
  "Onboard SWE intern to Google Cloud Platform",
  "New customer success representative training",
  "Data analyst onboarding for analytics tools",
  "DevOps engineer AWS infrastructure training"
];

export default function PromptPanel({ onSubmit, loading, onInternInfoChange }) {
  const [prompt, setPrompt] = useState('');
  const [internName, setInternName] = useState('');
  const [internEmail, setInternEmail] = useState('');
  const [showExamples, setShowExamples] = useState(true);

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmit(prompt);
      setShowExamples(false);
      // Pass intern info to parent if callback exists
      if (onInternInfoChange && internName && internEmail) {
        onInternInfoChange({ name: internName, email: internEmail });
      }
    }
  };

  const handleExampleClick = (example) => {
    setPrompt(example);
    setShowExamples(false);
  };

  return (
    <div className="bg-secondary/30 border-b border-border p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Onboarding Workflow Generator
            </h2>
            <p className="text-sm text-muted-foreground">
              Describe your onboarding process and we'll generate a visual workflow
            </p>
          </div>

          {!showExamples && (
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              {showExamples ? 'Hide' : 'Show'} examples
            </button>
          )}
        </div>

        {/* Example Prompts */}
        {showExamples && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 gap-2"
          >
            {EXAMPLE_PROMPTS.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                disabled={loading}
                className="text-left text-xs px-3 py-2 bg-secondary border border-border rounded-md hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-muted-foreground mr-2">💡</span>
                {example}
              </button>
            ))}
          </motion.div>
        )}

        {/* Intern Information Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Intern Name
            </label>
            <input
              type="text"
              value={internName}
              onChange={(e) => setInternName(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Email Address
            </label>
            <input
              type="email"
              value={internEmail}
              onChange={(e) => setInternEmail(e.target.value)}
              placeholder="e.g., john.smith@company.com"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              disabled={loading}
            />
          </div>
        </div>

        {/* Prompt Input */}
        <div className="relative">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Onboarding Workflow Description
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            placeholder="e.g., Onboard a new software engineering intern to our Google Cloud Platform infrastructure..."
            className="w-full h-32 px-4 py-3 bg-background border border-border rounded-lg text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            disabled={loading}
          />

          {/* Character count */}
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
            {prompt.length} characters
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px]">
              Cmd/Ctrl + Enter
            </kbd>
            <span className="ml-2">to generate</span>
          </div>

          <div className="flex gap-2">
            {(prompt || internName || internEmail) && !loading && (
              <button
                onClick={() => {
                  setPrompt('');
                  setInternName('');
                  setInternEmail('');
                  setShowExamples(true);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
              >
                Clear All
              </button>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              className="px-6 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  Generate Workflow
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}