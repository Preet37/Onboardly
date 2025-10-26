import React, { useState } from 'react'
import { motion } from 'framer-motion'

// Status badge component
function StatusBadge({ status }) {
  const styles = {
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    running: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
    pending: 'bg-muted text-muted-foreground border-border'
  }

  const icons = {
    completed: '✓',
    running: '⟳',
    failed: '✕',
    pending: '○'
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border ${styles[status] || styles.pending}`}>
      <span>{icons[status] || icons.pending}</span>
      <span className="capitalize">{status}</span>
    </div>
  )
}

// Node component
function PipelineNode({ node, onClick, isSelected }) {
  const [isHovered, setIsHovered] = useState(false)

  const getLatencyColor = (latency) => {
    if (latency < 200) return 'text-emerald-500'
    if (latency < 400) return 'text-blue-500'
    return 'text-amber-500'
  }

  const getNodeType = (type) => {
    if (type === 'http') return 'API'
    if (type === 'transform') return 'Transform'
    if (type === 'access') return 'Access'
    if (type === 'learning') return 'Learning'
    if (type === 'hands-on') return 'Hands-On'
    if (type === 'review') return 'Review'
    return type
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        relative bg-secondary/50 border rounded-lg p-4 cursor-pointer
        transition-all duration-200 hover:shadow-lg
        ${isSelected ? 'border-foreground shadow-lg' : 'border-border hover:border-muted-foreground/50'}
      `}
      onClick={() => onClick(node)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status indicator dot */}
      <div className="absolute top-3 right-3">
        <div className={`w-2 h-2 rounded-full ${
          node.status === 'completed' ? 'bg-emerald-500 animate-pulse' :
          node.status === 'running' ? 'bg-blue-500 animate-pulse' :
          node.status === 'failed' ? 'bg-red-500' :
          'bg-muted-foreground/30'
        }`} />
      </div>

      {/* Node content */}
      <div className="space-y-3">
        {/* Header */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">{getNodeType(node.type)}</div>
          <div className="text-sm font-medium text-foreground">{node.name}</div>
        </div>

        {/* Metrics */}
        {node.latency_ms && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Latency</span>
            <span className={`font-mono font-medium ${getLatencyColor(node.latency_ms)}`}>
              {node.latency_ms}ms
            </span>
          </div>
        )}

        {/* Status badge on hover */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <StatusBadge status={node.status || 'completed'} />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// Connection line
function ConnectionLine({ from, to, status, label }) {
  return (
    <div className="flex items-center gap-2 my-4">
      <div className="flex-1 relative">
        <div className={`h-px w-full transition-colors ${
          status === 'completed' ? 'bg-emerald-500/30' :
          status === 'running' ? 'bg-blue-500/30' :
          status === 'failed' ? 'bg-red-500/30' :
          'bg-border'
        }`}>
          {/* Animated pulse for active connections */}
          {status === 'running' && (
            <motion.div
              className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
              animate={{ x: ['0%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
        {label && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground bg-background px-2 py-0.5 rounded border border-border whitespace-nowrap">
            {label}
          </div>
        )}
      </div>
      <div className={`w-1.5 h-1.5 rounded-full ${
        status === 'completed' ? 'bg-emerald-500' :
        status === 'running' ? 'bg-blue-500 animate-pulse' :
        status === 'failed' ? 'bg-red-500' :
        'bg-border'
      }`} />
    </div>
  )
}

// Main Pipeline Flow component
export default function PipelineFlow({ pipelineSpec }) {
  const [selectedNode, setSelectedNode] = useState(null)

  if (!pipelineSpec) return null

  // Organize nodes by type
  const apiNodes = pipelineSpec.nodes.filter(n => n.type === 'http')
  const transformNodes = pipelineSpec.nodes.filter(n => n.type === 'transform')

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-1">Pipeline Execution</h2>
          <p className="text-sm text-muted-foreground">
            {pipelineSpec.nodes.length} nodes • {pipelineSpec.edges.length} connections
          </p>
        </div>

        {/* API Layer */}
        {apiNodes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">API LAYER</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {apiNodes.map((node) => (
                <PipelineNode
                  key={node.id}
                  node={node}
                  onClick={setSelectedNode}
                  isSelected={selectedNode?.id === node.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Connection indicator */}
        {apiNodes.length > 0 && transformNodes.length > 0 && (
          <ConnectionLine
            status="completed"
            label="Data aggregation"
          />
        )}

        {/* Transform Layer */}
        {transformNodes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">TRANSFORM LAYER</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {transformNodes.map((node) => (
                <PipelineNode
                  key={node.id}
                  node={node}
                  onClick={setSelectedNode}
                  isSelected={selectedNode?.id === node.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Final output indicator */}
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 border border-border rounded-lg">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Output Ready</span>
          </div>
        </div>

        {/* Selected Node Details */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-secondary/30 border border-border rounded-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Node Details</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-foreground">{selectedNode.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="text-foreground">{selectedNode.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="text-foreground capitalize">{selectedNode.type}</span>
              </div>
              {selectedNode.latency_ms && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="font-mono text-foreground">{selectedNode.latency_ms}ms</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
