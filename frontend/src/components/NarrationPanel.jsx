import React from 'react'
import PropTypes from 'prop-types'
import { getNodeAction } from '../utils/terminology'

function NarrationPanel({ currentEvent, pipelineSpec }) {
  const getMessage = () => {
    if (!currentEvent) return { text: 'Ready to start your workflow', api: null }
    
    const type = currentEvent.type
    const node = currentEvent.node
    
    // Map events to human language with API names
    switch (type) {
      case 'planning_start':
        return { text: 'Figuring out the best way to do this...', api: null }
      
      case 'node_discovered':
        return { 
          text: `Planning to ${getNodeAction(node)}`,
          api: node?.name
        }
      
      case 'planning_complete':
        return { text: 'Plan is ready! Starting now...', api: null }
      
      case 'node_start':
        const startNode = node || pipelineSpec?.nodes?.find(n => n.id === currentEvent.nodeId)
        const action = getNodeAction(startNode)
        return { 
          text: `${action.charAt(0).toUpperCase() + action.slice(1)}...`,
          api: startNode?.name
        }
      
      case 'node_complete':
        const completeNode = node || pipelineSpec?.nodes?.find(n => n.id === currentEvent.nodeId)
        const completeAction = getNodeAction(completeNode)
        return { 
          text: `✓ Finished ${completeAction}`,
          api: completeNode?.name
        }
      
      case 'node_retry':
        return { text: 'Something went wrong, trying again...', api: null }
      
      case 'fallback_activated':
        return { text: 'Trying a backup approach...', api: null }
      
      case 'pipeline_complete':
        return { text: '✓ All done! Your workflow completed successfully.', api: null }
      
      case 'execution_start':
        return { text: 'Starting to run your workflow...', api: null }
      
      default:
        return { text: currentEvent.message || 'Working on it...', api: null }
    }
  }
  
  const message = getMessage()
  
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <p className="text-zinc-300 text-sm leading-relaxed">
          {message.text}
        </p>
        {message.api && (
          <p className="text-zinc-500 text-xs mt-1 font-mono">
            using {message.api}
          </p>
        )}
      </div>
    </div>
  )
}

NarrationPanel.propTypes = {
  currentEvent: PropTypes.shape({
    type: PropTypes.string,
    node: PropTypes.object,
    nodeId: PropTypes.string,
    message: PropTypes.string
  }),
  pipelineSpec: PropTypes.shape({
    nodes: PropTypes.array,
    edges: PropTypes.array
  })
}

export default NarrationPanel

