import React from 'react'
import PropTypes from 'prop-types'
import LiveActivityPanel from './LiveActivityPanel'
import RunSummaryCard from './RunSummaryCard'

/**
 * Activity Summary Panel - Left panel combining live activity feed and run summary
 * Replaces the old LogPanel + part of HealthPanel
 */
function ActivitySummaryPanel({ logs, runStats, displayMode }) {
  return (
    <div className="h-full flex flex-col gap-3">
      {/* Live Activity Feed (takes most of the space) */}
      <div className="flex-1 min-h-0">
        <LiveActivityPanel logs={logs} displayMode={displayMode} />
      </div>
      
      {/* Run Summary Card (appears at bottom when workflow completes) */}
      {runStats && (
        <div className="flex-shrink-0">
          <RunSummaryCard stats={runStats} displayMode={displayMode} />
        </div>
      )}
    </div>
  )
}

ActivitySummaryPanel.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.shape({
    emoji: PropTypes.string,
    message: PropTypes.string.isRequired,
    apiName: PropTypes.string,
    timestamp: PropTypes.string
  })),
  runStats: PropTypes.shape({
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

export default ActivitySummaryPanel

