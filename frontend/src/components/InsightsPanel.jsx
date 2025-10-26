import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { motion } from 'framer-motion'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * Insights Panel - Right panel showing insights and optional analytics
 * Replaces SummaryPanel + HealthPanel
 */
function InsightsPanel({ insight, correlation, stats, displayMode }) {
  const [showChart, setShowChart] = useState(false)
  
  // Update chart visibility when mode changes
  useEffect(() => {
    setShowChart(displayMode === 'advanced')
  }, [displayMode])
  
  const hasData = insight || correlation || stats

  return (
    <div className="bg-secondary/50 border border-border rounded-lg p-5 h-full flex flex-col card-hover">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-foreground text-xs font-medium tracking-wide">
          {displayMode === 'simple' ? 'What We Found' : 'Analytics & Insights'}
        </h2>
        
        {/* Chart toggle button (Advanced mode only) */}
        {displayMode === 'advanced' && correlation && correlation.data && (
          <button
            onClick={() => setShowChart(!showChart)}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
        )}
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm italic text-center">
            Insights will appear after workflow completes
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Main Insight (LLM-generated or template) */}
          {insight && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="p-3 bg-background/50 rounded-lg border border-border"
            >
              <p className="text-sm text-foreground leading-relaxed flex items-start gap-2">
                <span className="text-lg flex-shrink-0">💡</span>
                <span>{insight}</span>
              </p>
            </motion.div>
          )}

          {/* Correlation scatter chart (Advanced mode + toggled on) */}
          {displayMode === 'advanced' && showChart && correlation && correlation.data && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-4 border-t border-border"
            >
              <h3 className="text-foreground text-xs font-medium mb-3 tracking-wide">
                Correlation Analysis
              </h3>
              <ResponsiveContainer width="100%" height={140}>
                <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="hsl(240 3.7% 15.9%)" opacity={0.5} />
                  <XAxis
                    type="number"
                    dataKey="rating"
                    name="Rating"
                    domain={[4, 5]}
                    tick={{ fill: 'hsl(240 5% 64.9%)', fontSize: 9, fontFamily: 'Inter' }}
                    stroke="hsl(240 3.7% 15.9%)"
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="eta"
                    name="ETA"
                    tick={{ fill: 'hsl(240 5% 64.9%)', fontSize: 9, fontFamily: 'Inter' }}
                    stroke="hsl(240 3.7% 15.9%)"
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '2 2' }}
                    contentStyle={{
                      backgroundColor: 'hsl(240 3.7% 15.9%)',
                      border: '1px solid hsl(240 3.7% 15.9%)',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontFamily: 'Inter',
                      color: 'hsl(0 0% 98%)'
                    }}
                  />
                  <Scatter
                    data={correlation.data}
                    fill="hsl(0 0% 98%)"
                    opacity={0.7}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Quick stats grid (Advanced mode only) */}
          {stats && displayMode === 'advanced' && (
            <div className="pt-4 border-t border-border">
              <h3 className="text-foreground text-xs font-medium mb-3 tracking-wide">
                System Metrics
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background/50 rounded-lg p-2 border border-border">
                  <div className="text-muted-foreground text-[10px] mb-1">
                    Runtime
                  </div>
                  <div className="text-foreground text-lg font-medium">
                    {stats.run_time_sec}s
                  </div>
                </div>
                
                <div className="bg-background/50 rounded-lg p-2 border border-border">
                  <div className="text-muted-foreground text-[10px] mb-1">
                    Avg Latency
                  </div>
                  <div className="text-foreground text-lg font-medium">
                    {stats.avg_latency_ms}ms
                  </div>
                </div>
                
                {stats.fail_rate_24h !== undefined && (
                  <div className="bg-background/50 rounded-lg p-2 border border-border">
                    <div className="text-muted-foreground text-[10px] mb-1">
                      Fail Rate
                    </div>
                    <div className={`text-lg font-medium ${stats.fail_rate_24h < 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(stats.fail_rate_24h * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
                
                {stats.auto_reroutes !== undefined && (
                  <div className="bg-background/50 rounded-lg p-2 border border-border">
                    <div className="text-muted-foreground text-[10px] mb-1">
                      Reroutes
                    </div>
                    <div className="text-foreground text-lg font-medium">
                      {stats.auto_reroutes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

InsightsPanel.propTypes = {
  insight: PropTypes.string,
  correlation: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    insight: PropTypes.string
  }),
  stats: PropTypes.shape({
    run_time_sec: PropTypes.number,
    avg_latency_ms: PropTypes.number,
    fail_rate_24h: PropTypes.number,
    auto_reroutes: PropTypes.number
  }),
  displayMode: PropTypes.oneOf(['simple', 'advanced'])
}

export default InsightsPanel

