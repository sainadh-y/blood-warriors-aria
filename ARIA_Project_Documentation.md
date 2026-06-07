# Blood Warriors ARIA - Comprehensive Project Documentation

## 1. Project Overview
**ARIA** (Automated Response & Intelligence Assistant) is a comprehensive, AI-powered blood donation management platform designed for the "Blood Warriors" community. The system is built to minimize manual intervention, optimize donor matching, handle emergency dispatches, and provide a seamless WhatsApp-native experience for donors alongside a modern React dashboard for hospital admins.

## 2. Technical Architecture
The platform operates on a completely serverless, cloud-native AWS architecture:
- **Frontend**: React.js (built with Vite) hosted on **AWS Amplify**.
- **Backend API**: Node.js/Express.js hosted on **AWS Elastic Beanstalk** (Node.js 18 Amazon Linux 2023 environment).
- **API Gateway**: Used as an HTTPS proxy (`https://csncksah8a.execute-api.us-east-1.amazonaws.com/prod`) to route traffic to the Elastic Beanstalk environment.
- **Database**: Local JSON persistence (`accounts.json`, `requests.json`, etc.) designed to simulate a NoSQL document database (like MongoDB/DynamoDB) without requiring external setup.
- **AI/NLP Engine**: **Amazon Bedrock** (Anthropic Claude models) used for complex intent classification and donor chatbot interactions.

---

## 3. Backend Implementation Details
**Core Framework**: Node.js with Express (`server.js`)
**Port Configuration**: Binds to `0.0.0.0:8080` (or dynamic `PORT`) to interface perfectly with Elastic Beanstalk's Nginx reverse proxy.

### Core Systems:
1. **Smart Matching Algorithm (`POST /request-blood`)**
   - Matches donors using a weighted scoring formula based on three factors:
     - **Reliability (40%)**: Ratio of successful donations to total calls.
     - **Proximity (30%)**: Simulated geolocation matching using mock distances.
     - **Experience (30%)**: Historical donation count and lifetime ARIA coins.

2. **The 3-Slot Assignment System (`POST /api/requests`)**
   - When a patient needs blood, ARIA automatically assigns the top 3 compatible donors to specific roles:
     - **Slot 1 (Main)**: The primary donor expected to fulfill the request.
     - **Slot 2 (Backup)**: On standby.
     - **Slot 3 (Emergency)**: Failsafe donor.
   - **Cascade Logic**: If the Main donor cancels via WhatsApp, the Backup donor is instantly promoted to Main, the Emergency becomes Backup, and ARIA triggers automatic WhatsApp dispatches.

3. **WhatsApp Meta Webhook Integration (`/api/webhook/whatsapp`)**
   - **Verification**: strict `GET` handler verifying `hub.challenge` against the `ARIA_HACKATHON_TOKEN`.
   - **Messaging**: Listens for incoming WhatsApp texts. ARIA uses a two-tier classification system:
     1. **Rule-Based**: Checks for standard replies ("YES", "NO", "hello") for immediate `<100ms` response times.
     2. **LLM Fallback (Bedrock)**: If the user asks complex questions ("When can I donate next?"), the prompt is forwarded to AWS Bedrock for NLP processing using the donor's context.

4. **Automated Cron Jobs**
   - **T-10 Day Reminders**: Sweeps the database every minute to find patient transfusions scheduled in the next 10 days and sends WhatsApp reminders.
   - **T-5 Day Auto-Promotion**: If a Main donor hasn't responded by T-5 days, ARIA automatically marks them as a "Failure/No Response", logs it to analytics, and automatically promotes the Backup donor.

---

## 4. Frontend Implementation Details
**Framework**: React (Vite) + TailwindCSS styled utility classes
**Routing**: Built natively (or using React Router) providing multiple views.

### Core Components:
1. **Admin Dashboard (`App.jsx` & `AdminMetrics.jsx`)**
   - Displays real-time aggregate statistics: Total Active Donors, Active Bridges (recurring needs), and Emergency Patients.
   - **State Management**: Uses asynchronous data fetching from the AWS API Gateway (`src/data/api.js`).

2. **Donor & Patient Management (`DonorView.jsx`, `PatientView.jsx`)**
   - Displays fully enriched tables of Donors and Patients.
   - Includes real-time indicators for "Eligibility" based on the 90-day cooldown rules.
   - Allows manual interaction like triggering an emergency AI WhatsApp dispatch.

3. **Smart Matching Interface (`MatchResultsCard.jsx`)**
   - Visually renders the AI's weighted scoring logic so human operators understand *why* ARIA picked a specific donor (Explainable AI).

4. **API Interface Layer (`src/data/api.js`)**
   - Centralized fetch wrapper that communicates with the `API_BASE`.
   - Supports CORS and seamlessly handles JSON serialization/deserialization.

---

## 5. Security & Deployment Posture
1. **GitHub Version Control**
   - The entire codebase is version-controlled via GitHub (`https://github.com/sainadh-y/blood-warriors-aria`).
2. **AWS Amplify Setup (`amplify.yml`)**
   - Custom build specification telling AWS to use `npm ci`, run Vite's `npm run build`, and serve the compiled React artifacts from the `dist/` folder.
3. **AWS Elastic Beanstalk**
   - Uses a packaged `deploy.zip` containing `server.js`, `package.json`, and the `data/` folder.
   - Environment variables (like `WHATSAPP_TOKEN` and `AWS_REGION`) are securely injected via the AWS Console configuration, keeping secrets out of version control.

---

## 6. API Endpoint Summary
- `GET /` - Health Check
- `GET /api/webhook/whatsapp` - Meta Verification
- `POST /api/webhook/whatsapp` - Inbound message processing
- `GET /donors/list` - Fetch all donors
- `POST /api/signup/donor` - Self-service registration
- `GET /donors/patients/list` - Fetch all patients
- `POST /request-blood` - Trigger Smart AI Matching
- `GET /api/requests` - View active 3-slot requests
- `POST /api/requests/:id/cancel/:slot` - Trigger cascade logic
- `GET /admin/metrics` - Fetch dashboard stats
- `POST /chat` - Interactive AI Bot testing
- `POST /api/dispatch` - Trigger emergency WhatsApp notification

---
*Generated by ARIA AI Assistant on June 6, 2026*
