import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Live Activity Panel - Shows real-time workflow activity
 * Replaces technical logs with human-friendly narrative
 */
function LiveActivityPanel({ logs, displayMode }) {
  const logEndRef = useRef(null)

  // Auto-scroll to bottom when new logs appear
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="bg-secondary/50 border border-border rounded-lg p-5 h-full flex flex-col card-hover">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-foreground text-xs font-medium tracking-wide">
          {displayMode === 'simple' ? "What's Happening" : 'Activity Log'}
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
          <span className="text-muted-foreground text-[10px]">
            {logs?.length || 0} {logs?.length === 1 ? 'event' : 'events'}
          </span>
        </div>
      </div>

      {/* Activity stream */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {!logs || logs.length === 0 ? (
          <div className="text-muted-foreground text-sm italic text-center py-8">
            Waiting for workflow to start...
          </div>
        ) : (
          <AnimatePresence>
            {logs.map((log, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex items-start gap-2.5 py-1"
              >
                {/* Emoji icon */}
                <span className="text-lg leading-none flex-shrink-0 mt-0.5">
                  {log.emoji || '•'}
                </span>
                
                {/* Message content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed break-words">
                    {log.message}
                  </p>
                  
                  {/* Show API name only in Advanced mode */}
                  {displayMode === 'advanced' && log.apiName && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {log.apiName}
                    </p>
                  )}
                  
                  {/* Show timestamp only in Advanced mode */}
                  {displayMode === 'advanced' && log.timestamp && (
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {log.timestamp}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

LiveActivityPanel.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.shape({
    emoji: PropTypes.string,
    message: PropTypes.string.isRequired,
    apiName: PropTypes.string,
    timestamp: PropTypes.string
  })),
  displayMode: PropTypes.oneOf(['simple', 'advanced'])
}

export default LiveActivityPanel

