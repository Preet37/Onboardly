// Terminology mapping for Simple vs Advanced views

export const TERMINOLOGY = {
  simple: {
    nodeTypes: {
      http: 'Action',
      transform: 'Process',
      core: 'Planner'
    },
    statusMessages: {
      pending: 'Waiting',
      running: 'Working',
      completed: 'Done',
      failed: 'Issue',
      retrying: 'Retrying'
    }
  },
  advanced: {
    nodeTypes: {
      http: 'API',
      transform: 'Transform',
      core: 'AI Core'
    },
    statusMessages: {
      pending: '○ Pending',
      running: '⟳ Running',
      completed: '✓ Completed',
      failed: '✕ Failed',
      retrying: '↻ Retrying'
    }
  }
}

// Generate human-friendly descriptions based on node name
export function getHumanDescription(nodeId, nodeName, nodeType) {
  // Try to extract action from node name
  const name = nodeName.toLowerCase()
  
  // Common patterns
  if (name.includes('yelp')) return 'Find restaurants'
  if (name.includes('google') || name.includes('maps') || name.includes('gmaps')) return 'Get directions'
  if (name.includes('osrm') || name.includes('eta')) return 'Calculate travel time'
  if (name.includes('weather')) return 'Check weather'
  if (name.includes('github')) return 'Search code'
  if (name.includes('openai') || name.includes('summary')) return 'Summarize content'
  if (name.includes('notion')) return 'Save to Notion'
  if (name.includes('geocod')) return 'Find location'
  if (name.includes('join') || name.includes('merge')) return 'Combine data'
  if (name.includes('rank') || name.includes('filter') || name.includes('sort')) return 'Rank results'
  if (name.includes('format')) return 'Format output'
  
  // Fallback to simplified name
  return nodeName.split(' ')[0]
}

// Get tooltip explanation for a node
export function getTooltipExplanation(node) {
  const name = node.name.toLowerCase()
  
  if (name.includes('yelp')) {
    return 'Fetches restaurant information from Yelp to find places near you.'
  }
  if (name.includes('google') || name.includes('maps') || name.includes('osrm')) {
    return 'Calculates how long it would take to get there.'
  }
  if (name.includes('weather')) {
    return 'Gets current weather conditions for the area.'
  }
  if (name.includes('join') || name.includes('merge')) {
    return 'Combines information from multiple sources into one result.'
  }
  if (name.includes('rank') || name.includes('filter')) {
    return 'Sorts and filters results to show you the best options.'
  }
  if (name.includes('github')) {
    return 'Searches for code repositories on GitHub.'
  }
  if (name.includes('openai') || name.includes('summary')) {
    return 'Creates a brief summary of the content using AI.'
  }
  if (name.includes('notion')) {
    return 'Saves the results to your Notion workspace.'
  }
  
  return `Performs the ${node.name} step in your workflow.`
}

// Get simple node type label
export function getSimpleNodeType(type, status) {
  if (status === 'completed') return 'Done'
  if (status === 'running') return TERMINOLOGY.simple.nodeTypes[type] || 'Task'
  if (status === 'failed') return 'Error'
  return TERMINOLOGY.simple.nodeTypes[type] || 'Task'
}

// Get advanced node type label
export function getAdvancedNodeType(type) {
  return TERMINOLOGY.advanced.nodeTypes[type] || type
}

// Get status text
export function getStatusText(status, viewMode = 'simple') {
  return TERMINOLOGY[viewMode].statusMessages[status] || status
}

// Get action description for narration
export function getNodeAction(node) {
  if (!node) return 'process'
  
  const name = node.name.toLowerCase()
  
  if (name.includes('yelp')) return 'find restaurants'
  if (name.includes('google') || name.includes('maps') || name.includes('osrm')) return 'calculate travel times'
  if (name.includes('weather')) return 'check the weather'
  if (name.includes('github')) return 'search for code'
  if (name.includes('openai') || name.includes('summary')) return 'create a summary'
  if (name.includes('notion')) return 'save to Notion'
  if (name.includes('join') || name.includes('merge')) return 'combine the information'
  if (name.includes('rank') || name.includes('filter')) return 'rank the results'
  
  return node.name.toLowerCase()
}

