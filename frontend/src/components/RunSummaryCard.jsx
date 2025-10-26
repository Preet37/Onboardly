import React from 'react'
import PropTypes from 'prop-types'
import { motion } from 'framer-motion'

/**
 * Run Summary Card - Shows completion summary after workflow finishes
 * Displays stats differently based on Simple vs Advanced mode
 */
function RunSummaryCard({ stats, displayMode }) {
  if (!stats) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-background/50 border border-border rounded-lg p-4"
    >
      {displayMode === 'simple' ? (
        // Simple mode: Friendly summary
        <>
          <div className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <span>🌟</span>
            <span>
              {stats.completed ? 'Workflow complete!' : 'Workflow finished'}
            </span>
          </div>
          
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {stats.steps} {stats.steps === 1 ? 'step' : 'steps'}
              {stats.retries > 0 && ` · ${stats.retries} ${stats.retries === 1 ? 'retry' : 'retries'}`}
              {stats.failures > 0 && ` · ${stats.failures} ${stats.failures === 1 ? 'issue' : 'issues'}`}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span>⏱️</span>
              <span>Took {stats.duration}s total</span>
            </p>
          </div>
        </>
      ) : (
        // Advanced mode: Technical details
        <>
          <div className="text-xs font-medium text-foreground mb-3">
            Execution Summary
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${stats.completed ? 'text-emerald-400' : 'text-amber-400'}`}>
                {stats.completed ? '✓ Complete' : '⚠ Partial'}
              </span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-mono text-foreground">{stats.duration}s</span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Avg Latency</span>
              <span className="font-mono text-foreground">{stats.avgLatency}ms</span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Steps</span>
              <span className="font-mono text-foreground">
                {stats.steps}/{stats.total}
              </span>
            </div>
            
            {stats.retries > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Retries</span>
                <span className="font-mono text-amber-400">{stats.retries}</span>
              </div>
            )}
            
            {stats.failures > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Failures</span>
                <span className="font-mono text-red-400">{stats.failures}</span>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}

RunSummaryCard.propTypes = {
  stats: PropTypes.shape({
    steps: PropTypes.number,
    total: PropTypes.number,
    failures: PropTypes.number,
    retries: PropTypes.number,
    duration: PropTypes.string,
    avgLatency: PropTypes.number,
    completed: PropTypes.bool
  }),
  displayMode: PropTypes.oneOf(['simple', 'advanced'])
}

export default RunSummaryCard

