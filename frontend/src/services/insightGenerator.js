/**
 * Generate insights from pipeline results
 * Uses LLM if API key is available, otherwise falls back to template-based insights
 */

/**
 * Generate an insight from pipeline execution results
 * @param {Object} pipelineState - The complete pipeline state
 * @param {Array} events - Array of activity events
 * @returns {Promise<string>} Human-friendly insight text
 */
export async function generateInsight(pipelineState, events) {
  // Check if OpenAI API key is configured
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey || apiKey === 'your_key_here') {
    // Use template-based insights
    return generateTemplateInsight(pipelineState, events)
  }
  
  try {
    // Prepare data for LLM
    const summary = {
      total_steps: pipelineState.nodes?.length || 0,
      completed: pipelineState.nodes?.filter(n => n.status === 'completed').length || 0,
      failed: pipelineState.nodes?.filter(n => n.status === 'failed').length || 0,
      retries: events.filter(e => e.message?.includes('Retrying')).length || 0,
      node_types: pipelineState.nodes?.map(n => ({ name: n.name, type: n.type })) || []
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'You are a friendly assistant explaining workflow results to non-technical users. Be concise, warm, and insightful.'
        }, {
          role: 'user',
          content: `Summarize this workflow execution in one friendly sentence (max 15 words). Start with phrases like "Looks like...", "It seems...", or "Found that..."\n\nWorkflow: ${JSON.stringify(summary)}`
        }],
        max_tokens: 50,
        temperature: 0.7
      })
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    const insight = data.choices[0].message.content.trim()
    
    return insight
  } catch (error) {
    console.warn('LLM insight generation failed, using template:', error)
    // Fallback to template
    return generateTemplateInsight(pipelineState, events)
  }
}

/**
 * Generate template-based insights (no LLM required)
 * @param {Object} pipelineState - The complete pipeline state
 * @param {Array} events - Array of activity events
 * @returns {string} Template-based insight
 */
function generateTemplateInsight(pipelineState, events) {
  if (!pipelineState || !pipelineState.nodes) {
    return "Workflow completed successfully"
  }
  
  const nodes = pipelineState.nodes
  const completed = nodes.filter(n => n.status === 'completed').length
  const failed = nodes.filter(n => n.status === 'failed').length
  const retries = events?.filter(e => e.message?.includes('Retrying')).length || 0
  
  // Check for correlation data (from restaurant example)
  if (pipelineState.correlation?.insight) {
    return pipelineState.correlation.insight
  }
  
  // Pattern-based insights
  if (failed === 0 && retries === 0) {
    return `All ${completed} steps completed smoothly — no issues detected`
  }
  
  if (failed === 0 && retries > 0) {
    return `Finished successfully with ${retries} retry — everything recovered nicely`
  }
  
  if (failed > 0) {
    return `${completed} of ${nodes.length} steps succeeded — ${failed} ${failed === 1 ? 'step' : 'steps'} couldn't complete`
  }
  
  // Check node types for context-specific insights
  const hasYelp = nodes.some(n => n.id?.includes('yelp'))
  const hasOSRM = nodes.some(n => n.id?.includes('osrm'))
  const hasWeather = nodes.some(n => n.id?.includes('meteo'))
  
  if (hasYelp && hasOSRM) {
    return "Found restaurants and calculated travel times for each location"
  }
  
  if (hasWeather) {
    return "Weather data retrieved and ready for your workflow"
  }
  
  // Generic success message
  return `Workflow completed: ${completed} ${completed === 1 ? 'step' : 'steps'} finished successfully`
}

