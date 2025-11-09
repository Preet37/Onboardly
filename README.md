# Onboardly - 🏆 Cal Hacks 12.0 Best Workflow App

AI-powered onboarding platform that uses vision analysis to guide users through complex workflows in real-time.

## Overview

Onboardly combines AI vision analysis with intelligent coaching to create interactive onboarding experiences. It monitors user screens, understands context, and provides step-by-step guidance for tasks like GCP setup, Jira workflows, and custom onboarding processes.

### Key Features

- **AI Vision Coaching** - Real-time screenshot analysis using Gemini Vision AI
- **Multi-Platform** - Chrome extension + browser-agnostic embeddable widget
- **Workflow Visualization** - Beautiful 3D visualizations and interactive DAGs
- **Intelligent Guidance** - Context-aware, step-by-step instructions
- **Automated Tracking** - Progress monitoring and completion verification
- **Integration Ready** - Works with GCP, Jira, SendGrid, and custom apps

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│         React + Vite + Three.js + Tailwind CSS              │
│   (Workflow Visualization, Onboarding Dashboard)             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      Backend API                             │
│           Node.js + Express + AI Services                    │
│   • Gemini Vision AI (screenshot analysis)                   │
│   • Groq/OpenAI (workflow generation)                        │
│   • Jira, SendGrid, GCP integrations                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌─────────▼──────────┐
│ Chrome Extension│          │  Embeddable Widget │
│  (GCP Console)  │          │   (Any Browser)    │
│  • Screenshot   │          │   • Screen Capture │
│  • Auto-coach   │          │   • Drop-in JS     │
└─────────────────┘          └────────────────────┘
```

## Components

### 1. Backend (`/backend`)

Node.js/Express API server with AI integrations.

**Tech Stack:**
- Express.js
- Gemini Vision AI (Google)
- Groq/OpenAI (workflow generation)
- SendGrid (email notifications)
- Jira API integration

**Key Endpoints:**
- `POST /generate-workflow-dag` - Generate workflow from natural language
- `POST /analyze-screenshot` - AI vision analysis of user screens
- `POST /track-event` - Track onboarding events
- `GET /workflow-progress` - Get real-time progress updates (SSE)

**Setup:**
```bash
cd backend
npm install
cp .env.example .env  # Add your API keys
node index.js
```

Required environment variables:
```
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
SENDGRID_API_KEY=your_sendgrid_key
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER_EMAIL=your_email
JIRA_API_TOKEN=your_jira_token
```

### 2. Frontend (`/frontend`)

React visualization dashboard with 3D workflow representations.

**Tech Stack:**
- React 18
- Vite
- Three.js + React Three Fiber
- Tailwind CSS
- D3.js + Recharts
- Framer Motion

**Features:**
- 3D neural network visualization
- Interactive workflow DAG
- Real-time onboarding progress
- Live activity monitoring
- AI insights panel

**Setup:**
```bash
cd frontend
npm install
npm run dev  # Starts on http://localhost:5173
```

### 3. Chrome Extension (`/extension`)

Chrome extension for AI-powered coaching on GCP Console.

**Features:**
- Auto-capture screenshots every 5 seconds
- Real-time AI guidance overlay
- Step-by-step task validation
- Automatic progress tracking

**Setup:**
1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `/extension` folder

See [extension/README.md](extension/README.md) for detailed instructions.

### 4. Embeddable Widget (`/webapp`)

Browser-agnostic JavaScript widget for any web application.

**Features:**
- Pure JavaScript (no framework dependencies)
- Screen Capture API for cross-browser support
- Drop-in integration (`<script>` tag)
- Configurable positioning and behavior

**Quick Start:**
```html
<script src="ai-coach-widget.js"></script>
<script>
  AICoach.init({
    apiUrl: 'http://localhost:3000',
    taskType: 'gcp_storage',
    captureInterval: 5000
  });
</script>
```

See [webapp/README.md](webapp/README.md) for integration guide.

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd Onboardly

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

Create `backend/.env`:
```bash
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
SENDGRID_API_KEY=your_sendgrid_key
PORT=3000
```

### 3. Start Services

Terminal 1 - Backend:
```bash
cd backend
node index.js
# Backend runs on http://localhost:3000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### 4. Choose Your Integration

**Option A: Chrome Extension** (for GCP Console)
- Load extension in Chrome
- Navigate to GCP Console
- Click extension icon to activate

**Option B: Embeddable Widget** (for any webapp)
- Serve webapp files
- Open `http://localhost:8080/demo.html`
- Click "Start Monitoring"

## Use Cases

