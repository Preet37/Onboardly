// src/TaskOrbitApp.jsx - Finalized UI Logic (Full File)

import React, { useEffect, useState } from 'react';
// Corrected import path (now possible because pipelineStream.js exists)
// In src/TaskOrbitApp.jsx:
import { startPipelineRun } from "./services/pipelineStream"; // Remove the .js extension and let Vite figure it out
import PipelineFlow from './components/PipelineFlow'; 
import NeuralCosmos from './components/NeuralCosmos';
import ActivitySummaryPanel from './components/ActivitySummaryPanel';
import InsightsPanel from './components/InsightsPanel';
import NarrationPanel from './components/NarrationPanel';

// Simple ID generator (since crypto module sometimes fails in browser setup)
const generateSimpleId = () => 'run' + Math.random().toString(36).substring(2, 12); 

const INITIAL_DATA = {
  summary: 'Ready to receive goal...',
  pipeline_spec: { nodes: [], edges: [] },
  correlation: { x: '', y: '', pearson_r: 0, n: 0 }
};

export default function TaskOrbitApp() {
    // --- Core State ---
    const [data, setData] = useState(INITIAL_DATA);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [lastEvent, setLastEvent] = useState(null);
    
    // --- Visualization & Input State ---
    const [viewMode, setViewMode] = useState('orbit');
    const [displayMode, setDisplayMode] = useState('simple');
    // Input state initialized to Berkeley example coordinates
    const [inputGoal, setInputGoal] = useState("Analyze restaurant proximity and weather near Berkeley");
    const [inputOrigin, setInputOrigin] = useState("37.8715,-122.2730"); 
    
    // --- Logging & Insight State ---
    const [activityLogs, setActivityLogs] = useState([]);
    const [runStats, setRunStats] = useState(null); 
    const [insight, setInsight] = useState("Awaiting command. Click 'Generate & Run' to start MetaForge.");

    // Function to handle ALL incoming SSE events
    const handleStreamEvent = (event) => {
        setLastEvent(event);
        const timestamp = new Date(event.t || Date.now()).toLocaleTimeString();

        // 1. PLANNING PHASE
        if (event.event === 'planning') {
            setActivityLogs(prev => [...prev, { emoji: '🧠', message: 'Agent planning workflow...', timestamp }]);
            setIsStreaming(true);
            setLoading(true);
        }

        // 2. PLAN COMPLETE (Receives the full DAG blueprint)
        if (event.event === 'planned') {
            // CRITICAL: Load the initial DAG structure and node names for visualization
            setData(prev => ({ 
                ...prev, 
                pipeline_spec: event.spec,
                summary: `Plan generated. ${event.spec._decision[0]}`,
            }));
            setLoading(false); // <--- Clear loading state here
            setActivityLogs(prev => [...prev, { emoji: '✅', message: 'Plan executed. Starting live execution.', timestamp }]);
        }

        // 3. EXECUTION PHASE (Receives per-node status updates and the whole DAG state)
        if (event.event === 'node_start' || event.event === 'node_complete' || event.event === 'node_fail') {
            // CRITICAL: Update the visualization with the node's new status/latency
            if (event.state) {
                 setData(prev => ({ ...prev, pipeline_spec: { ...prev.pipeline_spec, ...event.state } }));
            }
            
            const statusEmoji = event.event === 'node_start' ? '⚡' : (event.event === 'node_complete' ? '📦' : '❌');
            setActivityLogs(prev => [...prev, { 
                emoji: statusEmoji, 
                message: `${event.status === 'failed' ? 'Failed' : (event.status === 'completed' ? 'Completed' : 'Running')} ${event.nodeId}`, 
                timestamp 
            }].slice(-100));
        }

        // 4. FINAL COMPLETION
        if (event.event === 'finished') {
            setIsStreaming(false);
            setLoading(false);
            setActivityLogs(prev => [...prev, { emoji: '🎉', message: `Pipeline completed. Duration: ${event.duration_ms}ms.`, timestamp }]);
            
            setInsight(`Execution finished in ${event.duration_ms}ms. Check the summary for results.`);
        }
        
        // 5. ERROR HANDLING
        if (event.event === 'error') {
            setIsStreaming(false);
            setLoading(false);
            setError(event.data.message || 'Unknown network error.');
            setActivityLogs(prev => [...prev, { emoji: '🚨', message: `FATAL ERROR: ${event.data.message}`, timestamp }]);
        }
    };

    // Start a new pipeline run function (called by button)
    const startNewRun = async (goal, origin) => {
        // --- Reset State ---
        setIsStreaming(true);
        setLoading(true); // <--- Set loading state to show spinner during planning
        setError(null);
        setActivityLogs([]);
        setRunStats(null);
        setInsight("Analyzing goal and generating plan...");
        setData(INITIAL_DATA); // Reset visualization data

        const runId = generateSimpleId();
        
        const requestBody = {
            goal: goal,
            context: {
                origin: origin,
                radius_m: 800,
                time: 'today'
            },
            useMocks: false, // Force live execution
            outputs: ["summary", "ranked_list", "correlation", "pipeline_spec", "health"],
        };
        
        // 1. Start SSE listener and fire the POST request
        const eventSource = startPipelineRun(runId, requestBody, handleStreamEvent);

        return () => { eventSource.close(); };
    };

    // --- Initial Load / Error States ---
    
    // Renders the full-screen spinner
    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-border border-t-foreground rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">Planning pipeline...</p>
                </div>
            </div>
        );
    }
    
    // --- Main Layout ---
    return (
        <div className="h-screen w-screen overflow-hidden bg-background">
            {/* Minimal Header */}
            <header className="h-14 border-b border-border flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-foreground text-sm font-medium">MetaForge</h1>
                    <span className="text-muted-foreground text-xs">Self-Architecting Pipeline</span>
                </div>

                <div className="flex items-center gap-3">
                    {/* INPUT FIELDS AND BUTTON */}
                    <input 
                        type="text" 
                        value={inputGoal} 
                        onChange={(e) => setInputGoal(e.target.value)} 
                        placeholder="Enter Goal (e.g., Find pizza near me)" 
                        className="text-xs px-2 py-1 border border-border rounded-md w-64 bg-secondary text-foreground"
                        disabled={isStreaming}
                    />
                    <input 
                        type="text" 
                        value={inputOrigin} 
                        onChange={(e) => setInputOrigin(e.target.value)} 
                        placeholder="Lat,Lon (e.g., 37.8715,-122.2730)" 
                        className="text-xs px-2 py-1 border border-border rounded-md w-40 bg-secondary text-foreground"
                        disabled={isStreaming}
                    />

                    <button
                        onClick={() => startNewRun(inputGoal, inputOrigin)}
                        disabled={isStreaming}
                        className="text-xs bg-foreground text-background px-3 py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isStreaming ? 'Running...' : 'Generate & Run'}
                    </button>
                </div>

            </header>
            
            {/* Main Grid Layout */}
            <div className="h-[calc(100vh-3.5rem)] grid grid-cols-12 grid-rows-12 gap-3 p-4">
                {/* Left Panel: Activity + Summary */}
                <div className="col-span-3 row-span-12">
                    <ActivitySummaryPanel logs={activityLogs} runStats={runStats} displayMode={displayMode} />
                </div>

                {/* Center: Visualization */}
                <div className="col-span-6 row-span-12">
                    <div className="bg-secondary/30 border border-border rounded-lg h-full overflow-hidden flex flex-col">
                        
                        {/* Display the Visualization or the initial instruction */}
                        {!data.pipeline_spec.nodes.length && !loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-muted-foreground text-lg">Click 'Generate & Run' to begin the workflow.</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden">
                                {/* Narration Panel - Only in Simple mode */}
                                {displayMode === 'simple' && viewMode === 'orbit' && (
                                    <div className="h-16 flex-shrink-0">
                                        <NarrationPanel currentEvent={lastEvent} pipelineSpec={data?.pipeline_spec} />
                                    </div>
                                )}
                                
                                {/* Visualization */}
                                {viewMode === 'orbit' ? (
                                    <NeuralCosmos
                                        pipelineSpec={data?.pipeline_spec}
                                        isStreaming={isStreaming}
                                        displayMode={displayMode}
                                        lastEvent={lastEvent}
                                    />
                                ) : (
                                    <PipelineFlow pipelineSpec={data?.pipeline_spec} />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Insights */}
                <div className="col-span-3 row-span-12">
                    <InsightsPanel
                        insight={insight}
                        correlation={data?.correlation}
                        stats={data?.health}
                        displayMode={displayMode}
                    />
                </div>
            </div>
        </div>
    );
}