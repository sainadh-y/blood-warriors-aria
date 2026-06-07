# Blood Warriors ARIA - Chatbot AI Agent Context

This document is designed to provide comprehensive context to any AI agent tasked with working on, upgrading, or integrating with the ARIA Donor Chatbot system.

---

## 1. System Overview
The Chatbot in the Blood Warriors ARIA platform handles donor inquiries (frontend) and WhatsApp automated responses (backend webhook). It relies on a **Two-Tiered Architecture**:
- **Tier 1 (Rule-Based)**: Extremely fast (`<10ms`) responses for standard interactions using regex and keyword matching.
- **Tier 2 (AWS Bedrock)**: Complex natural language queries are escalated to Anthropic Claude 3 Haiku via Amazon Bedrock.

## 2. Frontend Chatbot Interface (`DonorView.jsx`)

### 2.1 UI Component
The frontend chatbot lives inside a floating widget in the Donor Dashboard. 
- It maintains a `messages` array state holding objects like `{ text: "...", isBot: true/false }`.
- When a user sends a message, it is appended to the UI immediately, and an asynchronous `POST` request is sent to the backend.

### 2.2 Data Payload to Backend
When sending a query, the frontend sends a `POST` request to `/chat`.
**Endpoint**: `POST /chat`
**Payload structure**:
```json
{
  "message": "When am I eligible to donate next?",
  "donor_id": "don_001" 
}
```
*Note: `donor_id` is essential for personalized responses (e.g., looking up their blood type or cooldown dates).*

### 2.3 Expected Response from Backend
The frontend expects a response structured as:
```json
{
  "reply": "Your next eligible date is August 15, 2026. Hang tight! 🩸",
  "donor_context": {
    "blood_group": "O Positive",
    "coins": 100,
    "donations": 2
  }
}
```

---

## 3. Backend Implementation details (`server.js`)

### 3.1 Tier 1: Rule-Based Engine
For the `POST /chat` route, the backend currently checks for these keywords:
- `bridge` / `patient` -> Explains the Bridge Donor concept.
- `thalassemia` -> Explains the disease.
- `cooldown` / `wait` -> Explains the 90/120 day resting rules.
- `eligible` -> Returns `donor.next_eligible_date`.

### 3.2 Tier 2: Bedrock AI Integration (`classifyIntentWithBedrock`)
For complex queries (especially inside the WhatsApp Webhook), ARIA escalates the conversation to AWS Bedrock.

**AWS Bedrock Configuration Setup:**
- **SDK**: `@aws-sdk/client-bedrock-runtime`
- **Model ID**: `anthropic.claude-3-haiku-20240307-v1:0` (Haiku is used for speed/latency optimization).
- **Authentication**: Uses standard AWS SDK Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`).

**Bedrock Prompt Structure**:
If an agent needs to update the prompt logic, the system prompt injected into Bedrock currently looks like this:
```text
You are ARIA, an AI assistant for Blood Warriors. You sent an emergency blood request to the donor {donorName}. 
They just replied: "{donorMessage}"

Classify their intent into one of these categories:
1. "ACCEPT": They agree to donate
2. "CANCEL": They cannot donate
3. "PENDING": They are unsure
4. "QUESTION": They are asking for more information

Return a JSON object exactly like this:
{"intent": "ACCEPT|CANCEL|PENDING|QUESTION", "response": "Your customized reply to them"}
```

### 3.3 How to Upgrade/Extend the Bedrock System
If another agent needs to build *new* Bedrock capabilities (for example, allowing donors to schedule their own appointments via the web chat):
1. **Extend the payload**: The Bedrock prompt needs to be updated to include the donor's `donor_context` (coins, blood group, last donation).
2. **Update the system prompt**: Add a new intent category (e.g., `5. "SCHEDULE"`).
3. **Parse JSON Safely**: Bedrock responses must be parsed securely using regex `/\{[\s\S]*\}/` to extract the JSON block, avoiding Markdown formatting wrapper errors (e.g., removing ` ```json `).
