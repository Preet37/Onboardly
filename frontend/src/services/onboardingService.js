/**
 * Onboarding Service
 * Handles communication with the onboarding backend API
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

/**
 * Generate a workflow DAG from a text prompt
 * @param {string} prompt - Description of the onboarding workflow
 * @returns {Promise<Object>} - Workflow object with nodes and edges
 */
export async function generateWorkflowDAG(prompt) {
  try {
    const response = await fetch(`${API_BASE}/generate-workflow-dag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate workflow');
    }

    const data = await response.json();
    return data.workflow;
  } catch (error) {
    console.error('Error generating workflow DAG:', error);
    throw error;
  }
}

/**
 * Execute the full onboarding process with real-time progress updates (SSE)
 * @param {string} prompt - Onboarding description
 * @param {Object} internInfo - Intern details { name, email }
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Object>} - Onboarding execution result
 */
export async function executeOnboardingWithProgress(prompt, internInfo, onProgress) {
  return new Promise((resolve, reject) => {
    fetch(`${API_BASE}/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        intern: internInfo,
      }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to start onboarding');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function readStream() {
          reader.read().then(({ done, value }) => {
            if (done) {
              resolve({});
              return;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            lines.forEach(line => {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                onProgress(data);

                if (data.step === 'done') {
                  resolve(data.finalData);
                } else if (data.step === 'error') {
                  reject(new Error(data.error));
                }
              }
            });

            readStream();
          });
        }

        readStream();
      })
      .catch(error => {
        console.error('Error executing onboarding:', error);
        reject(error);
      });
  });
}

/**
 * Convert workflow DAG to format compatible with NeuralCosmos visualization
 * @param {Object} workflow - Raw workflow from backend
 * @returns {Object} - Formatted pipeline spec for visualization
 */
export function formatWorkflowForVisualization(workflow) {
  if (!workflow || !workflow.nodes || !workflow.edges) {
    return { nodes: [], edges: [] };
  }

  return {
    nodes: workflow.nodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      status: node.status || 'pending',
      description: node.description,
      estimatedDuration: node.estimatedDuration,
    })),
    edges: workflow.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      status: edge.status || 'pending',
    })),
    _metadata: workflow.metadata,
  };
}
