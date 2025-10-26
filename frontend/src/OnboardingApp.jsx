import { useState, useEffect } from 'react';
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
      id: 'onboarded',
      name: 'Onboarding Ready',
      type: 'review',
      description: 'Onboarding setup complete',
      status: 'pending'
    }
  ],
  edges: [
    { from: 'analyzing', to: 'generating', status: 'pending' },
    { from: 'generating', to: 'sending', status: 'pending' },
    { from: 'sending', to: 'onboarded', status: 'pending' }
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

  // Poll for onboarding completion status
  useEffect(() => {
    if (!internInfo?.email) return;

    const checkCompletion = async () => {
      try {
        const response = await fetch(`http://localhost:3000/onboarding/status/${encodeURIComponent(internInfo.email)}`);
        const data = await response.json();
        
        if (data.completed) {
          // Update the 'onboarded' node to completed status
          setWorkflow(prev => ({
            ...prev,
            nodes: prev.nodes.map(node => 
              node.id === 'onboarded' 
                ? { ...node, status: 'completed' }
                : node
            ),
            edges: prev.edges.map(edge =>
              edge.to === 'onboarded'
                ? { ...edge, status: 'completed' }
                : edge
            )
          }));
          setProgressMessage('🎉 Intern has completed onboarding!');
          console.log('✅ Onboarding completed for:', internInfo.email);
        }
      } catch (error) {
        console.error('Failed to check completion status:', error);
      }
    };

    // Check immediately
    checkCompletion();

    // Poll every 3 seconds
    const interval = setInterval(checkCompletion, 3000);

    return () => clearInterval(interval);
  }, [internInfo?.email]);

  const handleGenerateWorkflow = async (prompt, passedInternInfo = null) => {
    // Use passed intern info if provided, otherwise use state
    const currentInternInfo = passedInternInfo || internInfo;
    
    console.log('🔍 handleGenerateWorkflow called');
    console.log('  - Passed intern info:', passedInternInfo);
    console.log('  - State intern info:', internInfo);
    console.log('  - Using:', currentInternInfo);
    
    if (!currentInternInfo || !currentInternInfo.name || !currentInternInfo.email) {
      console.error('❌ Missing intern info');
      alert('Please provide intern name and email first.');
      return;
    }

    console.log('✅ Starting workflow generation for:', currentInternInfo);
    
    setCurrentPrompt(prompt);
    setExecuting(true);
    setError(null);
    setJiraUrl(null);

    // Reset workflow to initial unlit state
    setWorkflow(getInitialWorkflow());
    setProgressMessage('Starting onboarding automation...');

    try {
      const result = await executeOnboardingWithProgress(prompt, currentInternInfo, (progressData) => {
        const { step, status, message, jiraEpicUrl, extensionActivated, trainingInProgress } = progressData;

        console.log('📊 SSE Progress Update:', { step, status, message, extensionActivated, trainingInProgress });

        setProgressMessage(message || '');

        if (jiraEpicUrl) {
          setJiraUrl(jiraEpicUrl);
        }

        // ISSUE 1 FIX: Stop generating spinner after 'sending' is completed
        if (step === 'sending' && status === 'completed') {
          console.log('✅ Sending completed, stopping spinner');
          setExecuting(false);
        }

        // Update workflow node status
        setWorkflow(prev => ({
          ...prev,
          nodes: prev.nodes.map(node => {
            if (node.id === step) {
              // Special handling for onboarded step
              if (step === 'onboarded' && status === 'completed') {
                return { ...node, name: 'Setup Complete ✓', status };
              }
              return { ...node, status };
            }
            return node;
          }),
          edges: prev.edges.map(edge => {
            // When a node starts running, highlight the incoming edge
            if (edge.to === step && status === 'running') {
              return { ...edge, status: 'running' };
            }
            // When a node completes, mark the outgoing edge as completed
            if (edge.from === step && status === 'completed') {
              return { ...edge, status: 'completed' };
            }
            return edge;
          })
        }));
      });

      setProgressMessage(`✅ Onboarding tasks sent to ${currentInternInfo.name}. Waiting for completion...`);

      if (result && result.jiraEpicUrl) {
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