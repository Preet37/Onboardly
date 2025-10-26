import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { executeOnboardingWithProgress } from './services/onboardingService';
import PromptPanel from './components/PromptPanel';
import NeuralCosmos from './components/NeuralCosmos';

// Automation process DAG (not the intern's tasks) - initial unlit state
const getInitialWorkflow = () => ({
  nodes: [
    {
      id: 'analyzing',
      name: 'AI Analyzing',
      type: 'access',
      description: 'AI analyzing company needs and use cases',
      status: 'pending'
    },
    {
      id: 'generating',
      name: 'Generating Tasks',
      type: 'hands-on',
      description: 'Creating personalized Jira onboarding tasks',
      status: 'pending'
    },
    {
      id: 'sending',
      name: 'Sending to Intern',
      type: 'learning',
      description: 'Sending welcome email with calendar invite',
      status: 'pending'
    },
    {
      id: 'opened',
      name: 'Intern Opening Training',
      type: 'learning',
      description: 'Intern has opened onboarding training materials',
      status: 'pending'
    },
    {
      id: 'onboarded',
      name: 'Not Yet Onboarded',
      type: 'review',
      description: 'Waiting to complete onboarding',
      status: 'pending'
    }
  ],
  edges: [
    { from: 'analyzing', to: 'generating', status: 'pending' },
    { from: 'generating', to: 'sending', status: 'pending' },
    { from: 'sending', to: 'opened', status: 'pending' },
    { from: 'opened', to: 'onboarded', status: 'pending' }
  ]
});

export default function OnboardingApp() {
  const [workflow, setWorkflow] = useState(getInitialWorkflow());
  const [error, setError] = useState(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [internInfo, setInternInfo] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('Fill in the form above to start onboarding');
  const [jiraUrl, setJiraUrl] = useState(null);

  const handleGenerateWorkflow = async (prompt) => {
    if (!internInfo) {
      alert('Please provide intern name and email first.');
      return;
    }

    setCurrentPrompt(prompt);
    setExecuting(true);
    setError(null);
    setJiraUrl(null);

    // Reset workflow to initial unlit state
    setWorkflow(getInitialWorkflow());
    setProgressMessage('Starting onboarding automation...');

    try {
      const result = await executeOnboardingWithProgress(prompt, internInfo, (progressData) => {
        const { step, status, message, jiraEpicUrl } = progressData;

        setProgressMessage(message || '');

        if (jiraEpicUrl) {
          setJiraUrl(jiraEpicUrl);
        }

        // Update workflow node status
        setWorkflow(prev => ({
          ...prev,
          nodes: prev.nodes.map(node => {
            if (node.id === step) {
              // Special case: when onboarded step completes, update the name
              if (step === 'onboarded' && status === 'completed') {
                return { ...node, name: 'Onboarded', status };
              }
              return { ...node, status };
            }
            return node;
          }),
          edges: prev.edges.map(edge => {
            if (edge.from === step && status === 'completed') {
              return { ...edge, status: 'completed' };
            }
            return edge;
          })
        }));
      });

      setProgressMessage(`✅ ${internInfo.name} has been successfully onboarded!`);

      if (result.jiraEpicUrl) {
        setJiraUrl(result.jiraEpicUrl);
      }
    } catch (err) {
      setError(err.message);
      setProgressMessage(`❌ Error: ${err.message}`);
      console.error('Onboarding execution failed:', err);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex flex-col">
      {/* Header with Prompt Panel */}
      <PromptPanel
        onSubmit={handleGenerateWorkflow}
        loading={executing}
        onInternInfoChange={setInternInfo}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        {workflow && (
          <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-secondary/20">
            <div className="flex items-center gap-4">
              {progressMessage && (
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  {executing && (
                    <div className="w-3 h-3 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  )}
                  {progressMessage}
                </div>
              )}
              {jiraUrl && (
                <a
                  href={jiraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                >
                  View Jira Board →
                </a>
              )}
            </div>

          </div>
        )}

        {/* Visualization Area */}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            {error && !executing && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute inset-0 flex items-center justify-center bg-background"
              >
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-red-500"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <h3 className="text-foreground font-semibold mb-2">
                    Failed to generate workflow
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="px-4 py-2 bg-secondary border border-border rounded-md text-sm hover:bg-muted transition"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}

            {workflow && !error && (
              <motion.div
                key="workflow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full"
              >
                <NeuralCosmos
                  pipelineSpec={workflow}
                  isStreaming={false}
                  displayMode="simple"
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}