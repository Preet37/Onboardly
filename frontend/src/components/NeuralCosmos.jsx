import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import * as d3 from 'd3'
import { 
  getHumanDescription, 
  getTooltipExplanation, 
  getStatusText 
} from '../utils/terminology'

// Get color based on latency (performance-based) - Minimal high-contrast palette
const getLatencyColor = (latency_ms) => {
  if (!latency_ms) return '#60a5fa' // Soft blue default
  if (latency_ms < 200) return '#60a5fa' // Blue - fast
  if (latency_ms < 300) return '#34d399' // Emerald - good
  if (latency_ms < 400) return '#fbbf24' // Amber - medium
  return '#f87171' // Red - slow
}

// Get color based on onboarding node type
const getNodeTypeColor = (type) => {
  switch(type) {
    case 'access': return '#60a5fa'    // Blue - setup/access
    case 'learning': return '#a78bfa'  // Purple - learning
    case 'hands-on': return '#34d399'  // Green - practical
    case 'review': return '#fb923c'    // Orange - checkpoint
    case 'http': return '#a78bfa'      // Purple - API (legacy)
    case 'transform': return '#ec4899' // Pink - Transform (legacy)
    default: return '#60a5fa'          // Default blue
  }
}

function NeuralCosmos({ pipelineSpec, isStreaming, displayMode = 'simple' }) {
  const svgRef = useRef(null)
  const [tooltip, setTooltip] = useState({ show: false })
  const simulationRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [visibleNodeCount, setVisibleNodeCount] = useState(0)
  const revealTimerRef = useRef(null)

  // Function to smoothly update existing nodes without recreating the graph
  const updateExistingNodes = (svg, pipelineSpec, width, height, simulation) => {
    const nodesGroup = svg.select('.nodes')

    // Get current node positions from the simulation
    const currentNodes = simulation.nodes()
    const positionMap = new Map(currentNodes.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]))

    // Update simulation with new node data, preserving positions (no AI Core)
    const nodes = pipelineSpec.nodes.map(node => {
      const existingPos = positionMap.get(node.id)
      return {
        ...node,
        r: 50,
        // Preserve existing positions and velocities if they exist
        x: existingPos?.x || width / 2 + (Math.random() - 0.5) * 100,
        y: existingPos?.y || height / 2 + (Math.random() - 0.5) * 100,
        vx: existingPos?.vx || 0,
        vy: existingPos?.vy || 0
      }
    })

    simulation.nodes(nodes)
    // Restart with zero heat to update data without causing movement
    simulation.alpha(0).restart()

    // Update node data with proper key function
    const nodeGroups = nodesGroup.selectAll('g')
      .data(nodes, d => d.id)

    // Update colors and strokes based on status
    nodeGroups.selectAll('circle')
      .transition()
      .duration(300)
      .attr('stroke', function(d) {
        const parent = d3.select(this.parentNode).datum()
        if (!parent) return parent?.latency_ms ? getLatencyColor(d?.latency_ms) : getNodeTypeColor(d?.type)

        if (parent.status === 'failed') return '#f87171'
        if (parent.status === 'running') return '#34d399'
        if (parent.status === 'pending') return '#71717a'
        return parent.latency_ms ? getLatencyColor(parent.latency_ms) : getNodeTypeColor(parent.type)
      })
      .attr('fill', function() {
        const parent = d3.select(this.parentNode).datum()
        if (!parent) return '#09090b'

        const circle = d3.select(this)
        const isMainCircle = circle.attr('class') === 'main-circle'

        // Main circle is always hollow (no fill)
        if (isMainCircle) {
          return 'none'
        }

        // Glow circles keep their colored fills
        if (parent.status === 'running') return '#34d399'
        if (parent.status === 'failed') return '#f87171'
        if (parent.status === 'pending') return '#71717a'
        return parent.latency_ms ? getLatencyColor(parent.latency_ms) : getNodeTypeColor(parent.type)
      })

    // Update text colors
    nodeGroups.selectAll('text')
      .transition()
      .duration(300)
      .attr('fill', function() {
        const parent = d3.select(this.parentNode).datum()
        if (!parent) return '#f8fafc'

        if (parent.status === 'pending') return '#71717a'
        if (parent.status === 'running') return '#34d399'
        if (parent.status === 'failed') return '#f87171'
        return '#f8fafc'
      })
      .text(function() {
        const parent = d3.select(this.parentNode).datum()
        if (!parent) return ''

        // Update verb text based on status
        const name = parent.name || parent.id
        const verbMap = {
          'analyzing': { present: 'Analyzing', past: 'Analyzed' },
          'generating': { present: 'Generating', past: 'Generated' },
          'sending': { present: 'Sending', past: 'Sent' },
          'opened': { present: 'Opening', past: 'Opened' },
          'onboarded': {
            present: name.includes('Not Yet') ? 'Waiting' : 'Onboarding',
            past: 'Onboarded'
          }
        }

        const verbInfo = verbMap[parent.id] || {
          present: name.split(' ')[0] + 'ing',
          past: name.split(' ')[0] + 'ed'
        }

        return parent.status === 'completed' ? verbInfo.past : verbInfo.present
      })

    // Update link data (no AI Core connections)
    const links = pipelineSpec.edges.map(edge => ({
      source: edge.from,
      target: edge.to,
      status: edge.status
    }))

    simulation.force('link').links(links)

    // Update link colors and markers
    const linkElements = svg.select('.links').selectAll('line')
      .data(links, d => `${d.source.id || d.source}-${d.target.id || d.target}`)

    linkElements.transition()
      .duration(300)
      .attr('stroke', d => {
        if (d.status === 'completed') return '#60a5fa'
        if (d.status === 'failed') return '#f87171'
        return '#71717a'
      })
      .attr('marker-end', d => {
        if (d.status === 'completed') return 'url(#arrow-completed)'
        if (d.status === 'failed') return 'url(#arrow-failed)'
        return 'url(#arrow-pending)'
      })
  }

  // Wait for container to have proper dimensions using ResizeObserver
  useEffect(() => {
    if (!svgRef.current) {
      // Retry when ref becomes available
      const timer = setTimeout(() => {
        // Force a re-render by toggling isReady
        setIsReady(false)
        setTimeout(() => setIsReady(true), 10)
      }, 50)
      return () => clearTimeout(timer)
    }
    
    const checkDimensions = () => {
      const container = svgRef.current?.parentElement
      if (!container) return false
      
      const containerWidth = container.clientWidth || 0
      const containerHeight = container.clientHeight || 0
      
      // Only set ready when we have actual valid dimensions
      if (containerWidth >= 200 && containerHeight >= 200) {
        setIsReady(true)
        // Dimensions are valid
        return true
      }
      return false
    }
    
    // Try immediately
    if (checkDimensions()) return
    
    // Watch for size changes
    const container = svgRef.current.parentElement
    if (!container) return
    
    const resizeObserver = new ResizeObserver(() => {
      checkDimensions()
    })
    
    resizeObserver.observe(container)
    
    // Safety fallback: check every 50ms for up to 500ms
    let attempts = 0
    const intervalTimer = setInterval(() => {
      attempts++
      if (checkDimensions() || attempts >= 10) {
        clearInterval(intervalTimer)
        if (attempts >= 10 && !checkDimensions()) {
          // Last resort: just set ready
          setIsReady(true)
        }
      }
    }, 50)
    
    return () => {
      resizeObserver.disconnect()
      clearInterval(intervalTimer)
    }
  }, [])

  // Start incremental reveal when complete graph arrives
  useEffect(() => {
    if (!pipelineSpec?.nodes || !pipelineSpec?.edges) return
    
    const totalNodes = pipelineSpec.nodes.length
    
    // Reset and start reveal animation
    setVisibleNodeCount(0)
    
    // Clear any existing timer
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current)
    }
    
    // Reveal nodes one by one (150ms per node)
    let count = 0
    revealTimerRef.current = setInterval(() => {
      count++
      setVisibleNodeCount(count)
      
      if (count >= totalNodes) {
        clearInterval(revealTimerRef.current)
        revealTimerRef.current = null
      }
    }, 150)
    
    return () => {
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current)
      }
    }
  }, [pipelineSpec?.nodes?.length, pipelineSpec?.edges?.length])

  useEffect(() => {
    if (!pipelineSpec || !svgRef.current || !isReady) return

    // Initialize dimensions and svg element
    const container = svgRef.current.parentElement
    const containerWidth = container.clientWidth || 0
    const containerHeight = container.clientHeight || 0
    
    // Don't render if container has no dimensions yet
    if (containerWidth < 100 || containerHeight < 100) {
      return
    }
    
    const width = containerWidth
    const height = containerHeight

    const svg = d3.select(svgRef.current)

    // Only clear and reinitialize if this is the first render or nodes were added/removed
    const existingNodes = svg.select('.nodes').selectAll('g').data()
    const hasExistingGraph = existingNodes.length > 0 && simulationRef.current
    const nodeCountChanged = existingNodes.length !== pipelineSpec.nodes.length

    if (hasExistingGraph && !nodeCountChanged) {
      // Just update existing nodes without recreating everything
      updateExistingNodes(svg, pipelineSpec, width, height, simulationRef.current)
      return
    }

    // Preserve existing node positions before reinitializing
    const existingPositions = new Map()
    if (hasExistingGraph && simulationRef.current) {
      const currentNodes = simulationRef.current.nodes()
      currentNodes.forEach(n => {
        existingPositions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy })
      })
    }

    // Reinitialize everything
    svg.selectAll('*').remove()
    svg.attr('width', width)
       .attr('height', height)
       .attr('viewBox', `0 0 ${width} ${height}`)

    // Create definitions for effects
    const defs = svg.append('defs')

    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    filter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '4')
      .attr('result', 'blur')

    filter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', d => d)

    // Arrow markers for dependency flow
    const arrowColors = [
      { id: 'arrow-completed', color: '#60a5fa' },
      { id: 'arrow-failed', color: '#f87171' },
      { id: 'arrow-pending', color: '#71717a' }
    ]

    arrowColors.forEach(({ id, color }) => {
      defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)  // Position at target node edge
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('opacity', 0.8)
    })

    // Calculate DAG layers for hierarchical layout
    const calculateDAGLayers = (nodes, edges) => {
      const nodeMap = new Map(nodes.map(n => [n.id, { ...n, layer: 0 }]))
      const inDegree = new Map(nodes.map(n => [n.id, 0]))
      const outEdges = new Map(nodes.map(n => [n.id, []]))
      
      // Build adjacency list and in-degree count
      edges.forEach(edge => {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
        outEdges.get(edge.from).push(edge.to)
      })
      
      // Find source nodes (no incoming edges)
      const sources = Array.from(inDegree.entries())
        .filter(([, degree]) => degree === 0)
        .map(([id]) => id)
      
      // BFS to assign layers
      const queue = sources.map(id => ({ id, layer: 0 }))
      const visited = new Set()
      
      while (queue.length > 0) {
        const { id, layer } = queue.shift()
        if (visited.has(id)) continue
        visited.add(id)
        
        nodeMap.get(id).layer = layer
        
        outEdges.get(id).forEach(targetId => {
          const currentLayer = nodeMap.get(targetId).layer
          nodeMap.get(targetId).layer = Math.max(currentLayer, layer + 1)
          queue.push({ id: targetId, layer: layer + 1 })
        })
      }
      
      return nodeMap
    }
    
    // Build graph data with DAG-aware positioning
    const nodeWithLayers = calculateDAGLayers(pipelineSpec.nodes, pipelineSpec.edges)
    const maxLayer = Math.max(...Array.from(nodeWithLayers.values()).map(n => n.layer))
    const layerGroups = new Map()
    
    nodeWithLayers.forEach(node => {
      if (!layerGroups.has(node.layer)) {
        layerGroups.set(node.layer, [])
      }
      layerGroups.get(node.layer).push(node)
    })
    
    // Order nodes by layer for incremental reveal (sources first, then transforms, etc.)
    const orderedNodes = pipelineSpec.nodes
      .map(node => ({ ...node, layer: nodeWithLayers.get(node.id).layer }))
      .sort((a, b) => a.layer - b.layer)
    
    // Only show nodes up to visibleNodeCount
    const visibleNodes = orderedNodes.slice(0, visibleNodeCount)
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id))
    
    const nodes = pipelineSpec.nodes
      .filter(node => visibleNodeIds.has(node.id))  // Only include visible nodes
      .map(node => {
      const existingPos = existingPositions.get(node.id)
      const isNewNode = !existingPos
      
      const nodeWithLayer = nodeWithLayers.get(node.id)
      const layer = nodeWithLayer.layer
      const nodesInLayer = layerGroups.get(layer)
      const indexInLayer = nodesInLayer.findIndex(n => n.id === node.id)
      
      // Calculate hierarchical position (left to right across full canvas)
      const leftMargin = 120
      const rightMargin = 120
      const usableWidth = Math.max(width - leftMargin - rightMargin, 400)  // Ensure minimum width
      // Ensure proper spacing: if maxLayer is 2, we want 3 evenly spaced columns
      const numLayers = Math.max(maxLayer + 1, 1)
      const layerX = numLayers > 1 
        ? leftMargin + (usableWidth / (numLayers - 1)) * layer
        : width / 2  // Center single layer
      const topMargin = 80
      const bottomMargin = 80
      const usableHeight = Math.max(height - topMargin - bottomMargin, 300)
      const layerSpacing = usableHeight / (nodesInLayer.length + 1)
      const layerY = topMargin + layerSpacing * (indexInLayer + 1)
      
      // Ensure positions are valid
      const finalX = Math.max(50, Math.min(width - 50, layerX))
      const finalY = Math.max(50, Math.min(height - 50, layerY))

      return {
        ...node,
        r: 50,
        layer,
        // Preserve existing positions, or use hierarchical layout for new nodes
        x: existingPos?.x ?? finalX,
        y: existingPos?.y ?? finalY,
        vx: 0,
        vy: 0,
        // Pin all nodes in their layer positions (no drift allowed)
        fx: existingPos?.x ?? finalX,
        fy: existingPos?.y ?? finalY,
        isNewNode
      }
    })

    const links = pipelineSpec.edges
      .filter(edge => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))  // Only show links between visible nodes
      .map(edge => ({
        source: edge.from,
        target: edge.to,
        status: edge.status
      }))

    // Create force simulation - minimal forces since nodes are pinned
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(150)
        .strength(0))  // No force - nodes are pinned
      .force('collision', d3.forceCollide().radius(d => d.r + 20).strength(0))
      .alphaDecay(1)  // Stop immediately
      .alpha(0)  // No energy

    // No settling needed - everything is pre-positioned and pinned

    // Store simulation in ref for incremental updates
    simulationRef.current = simulation

    // Create container groups
    const layersGroup = svg.append('g').attr('class', 'layers')
    const linksGroup = svg.append('g').attr('class', 'links')
    const particlesGroup = svg.append('g').attr('class', 'particles')
    const nodesGroup = svg.append('g').attr('class', 'nodes')

    // Draw layer indicators with node names at the top
    const leftMargin = 120
    const rightMargin = 120
    const usableWidth = Math.max(width - leftMargin - rightMargin, 400)
    const numLayers = Math.max(maxLayer + 1, 1)

    // Group nodes by layer for labeling
    const nodesByLayer = new Map()
    nodes.forEach(node => {
      if (!nodesByLayer.has(node.layer)) {
        nodesByLayer.set(node.layer, [])
      }
      nodesByLayer.get(node.layer).push(node)
    })

    for (let i = 0; i <= maxLayer; i++) {
      const x = numLayers > 1
        ? leftMargin + (usableWidth / (numLayers - 1)) * i
        : width / 2

      // Vertical guide line
      layersGroup.append('line')
        .attr('x1', x)
        .attr('y1', 60)
        .attr('x2', x)
        .attr('y2', height - 40)
        .attr('stroke', '#27272a')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.3)

      // Layer label - use node name instead of generic label
      const nodesInThisLayer = nodesByLayer.get(i) || []
      const labelText = nodesInThisLayer.length > 0 ? nodesInThisLayer[0].name : `Layer ${i}`

      layersGroup.append('text')
        .attr('x', x)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f8fafc')
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .attr('letter-spacing', '0.02em')
        .text(labelText)
    }

    // Draw links (dependency arrows)
    const link = linksGroup.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => {
        if (d.status === 'completed') return '#60a5fa'
        if (d.status === 'failed') return '#f87171'
        return '#71717a'
      })
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', d => d.status === 'failed' ? '5,5' : 'none')
      .attr('marker-end', d => {
        if (d.status === 'completed') return 'url(#arrow-completed)'
        if (d.status === 'failed') return 'url(#arrow-failed)'
        return 'url(#arrow-pending)'
      })

    // Draw particle pulses along edges
    const particles = particlesGroup.selectAll('circle')
      .data(links.filter(d => d.status === 'completed'))
      .enter()
      .append('circle')
      .attr('r', 2.5)
      .attr('fill', '#60a5fa')
      .attr('opacity', 0.9)
      .attr('filter', 'url(#node-glow)')

    // Animate particles
    function animateParticles() {
      particles.each(function(d) {
        const particle = d3.select(this)
        const sourceNode = nodes.find(n => n.id === d.source.id)
        const targetNode = nodes.find(n => n.id === d.target.id)

        if (!sourceNode || !targetNode) return

        const duration = 2000 // 2 seconds per pulse
        const offset = Math.random() * duration

        function pulse() {
          particle
            .attr('cx', sourceNode.x)
            .attr('cy', sourceNode.y)
            .transition()
            .delay(offset)
            .duration(duration)
            .ease(d3.easeLinear)
            .attr('cx', targetNode.x)
            .attr('cy', targetNode.y)
            .on('end', pulse)
        }

        pulse()
      })
    }

    // Draw nodes
    const node = nodesGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))

    // Node outer glow (activity indicator) with pulse
    node.append('circle')
      .attr('r', d => d.r + 15)
      .attr('fill', d => {
        if (d.status === 'running') return '#34d399'
        if (d.status === 'failed') return '#f87171'
        if (d.status === 'pending') return '#71717a'
        return d.latency_ms ? getLatencyColor(d.latency_ms) : getNodeTypeColor(d.type)
      })
      .attr('opacity', d => {
        if (d.status === 'pending') return 0.05
        return 0.1
      })
      .each(function(d) {
        // Enhanced pulse animation - faster for running nodes
        const isRunning = d.status === 'running'
        const duration = isRunning ? 600 : 2000 + Math.random() * 1000
        const maxOpacity = isRunning ? 0.4 : 0.2
        const maxRadius = isRunning ? d.r + 25 : d.r + 20

        function pulse() {
          d3.select(this)
            .transition()
            .duration(duration)
            .ease(d3.easeSinInOut)
            .attr('opacity', maxOpacity)
            .attr('r', maxRadius)
            .transition()
            .duration(duration)
            .ease(d3.easeSinInOut)
            .attr('opacity', d.status === 'pending' ? 0.05 : 0.1)
            .attr('r', d.r + 15)
            .on('end', pulse.bind(this))
        }

        pulse.call(this)
      })

    // Node inner glow
    node.append('circle')
      .attr('r', d => d.r + 5)
      .attr('fill', d => {
        if (d.status === 'running') return '#34d399'
        if (d.status === 'failed') return '#f87171'
        if (d.status === 'pending') return '#71717a'
        return d.latency_ms ? getLatencyColor(d.latency_ms) : getNodeTypeColor(d.type)
      })
      .attr('opacity', d => d.status === 'pending' ? 0.1 : 0.25)

    // Main node circle (hollow ring)
    node.append('circle')
      .attr('class', 'main-circle')
      .attr('r', d => d.r)
      .attr('fill', 'none')  // Hollow - no fill
      .attr('stroke', d => {
        if (d.status === 'failed') return '#f87171'
        if (d.status === 'running') return '#34d399'
        if (d.status === 'pending') return '#71717a'
        return d.latency_ms ? getLatencyColor(d.latency_ms) : getNodeTypeColor(d.type)
      })
      .attr('stroke-width', d => d.status === 'running' ? 3.5 : 2.5)
      .attr('opacity', d => d.status === 'pending' ? 0.5 : 1)
      .attr('filter', 'url(#node-glow)')

    // Node labels - Verb in center (past tense when completed)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('dy', 0)
      .attr('fill', d => {
        if (d.status === 'pending') return '#71717a'
        if (d.status === 'running') return '#34d399'
        if (d.status === 'failed') return '#f87171'
        return '#f8fafc'
      })
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .attr('letter-spacing', '0.02em')
      .text(d => {
        // Extract verb from node name and conjugate based on status
        const name = d.name || d.id

        // Map of node IDs to verbs
        const verbMap = {
          'analyzing': { present: 'Analyzing', past: 'Analyzed' },
          'generating': { present: 'Generating', past: 'Generated' },
          'sending': { present: 'Sending', past: 'Sent' },
          'opened': { present: 'Opening', past: 'Opened' },
          'onboarded': {
            present: name.includes('Not Yet') ? 'Waiting' : 'Onboarding',
            past: 'Onboarded'
          }
        }

        // Try to get verb from map, fallback to extracting from name
        const verbInfo = verbMap[d.id] || {
          present: name.split(' ')[0] + 'ing',
          past: name.split(' ')[0] + 'ed'
        }

        // Use past tense if completed, present tense otherwise
        return d.status === 'completed' ? verbInfo.past : verbInfo.present
      })

    // Latency badge (only in advanced mode)
    if (displayMode === 'advanced') {
      node.filter(d => d.latency_ms)
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', d => -(d.r + 10))
        .attr('fill', d => getLatencyColor(d.latency_ms))
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .text(d => `${d.latency_ms}ms`)
    }

    // Hover events
    node
      .on('mouseenter', function(event, d) {
        d3.select(this).select('circle:nth-child(3)')
          .transition()
          .duration(200)
          .attr('stroke-width', 5)

        setTooltip({
          show: true,
          node: d,
          x: event.pageX,
          y: event.pageY
        })
      })
      .on('mouseleave', function() {
        d3.select(this).select('circle:nth-child(3)')
          .transition()
          .duration(200)
          .attr('stroke-width', 3)

        setTooltip({ show: false })
      })

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance === 0) return d.source.x
          return d.source.x + (dx / distance) * (d.source.r || 50)
        })
        .attr('y1', d => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance === 0) return d.source.y
          return d.source.y + (dy / distance) * (d.source.r || 50)
        })
        .attr('x2', d => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance === 0) return d.target.x
          return d.target.x - (dx / distance) * (d.target.r || 50)
        })
        .attr('y2', d => {
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance === 0) return d.target.y
          return d.target.y - (dy / distance) * (d.target.r || 50)
        })

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Start particle animation after initial layout
    setTimeout(() => {
      animateParticles()
    }, 1000)

    // Drag functions - allow manual repositioning
    function dragstarted(event, d) {
      // Store original position
      d._dragStartX = d.x
      d._dragStartY = d.y
    }

    function dragged(event, d) {
      // Update both actual position and fixed position
      d.x = event.x
      d.y = event.y
      d.fx = event.x
      d.fy = event.y
      
      // Trigger a simulation tick to update link positions
      if (simulation.alpha() < 0.01) {
        simulation.alpha(0.01).restart()
      }
    }

    function dragended(event, d) {
      // Keep the new position locked
      d.fx = d.x
      d.fy = d.y
      // Clean up temp properties
      delete d._dragStartX
      delete d._dragStartY
    }

    // Cleanup
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [pipelineSpec, isReady, visibleNodeCount])

  // Show placeholder when no pipeline data or not ready
  // Don't show graph until we have both nodes AND edges (edges come after planning is complete)
  const hasNodes = pipelineSpec?.nodes && pipelineSpec.nodes.length > 0
  const hasEdges = pipelineSpec?.edges && pipelineSpec.edges.length > 0
  const shouldShowPlaceholder = !pipelineSpec || !hasNodes || !hasEdges || !isReady || visibleNodeCount === 0
  
  if (shouldShowPlaceholder) {
    return (
      <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-2 border-blue-500/30 flex items-center justify-center mb-4 mx-auto">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 animate-pulse" />
          </div>
          <p className="text-zinc-400 text-sm">
            {!isReady ? 'Initializing...' : !hasEdges && hasNodes ? 'Discovering dependencies...' : isStreaming ? 'Planning pipeline...' : 'Waiting for pipeline data...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-zinc-950">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Tooltip */}
      {tooltip.show && tooltip.node && (
        <div
          className="fixed bg-zinc-900/95 backdrop-blur border border-zinc-800 text-xs p-3 rounded-lg pointer-events-none z-50 shadow-xl max-w-xs"
          style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}
        >
          {displayMode === 'simple' ? (
            // Simple mode: Plain English explanation with API name
            <>
              <div className="font-semibold text-zinc-50 mb-2">
                {getHumanDescription(tooltip.node.id, tooltip.node.name, tooltip.node.type)}
              </div>
              <div className="text-zinc-400 text-xs leading-relaxed mb-2">
                {getTooltipExplanation(tooltip.node)}
              </div>
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                <div className="flex justify-between gap-3 text-[10px]">
                  <span className="text-zinc-500">Using:</span>
                  <span className="text-zinc-300 font-mono">{tooltip.node.name}</span>
                </div>
                <div className="flex justify-between gap-3 text-[10px]">
                  <span className="text-zinc-500">Status:</span>
                  <span className="text-zinc-300">{getStatusText(tooltip.node.status, 'simple')}</span>
                </div>
              </div>
            </>
          ) : (
            // Advanced mode: Technical details
            <>
              <div className="font-semibold text-zinc-50 mb-2">{tooltip.node.name}</div>
              <div className="space-y-2 text-zinc-400">
                <div className="flex justify-between gap-4">
                  <span>Type</span>
                  <span className="text-zinc-200 capitalize">{tooltip.node.type}</span>
                </div>
                {tooltip.node.layer !== undefined && (
                  <div className="flex justify-between gap-4">
                    <span>Layer</span>
                    <span className="text-zinc-200">{tooltip.node.layer}</span>
                  </div>
                )}
                {tooltip.node.latency_ms && (
                  <div className="flex justify-between gap-4">
                    <span>Latency</span>
                    <span
                      className="font-mono font-semibold"
                      style={{ color: getLatencyColor(tooltip.node.latency_ms) }}
                    >
                      {tooltip.node.latency_ms}ms
                    </span>
                  </div>
                )}
                {pipelineSpec && pipelineSpec.edges && (
                  <>
                    {(() => {
                      const dependencies = pipelineSpec.edges
                        .filter(e => e.to === tooltip.node.id)
                        .map(e => pipelineSpec.nodes.find(n => n.id === e.from)?.name)
                        .filter(Boolean)
                      return dependencies.length > 0 && (
                        <div>
                          <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mt-2 mb-1">
                            Depends on
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {dependencies.map(name => (
                              <span key={name} className="bg-zinc-800/50 px-1.5 py-0.5 rounded text-[10px] text-zinc-300">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                    {(() => {
                      const dependents = pipelineSpec.edges
                        .filter(e => e.from === tooltip.node.id)
                        .map(e => pipelineSpec.nodes.find(n => n.id === e.to)?.name)
                        .filter(Boolean)
                      return dependents.length > 0 && (
                        <div>
                          <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mt-2 mb-1">
                            Feeds into
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {dependents.map(name => (
                              <span key={name} className="bg-zinc-800/50 px-1.5 py-0.5 rounded text-[10px] text-zinc-300">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}


    </div>
  )
}

NeuralCosmos.propTypes = {
  pipelineSpec: PropTypes.shape({
    nodes: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      status: PropTypes.string,
      latency_ms: PropTypes.number,
      layer: PropTypes.number
    })),
    edges: PropTypes.arrayOf(PropTypes.shape({
      from: PropTypes.string.isRequired,
      to: PropTypes.string.isRequired,
      status: PropTypes.string
    }))
  }),
  isStreaming: PropTypes.bool,
  displayMode: PropTypes.oneOf(['simple', 'advanced'])
}

export default NeuralCosmos
