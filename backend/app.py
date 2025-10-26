import os
import base64
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
from PIL import Image
import io

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Initialize Gemini models
# Using Gemini 2.0 models (the latest available)
vision_model = genai.GenerativeModel('gemini-2.0-flash')
chat_model = genai.GenerativeModel('gemini-2.5-pro')

# Store for screenshot analysis history
analysis_history = []

# Onboarding checklists for GCC tasks
ONBOARDING_CHECKLISTS = {
    "jira": {
        "name": "Jira Account Setup",
        "steps": [
            {
                "id": 1,
                "description": "Navigate to Jira signup page",
                "keywords": ["jira", "sign up", "create account", "atlassian"],
                "required_fields": []
            },
            {
                "id": 2,
                "description": "Enter valid email address",
                "keywords": ["email", "work email", "@"],
                "required_fields": ["email"]
            },
            {
                "id": 3,
                "description": "Create a strong password",
                "keywords": ["password", "create password", "confirm password"],
                "required_fields": ["password"]
            },
            {
                "id": 4,
                "description": "Enter full name",
                "keywords": ["name", "full name", "first name", "last name"],
                "required_fields": ["name"]
            },
            {
                "id": 5,
                "description": "Accept terms and conditions",
                "keywords": ["terms", "conditions", "agree", "accept"],
                "required_fields": ["terms"]
            },
            {
                "id": 6,
                "description": "Verify email address",
                "keywords": ["verify", "verification", "confirm email", "check email"],
                "required_fields": []
            },
            {
                "id": 7,
                "description": "Complete account setup",
                "keywords": ["complete", "finish", "done", "success"],
                "required_fields": []
            }
        ]
    },
    "gcp_storage": {
        "name": "GCP Cloud Storage Setup",
        "steps": [
            {
                "id": 1,
                "description": "Navigate to Cloud Storage in GCP Console",
                "keywords": ["cloud storage", "storage", "buckets", "navigation menu"],
                "required_fields": []
            },
            {
                "id": 2,
                "description": "Click 'Create Bucket' button",
                "keywords": ["create", "create bucket", "new bucket", "button"],
                "required_fields": []
            },
            {
                "id": 3,
                "description": "Enter a unique bucket name",
                "keywords": ["name", "bucket name", "globally unique"],
                "required_fields": ["bucket_name"]
            },
            {
                "id": 4,
                "description": "Choose location type and region",
                "keywords": ["location", "region", "multi-region", "dual-region"],
                "required_fields": ["location"]
            },
            {
                "id": 5,
                "description": "Select storage class",
                "keywords": ["storage class", "standard", "nearline", "coldline", "archive"],
                "required_fields": ["storage_class"]
            },
            {
                "id": 6,
                "description": "Configure access control",
                "keywords": ["access control", "uniform", "fine-grained", "permissions"],
                "required_fields": ["access_control"]
            },
            {
                "id": 7,
                "description": "Review and create bucket",
                "keywords": ["create", "confirm", "review", "finish"],
                "required_fields": []
            }
        ]
    }
}


