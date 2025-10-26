// Mock Postman Flow Event Simulator
// Simulates real-time pipeline execution with SSE-like events

export class MockPipelineStream {
  constructor() {
    this.listeners = []
    this.currentState = null
    this.isRunning = false
  }

  // Subscribe to pipeline events
  subscribe(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  emit(event) {
    this.listeners.forEach(cb => cb(event))
  }

  // Start a new pipeline execution
  async startPipeline(goal) {
    if (this.isRunning) return
    this.isRunning = true

    // Phase 1: Planning (AI Core thinks)
    await this.planningPhase(goal)

    // Phase 2: Execution (nodes run in DAG order)
    await this.executionPhase()

    // Phase 3: Completion
    await this.completionPhase()

    this.isRunning = false
  }

  async planningPhase(goal) {
    this.startTime = Date.now()

    this.emit({
      type: 'planning_start',
      timestamp: Date.now(),
      message: 'AI analyzing request...'
    })

    await this.sleep(1500)

    // AI Core generates the pipeline DAG
    const pipeline = this.generatePipeline(goal)

    this.currentState = {
      nodes: [
        {
          id: 'ai-core',
          name: 'AI Core',
          type: 'core',
          status: 'active',
          r: 40
        }
      ],
      edges: [],
      runningNodes: new Set(['ai-core'])
    }

    this.emit({
      type: 'planning_update',
      timestamp: Date.now(),
      state: { ...this.currentState }
    })

    // Reveal nodes one by one during planning
    for (const node of pipeline.nodes) {
      await this.sleep(800)

      this.currentState.nodes.push({
        ...node,
        status: 'pending',
        r: 25
      })

      this.emit({
        type: 'node_discovered',
        timestamp: Date.now(),
        node: node,
        state: { ...this.currentState }
      })
    }

    // Add edges
    this.currentState.edges = pipeline.edges

    this.emit({
      type: 'planning_complete',
      timestamp: Date.now(),
      state: { ...this.currentState },
      message: 'Pipeline graph assembled'
    })

    await this.sleep(500)
  }

  async executionPhase() {
    this.emit({
      type: 'execution_start',
      timestamp: Date.now(),
      message: 'Starting pipeline execution...'
    })

    // Get execution order (topological sort)
    const executionOrder = this.getExecutionOrder()

    for (const nodeId of executionOrder) {
      if (nodeId === 'ai-core') continue

      const node = this.currentState.nodes.find(n => n.id === nodeId)
      if (!node) continue

      // Start node execution
      node.status = 'running'
      this.currentState.runningNodes.add(nodeId)

      this.emit({
        type: 'node_start',
        timestamp: Date.now(),
        nodeId: nodeId,
        state: { ...this.currentState }
      })

      // Simulate execution time
      const executionTime = node.latency_ms || (300 + Math.random() * 500)

      // Emit progress updates during execution
      const progressSteps = 3
      for (let i = 0; i < progressSteps; i++) {
        await this.sleep(executionTime / progressSteps)

        this.emit({
          type: 'node_progress',
          timestamp: Date.now(),
          nodeId: nodeId,
          progress: ((i + 1) / progressSteps) * 100
        })
      }

      // Randomly simulate retry or fallback (10% chance)
      if (Math.random() < 0.1 && node.type === 'http') {
        node.status = 'retrying'

        this.emit({
          type: 'node_retry',
          timestamp: Date.now(),
          nodeId: nodeId,
          reason: 'Timeout (>3s)',
          state: { ...this.currentState }
        })

        await this.sleep(1000)

        // Add fallback node
        const fallbackNode = {
          id: `${nodeId}_fallback`,
          name: `${node.name} (Fallback)`,
          type: node.type,
          status: 'running',
          latency_ms: Math.floor(executionTime * 0.7),
          r: 25
        }

        this.currentState.nodes.push(fallbackNode)

        // Redirect edges: fallback node should have same connections as original
        // Find incoming edges (nodes that feed into the failed node)
        const incomingEdges = this.currentState.edges.filter(e => e.to === nodeId)
        
        // Find outgoing edges (downstream nodes that depend on the failed node)
        const outgoingEdges = this.currentState.edges.filter(e => e.from === nodeId)
        
        // Add edges FROM upstream nodes TO fallback node
        incomingEdges.forEach(edge => {
          this.currentState.edges.push({
            from: edge.from,
            to: fallbackNode.id,
            status: 'completed'  // Already completed by upstream
          })
        })
        
        // Add edges FROM fallback node TO downstream nodes
        outgoingEdges.forEach(edge => {
          this.currentState.edges.push({
            from: fallbackNode.id,
            to: edge.to,
            status: 'pending'
          })
        })

        this.emit({
          type: 'fallback_activated',
          timestamp: Date.now(),
          originalNode: nodeId,
          fallbackNode: fallbackNode.id,
          state: { ...this.currentState }
        })

        await this.sleep(fallbackNode.latency_ms)

        fallbackNode.status = 'completed'
        node.status = 'failed'
        
        // Mark the original failed node's edges as failed
        this.currentState.edges.forEach(edge => {
          if (edge.from === nodeId) {
            edge.status = 'failed'
          }
        })
        
        // Mark the fallback edges as completed
        this.currentState.edges.forEach(edge => {
          if (edge.from === fallbackNode.id) {
            edge.status = 'completed'
          }
        })
      } else {
        // Normal completion
        node.status = 'completed'
      }

      this.currentState.runningNodes.delete(nodeId)

      this.emit({
        type: 'node_complete',
        timestamp: Date.now(),
        nodeId: nodeId,
        status: node.status,
        latency_ms: Math.floor(executionTime),
        state: { ...this.currentState }
      })

      // Brief pause between nodes
      await this.sleep(300)
    }

    this.emit({
      type: 'execution_complete',
      timestamp: Date.now(),
      state: { ...this.currentState }
    })
  }

  async completionPhase() {
    // Calculate health metrics
    const completedNodes = this.currentState.nodes.filter(n => n.status === 'completed' && n.type !== 'core')
    const failedNodes = this.currentState.nodes.filter(n => n.status === 'failed')
    const totalLatency = completedNodes.reduce((sum, n) => sum + (n.latency_ms || 0), 0)

    const health = {
      success_rate: (completedNodes.length / (completedNodes.length + failedNodes.length)) * 100,
      avg_latency_ms: Math.floor(totalLatency / completedNodes.length),
      total_nodes: this.currentState.nodes.length - 1, // Exclude AI Core
      failed_nodes: failedNodes.length,
      run_time_sec: ((Date.now() - this.startTime) / 1000).toFixed(1)
    }

    this.emit({
      type: 'pipeline_complete',
      timestamp: Date.now(),
      health: health,
      state: { ...this.currentState },
      message: 'Pipeline execution finished'
    })

    // Mark AI Core as complete
    const aiCore = this.currentState.nodes.find(n => n.id === 'ai-core')
    if (aiCore) {
      aiCore.status = 'completed'
    }

    this.emit({
      type: 'final_state',
      timestamp: Date.now(),
      state: { ...this.currentState },
      health: health
    })
  }

  generatePipeline(goal) {
    // Generate realistic pipeline based on goal
    const templates = {
      'github-notion': {
        nodes: [
          { id: 'n1_github', name: 'GitHub Search', type: 'http', latency_ms: 245 },
          { id: 'n2_openai', name: 'OpenAI Summary', type: 'http', latency_ms: 1200 },
          { id: 't1_format', name: 'Format Content', type: 'transform', latency_ms: 50 },
          { id: 'n3_notion', name: 'Notion Create', type: 'http', latency_ms: 380 }
        ],
        edges: [
          { from: 'n1_github', to: 'n2_openai', status: 'pending' },
          { from: 'n2_openai', to: 't1_format', status: 'pending' },
          { from: 't1_format', to: 'n3_notion', status: 'pending' }
        ]
      },
      'maps-weather': {
        nodes: [
          { id: 'n1_geocode', name: 'Geocoding API', type: 'http', latency_ms: 180 },
          { id: 'n2_weather', name: 'Weather API', type: 'http', latency_ms: 420 },
          { id: 'n3_maps', name: 'Maps API', type: 'http', latency_ms: 290 },
          { id: 't1_merge', name: 'Merge Data', type: 'transform', latency_ms: 35 }
        ],
        edges: [
          { from: 'n1_geocode', to: 'n2_weather', status: 'pending' },
          { from: 'n1_geocode', to: 'n3_maps', status: 'pending' },
          { from: 'n2_weather', to: 't1_merge', status: 'pending' },
          { from: 'n3_maps', to: 't1_merge', status: 'pending' }
        ]
      },
      'default': {
        nodes: [
          { id: 'n1_yelp', name: 'Yelp Search', type: 'http', latency_ms: 245 },
          { id: 'n2_gmaps', name: 'Google Maps', type: 'http', latency_ms: 183 },
          { id: 'n3_weather', name: 'Weather API', type: 'http', latency_ms: 412 },
          { id: 't1_join', name: 'Join Results', type: 'transform', latency_ms: 52 },
          { id: 't2_rank', name: 'Rank & Filter', type: 'transform', latency_ms: 89 }
        ],
        edges: [
          { from: 'n1_yelp', to: 't1_join', status: 'pending' },
          { from: 'n2_gmaps', to: 't1_join', status: 'pending' },
          { from: 'n3_weather', to: 't1_join', status: 'pending' },
          { from: 't1_join', to: 't2_rank', status: 'pending' }
        ]
      }
    }

    // Pick a random template
    const templateKeys = Object.keys(templates)
    const template = templates[templateKeys[Math.floor(Math.random() * templateKeys.length)]]

    return template
  }

  getExecutionOrder() {
    // Simple topological sort
    const { nodes, edges } = this.currentState
    const order = []
    const visited = new Set()

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      // Visit all dependencies first
      const incomingEdges = edges.filter(e => e.to === nodeId)
      for (const edge of incomingEdges) {
        visit(edge.from)
      }

      order.push(nodeId)
    }

    for (const node of nodes) {
      if (node.type !== 'core') {
        visit(node.id)
      }
    }

    return order
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Stop current execution
  stop() {
    this.isRunning = false
  }
}

// Singleton instance
export const pipelineStream = new MockPipelineStream()
