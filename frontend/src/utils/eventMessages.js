// Event-to-Message Mapping for Human-Friendly Activity Feed

export const EVENT_MESSAGES = {
  default: {
    planning_start: "🧠 Figuring out the best way to do this...",
    planning_complete: "✅ Plan is ready! Starting now...",
    node_start: "🚀 Starting {nodeName}...",
    node_complete: "✅ {nodeName} completed",
    node_fail: "⚠️ {nodeName} failed — retrying...",
    node_retry: "🔁 Retrying {nodeName} (attempt {attempt})",
    fallback_activated: "🧭 Switched to backup service",
    pipeline_complete: "🌟 Workflow complete!",
    // Events to skip (return null to filter out)
    execution_start: null,  // Redundant with planning_complete
    node_discovered: null,
    node_progress: null,
    planning_update: null,
    execution_complete: null,  // Redundant with pipeline_complete
    final_state: null
  },
  yelp_search: {
    node_start: "🔍 Looking up nearby restaurants...",
    node_complete: "📦 Found restaurants with ratings",
    node_fail: "⚠️ Yelp service unavailable — trying backup"
  },
  osrm_table: {
    node_start: "🗺️ Calculating travel times...",
    node_complete: "✅ Travel times computed",
    node_fail: "⏳ Map service slow — retrying..."
  },
  open_meteo: {
    node_start: "☁️ Fetching local weather data...",
    node_complete: "🌤 Weather data ready",
    node_fail: "⚠️ Weather service timeout — using cache"
  },
  geocode: {
    node_start: "📍 Finding your location...",
    node_complete: "✅ Location identified",
    node_fail: "⚠️ Couldn't find location — checking backup"
  },
  github_search: {
    node_start: "🔍 Searching code repositories...",
    node_complete: "📦 Found matching repositories",
    node_fail: "⚠️ GitHub API limit reached — waiting..."
  },
  openai_summary: {
    node_start: "🤖 Creating AI summary...",
    node_complete: "✨ Summary generated",
    node_fail: "⚠️ AI service busy — retrying..."
  },
  notion_create: {
    node_start: "📤 Saving to Notion...",
    node_complete: "✅ Saved to Notion workspace",
    node_fail: "🔒 Couldn't access Notion — check credentials"
  },
  join_results: {
    node_start: "🧩 Combining data from sources...",
    node_complete: "✅ Data merged successfully",
    node_fail: "⚠️ Data format mismatch — fixing..."
  },
  rank_filter: {
    node_start: "📊 Ranking and filtering results...",
    node_complete: "✅ Top results selected",
    node_fail: "⚠️ Ranking failed — using defaults"
  },
  transform: {
    node_start: "⚙️ Processing data...",
    node_complete: "✅ Data processed",
    node_fail: "⚠️ Processing error — fixing format"
  }
}

/**
 * Format an event into a human-friendly message
 * @param {Object} event - The pipeline event
 * @param {Object} nodeInfo - Information about the node (id, name, type)
 * @returns {string|null} Formatted message with emoji, or null to skip this event
 */
export function formatEventMessage(event, nodeInfo) {
  const eventType = event.type
  
  // Try to find node-specific message
  let template = undefined
  
  if (nodeInfo?.id) {
    // Try exact node ID match first
    template = EVENT_MESSAGES[nodeInfo.id]?.[eventType]
    
    // Try pattern matching (e.g., "yelp" in "yelp_search_123")
    if (template === undefined) {
      for (const key in EVENT_MESSAGES) {
        if (nodeInfo.id.toLowerCase().includes(key.toLowerCase())) {
          template = EVENT_MESSAGES[key]?.[eventType]
          if (template !== undefined) break
        }
      }
    }
  }
  
  // Fall back to default
  if (template === undefined) {
    template = EVENT_MESSAGES.default[eventType]
  }
  
  // If template is explicitly null, this event should be filtered out
  if (template === null) {
    return null
  }
  
  // If still no template, skip unknown events
  if (template === undefined) {
    return null
  }
  
  // Replace placeholders
  let message = template
    .replace('{nodeName}', nodeInfo?.name || 'step')
    .replace('{count}', event.data?.count || event.result?.length || '')
    .replace('{attempt}', event.attempt || event.retry_count || '')
  
  return message
}

/**
 * Extract emoji from message (for separate display)
 * @param {string} message - Message with emoji
 * @returns {Object} { emoji, text }
 */
export function extractEmoji(message) {
  const emojiMatch = message.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*/u)
  
  if (emojiMatch) {
    return {
      emoji: emojiMatch[0].trim(),
      text: message.replace(emojiMatch[0], '').trim()
    }
  }
  
  return {
    emoji: '•',
    text: message
  }
}