@app.route('/api/screenshot/analyze', methods=['POST'])
def analyze_screenshot():
    """Analyze screenshot using Gemini Vision API"""
    try:
        data = request.json
        screenshot_base64 = data.get('screenshot')
        task_type = data.get('task_type', 'jira')  # 'jira' or 'conversion'
        current_step = data.get('current_step', 1)
        mouse_position = data.get('mouse_position', {})

        if not screenshot_base64:
            return jsonify({"error": "No screenshot provided"}), 400

        # Decode base64 image
        image_data = base64.b64decode(screenshot_base64.split(',')[1] if ',' in screenshot_base64 else screenshot_base64)
        image = Image.open(io.BytesIO(image_data))

        # Get checklist for the task
        checklist = ONBOARDING_CHECKLISTS.get(task_type)
        if not checklist:
            return jsonify({"error": "Invalid task type"}), 400

        # Build mouse position context
        mouse_context = ""
        if mouse_position.get('x') and mouse_position.get('y'):
            mouse_context = f"\n🖱️ MOUSE CURSOR LOCATION: x={mouse_position['x']}, y={mouse_position['y']}\n⚠️ CRITICAL: Focus your analysis on UI elements near these coordinates. The user is hovering here, so this is what they're looking at RIGHT NOW.\n"

        # Create analysis prompt
        prompt = f"""You are an AI Onboarding Coach analyzing a screenshot of a user completing the {checklist['name']} process.

Current onboarding step (Step {current_step}): {checklist['steps'][current_step - 1]['description']}
{mouse_context}
Analyze the screenshot and provide:
1. What is currently visible on the screen?
2. Which form fields are visible?
3. Are there any error messages or warnings?
4. Has the user filled in any fields? Which ones?
5. What step of the onboarding process does this appear to be?
6. Are there any obvious mistakes or missing information?

Provide your analysis in JSON format with these fields:
{{
    "visible_elements": ["list of visible UI elements"],
    "form_fields": ["list of visible form fields"],
    "filled_fields": ["list of fields that appear to be filled"],
    "errors_visible": ["list of any error messages shown"],
    "current_page": "description of what page/step is shown",
    "step_match": true/false (does this match the expected step?),
    "issues_detected": ["list of any issues or mistakes"]
}}"""

        # Analyze with Gemini Vision
        response = vision_model.generate_content([prompt, image])

        # Parse the response
        analysis_text = response.text

        # Try to extract JSON from the response
        try:
            # Remove markdown code blocks if present
            if '```json' in analysis_text:
                analysis_text = analysis_text.split('```json')[1].split('```')[0].strip()
            elif '```' in analysis_text:
                analysis_text = analysis_text.split('```')[1].split('```')[0].strip()

            analysis = json.loads(analysis_text)
        except json.JSONDecodeError:
            # If JSON parsing fails, create a structured response
            analysis = {
                "visible_elements": [],
                "form_fields": [],
                "filled_fields": [],
                "errors_visible": [],
                "current_page": "Unable to parse",
                "step_match": False,
                "issues_detected": [],
                "raw_analysis": analysis_text
            }

        # Store in history (include mouse position for context)
        analysis_record = {
            "timestamp": datetime.now().isoformat(),
            "task_type": task_type,
            "step": current_step,
            "analysis": analysis,
            "mouse_position": mouse_position
        }
        analysis_history.append(analysis_record)
        
        # Add mouse position to analysis for coaching endpoint
        analysis['mouse_position'] = mouse_position

        return jsonify({
            "success": True,
            "analysis": analysis,
            "timestamp": analysis_record["timestamp"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/coaching/guidance', methods=['POST'])
def get_coaching_guidance():
    """Get coaching guidance based on screenshot analysis"""
    try:
        data = request.json
        analysis = data.get('analysis')
        task_type = data.get('task_type', 'jira')
        current_step = data.get('current_step', 1)

        if not analysis:
            return jsonify({"error": "No analysis provided"}), 400

        checklist = ONBOARDING_CHECKLISTS.get(task_type)
        expected_step = checklist['steps'][current_step - 1]

        # Get mouse position from analysis
        mouse_x = analysis.get('mouse_position', {}).get('x', 0)
        mouse_y = analysis.get('mouse_position', {}).get('y', 0)
        mouse_hint = f" Their cursor is at ({mouse_x}, {mouse_y})." if mouse_x and mouse_y else ""

        # Create coaching prompt - KEEP IT CONCISE (2-3 sentences max)
        coaching_prompt = f"""You're coaching someone through: {checklist['name']}

Expected Step {current_step}: {expected_step['description']}
Current page: {analysis.get('current_page', 'Unknown')}
Visible: {', '.join(analysis.get('form_fields', [])[:3])}
{mouse_hint}

Provide BRIEF coaching (2-3 sentences max):
1. Has the step been COMPLETED (action done, not just hovering)? If yes: "correct"
2. Are they hovering/looking at the right thing but haven't acted yet? If yes: "incomplete"  
3. Are they on the wrong page/step? If yes: "wrong_step"

CRITICAL: "correct" means they COMPLETED the action. Just hovering = "incomplete".

Be specific and concise. Respond in JSON:
{{
    "step_status": "correct" | "wrong_step" | "has_errors" | "incomplete",
    "message": "Brief 2-3 sentence message. If hovering over right element, say 'Good, now click it!'"
}}

Keep it SHORT and actionable!"""

        # Get coaching from Gemini
        response = chat_model.generate_content(coaching_prompt)
        guidance_text = response.text.strip()

        # Parse response
        try:
            if '```json' in guidance_text:
                guidance_text = guidance_text.split('```json')[1].split('```')[0].strip()
            elif '```' in guidance_text:
                guidance_text = guidance_text.split('```')[1].split('```')[0].strip()

            guidance = json.loads(guidance_text)
            
            # Ensure message is concise
            if 'message' in guidance and len(guidance['message']) > 300:
                guidance['message'] = guidance['message'][:297] + "..."
                
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Raw response: {guidance_text}")
            guidance = {
                "step_status": "unknown",
                "message": guidance_text[:300] if len(guidance_text) > 300 else guidance_text
            }

        return jsonify({
            "success": True,
            "guidance": guidance,
            "expected_step": expected_step
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/checklist/<task_type>', methods=['GET'])
def get_checklist(task_type):
    """Get the onboarding checklist for a specific task"""
    checklist = ONBOARDING_CHECKLISTS.get(task_type)

    if not checklist:
        return jsonify({"error": "Invalid task type"}), 404

    return jsonify({
        "success": True,
        "checklist": checklist
    })


@app.route('/api/progress/<task_type>', methods=['POST'])
def update_progress(task_type):
    """Update and check progress against checklist"""
    try:
        data = request.json
        analysis = data.get('analysis')
        current_step = data.get('current_step', 1)

        checklist = ONBOARDING_CHECKLISTS.get(task_type)
        if not checklist:
            return jsonify({"error": "Invalid task type"}), 404

        expected_step = checklist['steps'][current_step - 1]

        # Check if step requirements are met
        step_complete = True
        missing_fields = []

        filled_fields = analysis.get('filled_fields', [])
        for required_field in expected_step['required_fields']:
            field_filled = any(required_field.lower() in field.lower() for field in filled_fields)
            if not field_filled:
                step_complete = False
                missing_fields.append(required_field)

        # Check for errors
        has_errors = len(analysis.get('errors_visible', [])) > 0

        progress = {
            "current_step": current_step,
            "total_steps": len(checklist['steps']),
            "step_complete": step_complete and not has_errors,
            "missing_fields": missing_fields,
            "has_errors": has_errors,
            "can_proceed": step_complete and not has_errors,
            "completion_percentage": (current_step / len(checklist['steps'])) * 100
        }

        return jsonify({
            "success": True,
            "progress": progress
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get analysis history"""
    return jsonify({
        "success": True,
        "history": analysis_history
    })


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "gemini_configured": bool(os.getenv('GEMINI_API_KEY'))
    })


if __name__ == '__main__':
    # Create uploads directory if it doesn't exist
    os.makedirs('uploads', exist_ok=True)
    app.run(debug=True, port=5001)
