// src/services/pipelineStream.js

export const startPipelineRun = (runId, requestBody, eventHandler) => {
    const BACKEND_URL = 'http://localhost:8080';
    
    // 1. Open SSE connection first (essential for AutoGraph)
    const eventSource = new EventSource(`${BACKEND_URL}/events/${runId}`);
    
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            eventHandler(data);
        } catch (e) {
            // Ignore keep-alive comments (data: :)
        }
    };

    eventSource.onerror = (err) => {
        console.error('SSE Error. Connection closed.', err);
        eventHandler({ event: 'error', data: { message: 'SSE connection failed.' } });
        eventSource.close();
    };

    // 2. Trigger the HTTP POST (asynchronously) to start execution
    fetch(`${BACKEND_URL}/run?rid=${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, runId: runId }), 
    }).then(response => {
        if (!response.ok) {
            response.json().then(errorData => {
                console.error("Run start failed:", errorData);
                eventHandler({ event: 'error', data: errorData.errors || errorData });
            });
        }
    }).catch(error => {
        console.error("Network error starting run:", error);
        eventHandler({ event: 'error', data: { message: 'Network unreachable.' } });
    });

    return eventSource;
};