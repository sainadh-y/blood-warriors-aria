# Blood Warriors ARIA - API Documentation

Base URL: `http://localhost:3000` (Local) or `<Your-Beanstalk-URL>` (Production)

---

## 🟢 Health & Webhooks

### `GET /`
- **Purpose**: Health check route to verify the backend is running.
- **Returns**: A simple greeting string.

### `GET /api/webhook/whatsapp`
- **Purpose**: Verification endpoint required by Meta Developer Portal to subscribe to WhatsApp events.
- **Query Params**: `hub.mode`, `hub.verify_token`, `hub.challenge`

---

## 🩸 Core Entities

### `GET /donors/list`
- **Purpose**: Retrieves a fully enriched list of all donors in the system.
- **Returns**: Array of donor objects including their `callRatio`, `reliabilityScore`, `travelDistanceKm`, and `coins`.

### `POST /api/signup/donor`
- **Purpose**: Registers a new donor and automatically saves them to the backend database.
- **Body**: `{ name, email, password, bloodGroup, age, gender, location, lastDonation, consentBridge, phone }`
- **Returns**: The newly created `user` object.

### `GET /donors/patients/list`
- **Purpose**: Retrieves a list of all patients.
- **Returns**: Array of patient objects including `nextTransfusionDate`, `bridgeCycle`, and `emergencyMode` status.

### `GET /api/community`
- **Purpose**: Retrieves details about the connected community and hospital.
- **Returns**: JSON object with community details.

---

## 🤖 AI Matching & Requests

### `POST /request-blood`
- **Purpose**: Runs the Smart Matching algorithm to find the top 3 compatible donors based on Reliability, Proximity, and Experience.
- **Body**: `{ blood_group, urgency, patient_lat, patient_lon, top_n }`
- **Returns**: Array of `matched_donors` with an explainable `scoring_formula` breakdown for judges.

### `GET /api/requests`
- **Purpose**: Retrieves all active 3-slot blood requests.
- **Returns**: Array of enriched request objects containing data for `slot_1` (Main), `slot_2` (Backup), and `slot_3` (Emergency).

### `POST /api/requests`
- **Purpose**: Creates a new blood request and automatically auto-assigns 3 eligible donors to the slots.
- **Body**: `{ patient_id, blood_group, urgency }`
- **Returns**: The newly created request object.

### `POST /api/requests/:id/cancel/:slot`
- **Purpose**: Cancels a specific donor slot (1, 2, or 3) for a given request `id`, triggering the automated cascade logic (e.g., Backup becomes Main).
- **URL Params**: `id` (Request ID), `slot` (1, 2, or 3).
- **Returns**: Success message and the updated cascaded request object.

---

## 💬 WhatsApp & Chat

### `POST /chat`
- **Purpose**: Donor AI Chatbot endpoint. Uses rule-based logic for common queries (cooldown, eligible dates) and falls back to AWS Bedrock for complex NLP.
- **Body**: `{ message, donor_id }`
- **Returns**: `{ reply, donor_context }`

### `POST /api/dispatch`
- **Purpose**: Sends a WhatsApp Emergency Dispatch message to a specific donor.
- **Body**: `{ donorId, donorName, distance }`
- **Returns**: Success status.

### `POST /api/engage`
- **Purpose**: Sends an arbitrary custom WhatsApp message to a donor.
- **Body**: `{ donorName, messageText }`
- **Returns**: Success status.

---

## 📊 Analytics & Rewards

### `GET /admin/metrics`
- **Purpose**: Retrieves high-level dashboard statistics for the Admin panel.
- **Returns**: Totals for active donors, active bridges, emergency patients, and coins in the system.

### `GET /api/analytics/failures`
- **Purpose**: Retrieves analytics on donor cancellations/failures segmented by Time of Day, Day of Week, and Donor Experience level.
- **Returns**: Aggregated failure logs and actionable AI recommendations.

### `GET /donors/wallet/ledger`
- **Purpose**: Retrieves a history of ARIA Coins earned by donors for donations and bridge bonuses.
- **Returns**: Array of ledger entries (Type, Amount, Reason).
