#!/usr/bin/env python3
"""
Simple proxy server to bypass X-Frame-Options for GCP Console
Strips security headers that prevent iframe embedding
"""

from flask import Flask, request, Response
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# Target URL
GCP_CONSOLE_BASE = "https://console.cloud.google.com"

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'])
def proxy(path):
    """Proxy requests to GCP Console, stripping X-Frame-Options"""

    # Handle OPTIONS preflight requests
    if request.method == 'OPTIONS':
        response = Response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Allow-Headers'] = '*'
        return response

    # Build target URL
    url = f"{GCP_CONSOLE_BASE}/{path}"

    # Get query parameters
    if request.query_string:
        url += f"?{request.query_string.decode()}"

    # Prepare headers (copy from original request, remove host)
    headers = {key: value for key, value in request.headers if key.lower() not in ['host', 'connection']}

    try:
        # Forward the request
        resp = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            data=request.data,
            cookies=request.cookies,
            allow_redirects=True,
            verify=True
        )

        # Prepare response headers, removing frame-blocking headers
        excluded_headers = [
            'content-encoding',
            'content-length',
            'transfer-encoding',
            'connection',
            'x-frame-options',  # This is what blocks iframes
            'content-security-policy',  # May also block iframes
            'x-content-security-policy'
        ]

        response_headers = {
            key: value for key, value in resp.headers.items()
            if key.lower() not in excluded_headers
        }

        # Add CORS headers
        response_headers['Access-Control-Allow-Origin'] = '*'
        response_headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response_headers['Access-Control-Allow-Headers'] = '*'
        response_headers['Access-Control-Allow-Credentials'] = 'true'

        # Create response
        response = Response(resp.content, resp.status_code, response_headers.items())

        # Set cookies from the proxied response
        for cookie in resp.cookies:
            response.set_cookie(cookie.name, cookie.value, domain='localhost')

        return response

    except Exception as e:
        return Response(f"Proxy Error: {str(e)}", 500)

@app.route('/health')
def health():
    """Health check endpoint"""
    return {'status': 'ok', 'proxy_target': GCP_CONSOLE_BASE}

if __name__ == '__main__':
    print("🔄 GCP Console Proxy Server")
    print(f"   Proxying: {GCP_CONSOLE_BASE}")
    print("   Server: http://localhost:8082")
    print("   Use this URL in your iframe instead of the direct GCP URL")
    app.run(host='0.0.0.0', port=8082, debug=True)
