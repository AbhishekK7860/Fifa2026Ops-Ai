# StadiumOps AI Dashboard

StadiumOps AI is an intelligent, real-time stadium operations dashboard designed to monitor and manage crowd control, gate capacity, and incident response for large-scale events. It combines real-time data visualization with AI-driven analysis to provide actionable insights for stadium volunteers.

## Features

### 1. CSV Data Ingestion & Validation
The application allows users to upload live operational data via CSV. 
* **Validation Rules**: Strict Zod schemas validate the data structure, ensuring all required columns (e.g., Gate, Capacity, Current Visitors) are present.
* **Limits**: Validates file size and enforces a maximum of 500 rows per upload to prevent memory exhaustion and abuse.
* **MIME Checking**: Enforces `text/csv` MIME types on both the client side and the server side.
* **Load Demo Dataset**: A built-in feature to load a comprehensive demo dataset instantly for evaluation and training purposes, bypassing the manual upload flow.

### 2. Explainable AI Analysis
When a gate is selected, the application queries an LLM to generate an explainable, real-time assessment of the gate's status. The output is strictly typed into six core fields:
1. **Observation**: A concise summary of the current situation.
2. **Reasoning**: The logical breakdown of why the situation requires attention, citing data.
3. **Recommended Action**: A concrete, actionable step for the volunteer to take.
4. **Expected Impact**: The projected outcome of the recommended action.
5. **Confidence Level**: A 0-100 score indicating the AI's certainty, explicitly clamped to local confidence bounds (determined by data recency and quality), alongside the basis for the score.
6. **Source Data Traceability**: Explicit references to the exact data points that drove the conclusion.

### 3. Multilingual Announcements
To assist volunteers in a diverse environment, the AI generates public announcements dynamically translated into English (EN), Spanish (ES), and French (FR), accessible via a tabbed interface.

### 4. Offline Analysis Mode
Stadium environments often suffer from poor connectivity. If the AI endpoint fails, times out, or the application loses network access, the system automatically falls back to **Offline Analysis Mode**. This mode uses deterministic, rule-based heuristics to generate the exact same analysis schema without relying on the LLM, ensuring zero disruption to operations.

### 5. Security & Rate Limiting
* **Rate Limiting**: The application implements IP-based rate limiting to prevent abuse and control API costs:
  * `/api/analyze`: 30 requests per 60 seconds (burst limit) and 100 requests per 24 hours (daily limit).
  * `/api/upload`: 5 requests per 60 seconds.
* **No-CAPTCHA Rationale**: CAPTCHAs introduce significant friction in high-stress operational environments where volunteers wear gloves or operate under urgency. Instead of CAPTCHAs, we rely on strict payload validation, request rate limiting, and maximum row caps.
* **Prompt Injection Detection**: A dedicated checkpoint scans incoming user queries for prompt injection attempts (e.g., "ignore previous instructions") and blocks them instantly.

### 6. Supabase Persistence (Optional)
The core application runs fully in-memory and does **not** require a database to function. However, if configured, it connects to Supabase to maintain two specific tables with differing Row Level Security (RLS) postures:
* `upload_audits`: Tracks file uploads (filename, row count, timestamp) for volumetric analysis. RLS allows anonymous inserts and selects, but no updates or deletes.
* `security_events`: Logs blocked prompt injection attempts and malicious inputs for security auditing. RLS allows anonymous inserts, but read access is restricted to authenticated admins only.

### 7. Accessibility (a11y)
The application strictly adheres to WCAG standards:
* Full keyboard navigation (focus rings, accessible tabs, and semantic HTML).
* ARIA labels on all interactive elements.
* Color contrast ratios verified against both light and dark modes.
* A fully functional Theme Toggle (Light/Dark/System) built into the header.

### 8. Export Functionality
Volunteers can export the complete AI analysis (including the multilingual announcements and recommended actions) as a downloadable PDF report or JSON file for post-incident reviews or handoffs.

---

## Setup Instructions

### Prerequisites
* Node.js 18+
* npm

### Installation
```bash
npm install
```

### Environment Variables
Create a `.env.local` file in the root directory. The following variables are used by the application. **All are technically optional** as the app will gracefully degrade (e.g., using Offline Mode or in-memory logs if services are missing), but they are required for full functionality.

| Variable | Description | Required for Full Functionality |
|----------|-------------|---------------------------------|
| `OPENROUTER_API_KEY` | API key for OpenRouter to power the AI Analysis (Gemini 2.5 Flash). | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL for audit logging. | No (Optional) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key for audit logging. | No (Optional) |

### Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
```bash
npm run build
npm run start
```

## Deployment
The application is optimized for Vercel. 
1. Connect your repository to Vercel.
2. Add the environment variables (`OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel dashboard.
3. Deploy. The application uses Next.js App Router and edge-compatible API routes.