### GCP Onboarding
Guide users through Google Cloud Platform setup:
- Create Storage Buckets
- Deploy Cloud Functions
- Configure IAM permissions

### Jira Workflow Training
Teach team members Jira workflows:
- Create and assign issues
- Use custom fields
- Follow approval processes

### Custom Workflows
Create any onboarding experience:
- SaaS product tours
- Internal tool training
- Compliance procedures

## Development

### Project Structure

```
Onboardly/
├── backend/              # Node.js API server
│   ├── index.js         # Main server file
│   ├── package.json
│   └── .env             # API keys (create from .env.example)
│
├── frontend/            # React visualization app
│   ├── src/
│   │   ├── OnboardingApp.jsx    # Onboarding flow UI
│   │   ├── OnboardlyApp.jsx     # Main dashboard
│   │   └── components/          # React components
│   └── package.json
│
├── extension/           # Chrome extension
│   ├── manifest.json
│   ├── background.js    # Screenshot capture
│   └── inject-panel.js  # Content script + UI
│
└── webapp/              # Embeddable widget
    ├── ai-coach-widget.js   # Widget implementation
    ├── ai-coach-widget.css  # Widget styles
    └── demo.html            # Demo page
```

### Adding New Tasks

Define new onboarding tasks in the backend workflow generator:

```javascript
// backend/index.js - Add to task definitions
const taskDefinitions = {
  'your_task': {
    name: 'Your Custom Task',
    steps: [
      { instruction: 'Step 1', type: 'action' },
      { instruction: 'Step 2', type: 'verification' }
    ]
  }
};
```

### API Documentation

#### Generate Workflow
```http
POST /generate-workflow-dag
Content-Type: application/json

{
  "prompt": "Create a workflow for deploying a Docker container"
}
```

#### Analyze Screenshot
```http
POST /analyze-screenshot
Content-Type: application/json

{
  "screenshot": "data:image/png;base64,...",
  "taskType": "gcp_storage",
  "currentStep": 1,
  "email": "user@example.com"
}
```

#### Track Event
```http
POST /track-event
Content-Type: application/json

{
  "email": "user@example.com",
  "eventType": "extension_activated",
  "taskType": "gcp_storage"
}
```

## Browser Compatibility

| Component | Chrome | Firefox | Safari | Edge |
|-----------|--------|---------|--------|------|
| Frontend | ✅ | ✅ | ✅ | ✅ |
| Extension | ✅ | ❌ | ❌ | ✅* |
| Widget | ✅ | ✅ | ✅ | ✅ |

*Edge supports Chrome extensions with minor modifications

## Deployment

### Backend Deployment

```bash
# Build and deploy to your preferred platform
# (Heroku, AWS, Google Cloud, etc.)

# Example: Deploy to Heroku
heroku create your-app-name
heroku config:set GEMINI_API_KEY=your_key
git push heroku main
```

### Frontend Deployment

```bash
cd frontend
npm run build
# Deploy dist/ folder to Netlify, Vercel, etc.
```

### Production Checklist

- [ ] Set production API URLs
- [ ] Configure CORS for your domains
- [ ] Enable HTTPS (required for Screen Capture API)
- [ ] Set up rate limiting
- [ ] Configure logging and monitoring
- [ ] Minify widget assets
- [ ] Test on all target browsers

## Security

- All API keys stored in environment variables
- CORS configured for specific origins
- No sensitive data in screenshots (configurable masking)
- Screenshot data not persisted on backend
- Secure HTTPS required in production

## Performance

- Screenshot capture: ~50KB per image (JPEG compressed)
- Analysis latency: 1-3 seconds (Gemini Vision API)
- Frontend bundle: ~500KB (optimized)
- Widget size: ~50KB (minified)

## Troubleshooting

### Backend not starting
- Verify Node.js version (v18+ recommended)
- Check `.env` file exists with valid API keys
- Ensure port 3000 is available

### Screenshots not capturing
- Chrome extension: Reload extension after code changes
- Widget: Grant screen sharing permission
- Check CORS configuration
- Verify backend is running

### AI analysis not working
- Validate Gemini API key
- Check API quotas/rate limits
- Review backend logs for errors
- Test with smaller images

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: See component-specific READMEs
  - [Chrome Extension](extension/README.md)
  - [Embeddable Widget](webapp/README.md)
- **Issues**: Open an issue on GitHub
- **Email**: support@yourcompany.com

## Roadmap

- [ ] Firefox extension support
- [ ] Safari extension support
- [ ] Slack integration for team notifications
- [ ] Custom branding options
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app support
- [ ] Workflow templates marketplace

---

**Built with AI** using Gemini Vision, Groq, and modern web technologies.
