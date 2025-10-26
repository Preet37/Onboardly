/**
 * Calculate run statistics from pipeline state
 * @param {Object} pipelineState - The complete pipeline state
 * @returns {Object} Statistics summary
 */
export function calculateRunStats(pipelineState) {
  if (!pipelineState || !pipelineState.nodes) {
    return null
  }
  
  const nodes = pipelineState.nodes || []
  const completed = nodes.filter(n => n.status === 'completed').length
  const failed = nodes.filter(n => n.status === 'failed').length
  const pending = nodes.filter(n => n.status === 'pending').length
  const retries = nodes.filter(n => n.retry_count && n.retry_count > 0).length
  
  // Calculate timing metrics
  const durations = nodes
    .filter(n => n.latency_ms && n.latency_ms > 0)
    .map(n => n.latency_ms)
  
  const totalDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / 1000 
    : 0
    
  const avgLatency = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0
  
  return {
    steps: completed,
    total: nodes.length,
    failures: failed,
    pending: pending,
    retries,
    duration: totalDuration.toFixed(1),
    avgLatency: Math.round(avgLatency),
    completed: failed === 0 && pending === 0
  }
}

