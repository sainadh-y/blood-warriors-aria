require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// =============================================
// ENV CONFIGURATION
// =============================================
const WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.META_PHONE_NUMBER_ID || '';
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '916304230058';
const WHATSAPP_VERIFY_TOKEN = 'ARIA_HACKATHON_TOKEN';
const PORT = process.env.PORT || 3000;

// =============================================
// AWS BEDROCK CLIENT
// =============================================
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// =============================================
// DATA LOADING (JSON-based, no CSV)
// =============================================
const ACCOUNTS_PATH = './data/accounts.json';
const REQUESTS_PATH = './data/requests.json';
const FAILURE_LOG_PATH = './data/failure_log.json';
const CONVERSATIONS_PATH = './data/conversations.json';
const PENDING_DISPATCHES_PATH = './data/pending_dispatches.json';

let accountsData = {};
let requestsData = { requests: [] };
let failureLog = { failures: [] };
let conversations = {};

function loadJSON(path, fallback) {
  try {
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, 'utf-8'));
  } catch (e) { console.error(`Failed to load ${path}:`, e.message); }
  return fallback;
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// Load all data on startup
accountsData = loadJSON(ACCOUNTS_PATH, { community: {}, patients: [], donors: [] });
requestsData = loadJSON(REQUESTS_PATH, { requests: [] });
failureLog = loadJSON(FAILURE_LOG_PATH, { failures: [] });
conversations = loadJSON(CONVERSATIONS_PATH, {});

console.log(`[ARIA] Loaded ${accountsData.donors?.length || 0} donors, ${accountsData.patients?.length || 0} patients`);

function loadPendingDispatches() {
  return loadJSON(PENDING_DISPATCHES_PATH, {});
}
function savePendingDispatches(data) {
  saveJSON(PENDING_DISPATCHES_PATH, data);
}

// =============================================
// HAVERSINE DISTANCE
// =============================================
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =============================================
// SMART DONOR SCORING (Section 1 of Spec)
// Score = (Reliability × 0.4) + (Proximity × 0.3) + (Experience × 0.3)
// =============================================
function computeDonorScore(donor, patientLat, patientLng) {
  // ① Reliability = successful_donations / total_calls (0.0 to 1.0)
  const reliability = donor.total_calls > 0
    ? donor.successful_donations / donor.total_calls
    : 0.5;

  // ② Proximity = 1 / (distance_km + 1)
  const dist_km = haversine(patientLat, patientLng, donor.location.lat, donor.location.lng);
  const proximity = 1 / (dist_km + 1);

  // ③ Experience (tiered)
  let experience;
  if (donor.total_donations === 0) {
    experience = 0.1; // Grace score for new donors
  } else if (donor.total_donations <= 10) {
    experience = donor.total_donations / 10.0;
  } else {
    experience = 1.0; // Diminishing returns capped at 1.0
  }

  const score = (reliability * 0.4) + (proximity * 0.3) + (experience * 0.3);

  return {
    score: parseFloat(score.toFixed(4)),
    breakdown: {
      reliability: parseFloat(reliability.toFixed(3)),
      proximity: parseFloat(proximity.toFixed(3)),
      experience: parseFloat(experience.toFixed(3)),
      distance_km: parseFloat(dist_km.toFixed(2))
    }
  };
}

// =============================================
// RESPONSE CLASSIFICATION — Tier 1: Rule-Based
// =============================================
function classifyIntentRuleBased(message) {
  const msg = message.toLowerCase().trim();
  const acceptWords = ['confirm', 'yes', 'ok', 'ready', 'sure', 'available', 'coming', 'on my way', 'will do', 'accepted', 'i can'];
  const cancelWords = ["can't", 'cancel', 'not available', 'no', 'busy', 'unable', 'sorry', 'decline', 'far away', "won't"];
  const pendingWords = ['maybe', 'not sure', 'will check', 'let me think', 'possibly', 'might'];
  const unavailablePatterns = [
    { pattern: /traveling in (\w+)/i, extract: (m) => ({ type: 'MARK_UNAVAILABLE', period: m[1] }) },
    { pattern: /out of town/i, extract: () => ({ type: 'MARK_UNAVAILABLE', period: 'unknown' }) },
    { pattern: /next month/i, extract: () => ({ type: 'MARK_UNAVAILABLE', period: 'next_month' }) }
  ];

  // Check unavailability patterns first
  for (const { pattern, extract } of unavailablePatterns) {
    const match = msg.match(pattern);
    if (match) return { intent: 'UNAVAILABLE', confidence: 0.9, ...extract(match) };
  }

  // Count keyword matches
  const acceptScore = acceptWords.filter(w => msg.includes(w)).length;
  const cancelScore = cancelWords.filter(w => msg.includes(w)).length;
  const pendingScore = pendingWords.filter(w => msg.includes(w)).length;

  const maxScore = Math.max(acceptScore, cancelScore, pendingScore);
  if (maxScore === 0) return { intent: 'UNKNOWN', confidence: 0.0 };

  if (acceptScore > cancelScore && acceptScore > pendingScore) {
    return { intent: 'ACCEPT', confidence: Math.min(acceptScore * 0.3 + 0.5, 1.0) };
  }
  if (cancelScore > acceptScore && cancelScore > pendingScore) {
    return { intent: 'CANCEL', confidence: Math.min(cancelScore * 0.3 + 0.5, 1.0) };
  }
  return { intent: 'PENDING', confidence: Math.min(pendingScore * 0.3 + 0.4, 0.8) };
}

// =============================================
// RESPONSE CLASSIFICATION — Tier 2: Bedrock Fallback
// =============================================
async function classifyIntentWithBedrock(donorMessage, donorName) {
  try {
    const prompt = `You are ARIA, an AI assistant for Blood Warriors. You sent an emergency blood request to the donor ${donorName}. 
They just replied: "${donorMessage}"

Classify their intent into one of these categories:
1. "ACCEPT": They agree to donate
2. "CANCEL": They cannot donate
3. "PENDING": They are unsure
4. "QUESTION": They are asking for more information

Return a JSON object exactly like this:
{"intent": "ACCEPT|CANCEL|PENDING|QUESTION", "response": "Your customized reply to them"}

Keep the response under 2 sentences. Do not output anything other than JSON.`;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }]
    };

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);
    const resultText = JSON.parse(new TextDecoder().decode(response.body)).content[0].text;
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { intent: "QUESTION", response: "Thank you for your reply. An ARIA coordinator will get back to you shortly." };
  } catch (error) {
    console.error("Bedrock Intent Classification Error:", error);
    return { intent: "QUESTION", response: "Thank you. We have received your message." };
  }
}

// Two-tier classification
async function classifyResponse(message, donorName) {
  const ruleResult = classifyIntentRuleBased(message);
  if (ruleResult.confidence >= 0.8) {
    console.log(`[Tier 1] Rule-based classification: ${ruleResult.intent} (confidence: ${ruleResult.confidence})`);
    return { intent: ruleResult.intent, response: getAutoResponse(ruleResult.intent, donorName), tier: 1 };
  }
  console.log(`[Tier 1] Low confidence (${ruleResult.confidence}), escalating to Tier 2 (Bedrock)...`);
  const bedrockResult = await classifyIntentWithBedrock(message, donorName);
  return { ...bedrockResult, tier: 2 };
}

function getAutoResponse(intent, donorName) {
  switch (intent) {
    case 'ACCEPT': return `Thank you so much, ${donorName}! 🙏 Your confirmation has been recorded. Please head to Apollo Hospital, Jubilee Hills. A patient is counting on you!`;
    case 'CANCEL': return `We understand, ${donorName}. Thank you for letting us know. We'll find another donor. Take care! ❤️`;
    case 'PENDING': return `No worries, ${donorName}. Please let us know as soon as you can — a patient is waiting. We'll check back with you.`;
    case 'UNAVAILABLE': return `Thank you for informing us, ${donorName}. We've noted your unavailability and won't disturb you during that period.`;
    default: return `Thank you, ${donorName}. We have received your message.`;
  }
}

// =============================================
// PREFERENCE EXTRACTION (Section 5 — Rule-Based NLP)
// =============================================
function extractPreferences(message) {
  const msg = message.toLowerCase();
  const prefs = {};

  if (msg.includes('traveling in november') || msg.includes('next month')) {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNext = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    prefs.unavailable_dates = [`${nextMonth.toISOString().split('T')[0]} to ${endOfNext.toISOString().split('T')[0]}`];
  }
  if (msg.includes('only weekends')) prefs.preferred_days = ["Saturday", "Sunday"];
  if (msg.includes('after 6pm')) prefs.preferred_time = "18:00-23:59";
  if (msg.includes('not on tuesdays')) prefs.blocked_days = ["Tuesday"];
  if (msg.includes('mornings only')) prefs.preferred_time = "06:00-12:00";

  return Object.keys(prefs).length > 0 ? prefs : null;
}

// =============================================
// BEDROCK LLM — Follow-up Message Generation
// =============================================
async function invokeBedrockLLM(donorId, donorName) {
  try {
    const donor = accountsData.donors.find(d => d.donor_id === donorId);
    let context = "";
    if (donor) {
      context = `Their blood group is ${donor.blood_type}, and they have made ${donor.total_donations} past donations.`;
    }

    const prompt = `You are ARIA, an AI assistant for Blood Warriors. You sent an emergency blood dispatch request to ${donorName} yesterday, but they haven't replied. ${context} Write a very brief (2 sentences max), highly personalized, and persuasive follow-up message asking them if they can still help the patient. Be extremely polite and urgent. Do not include placeholders or signature.`;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }]
    };

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content[0].text;
  } catch (error) {
    console.error("Bedrock LLM Error:", error);
    return `Hi ${donorName}, we still urgently need your help. Are you available? - ARIA`;
  }
}

// =============================================
// WHATSAPP MESSAGING
// =============================================
async function sendWhatsAppMessage(toPhone, messageText) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log("[WhatsApp] Skipped: Missing META_WHATSAPP_TOKEN or META_PHONE_NUMBER_ID in .env");
    return false;
  }
  try {
    const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;
    const data = {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: messageText }
    };
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("[WhatsApp] Message sent:", response.data);
    return true;
  } catch (error) {
    console.error("[WhatsApp] Error:", error.response ? error.response.data : error.message);
    return false;
  }
}

// =============================================
// EXPRESS APP SETUP
// =============================================
const app = express();
app.use(cors());
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log(`[${time}] Body:`, req.body);
  }
  next();
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ARIA backend is running', health: 'ok' });
});

// =============================================
// BLOOD COMPATIBILITY MAP
// =============================================
const BLOOD_COMPATIBILITY = {
  "O Negative": ["O Negative", "O Positive", "A Negative", "A Positive", "B Negative", "B Positive", "AB Negative", "AB Positive"],
  "O Positive": ["O Positive", "A Positive", "B Positive", "AB Positive"],
  "A Negative": ["A Negative", "A Positive", "AB Negative", "AB Positive"],
  "A Positive": ["A Positive", "AB Positive"],
  "B Negative": ["B Negative", "B Positive", "AB Negative", "AB Positive"],
  "B Positive": ["B Positive", "AB Positive"],
  "AB Negative": ["AB Negative", "AB Positive"],
  "AB Positive": ["AB Positive"]
};

// =============================================
// ENDPOINT: Sign Up Donor
// =============================================
app.post('/api/signup/donor', (req, res) => {
  const { name, email, password, bloodGroup, age, gender, location, lastDonation, consentBridge, phone } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const newDonor = {
    donor_id: "donor_" + Date.now(),
    name: name,
    phone: phone,
    email: email,
    password: password,
    blood_type: bloodGroup || "O Positive",
    age: age || 25,
    gender: gender || "Male",
    location: { lat: 17.4325, lng: 78.4673 }, // Default to Jubilee Hills
    total_donations: 0,
    successful_donations: 0,
    total_calls: 0,
    call_ratio: 0.00,
    reliability_score: 50, // Starting score
    coins: 100, // Sign-up bonus
    preferred_days: [],
    blocked_dates: [],
    community_id: "comm_hyd_01",
    role: consentBridge ? "bridge_donor" : "volunteer",
    active_status: true,
    eligibility_status: "eligible",
    next_eligible_date: null,
    bridge_patient_id: null,
    donor_type: "New Donor",
    last_donation_date: lastDonation || null,
    last_message_at: null
  };

  accountsData.donors.push(newDonor);
  saveJSON(ACCOUNTS_PATH, accountsData);

  const frontendDonor = {
    id: newDonor.donor_id,
    name: newDonor.name,
    phone: newDonor.phone,
    bloodGroup: newDonor.blood_type,
    age: newDonor.age,
    gender: newDonor.gender,
    canDonate: true,
    activeStatus: 'Active',
    totalDonations: 0,
    successfulDonations: 0,
    totalCalls: 0,
    callRatio: 0,
    coins: 100,
    role: newDonor.role,
    donorType: newDonor.donor_type,
    reliabilityScore: 50,
    preferredDays: [],
    blockedDates: [],
    travelDistanceKm: "0.0",
    preferredDonationTime: 'Any',
    nextEligibleDate: null,
    assignedPatientId: null,
    lastDonationDate: newDonor.last_donation_date
  };

  res.json({ message: 'Signup successful', user: frontendDonor });
});

// =============================================
// ENDPOINT: List All Donors
// =============================================
app.get('/donors/list', (req, res) => {
  const donors = accountsData.donors.map(d => ({
    id: d.donor_id,
    name: d.name,
    phone: d.phone,
    bloodGroup: d.blood_type,
    age: d.age,
    gender: d.gender,
    canDonate: d.eligibility_status === 'eligible',
    activeStatus: d.active_status ? 'Active' : 'Inactive',
    totalDonations: d.total_donations,
    successfulDonations: d.successful_donations,
    totalCalls: d.total_calls,
    callRatio: d.call_ratio,
    coins: d.coins,
    role: d.role,
    donorType: d.donor_type,
    reliabilityScore: d.reliability_score,
    preferredDays: d.preferred_days,
    blockedDates: d.blocked_dates,
    travelDistanceKm: haversine(
      accountsData.patients[0]?.location?.lat || 17.4325,
      accountsData.patients[0]?.location?.lng || 78.4673,
      d.location.lat, d.location.lng
    ).toFixed(1),
    preferredDonationTime: d.preferred_days.length > 0 ? d.preferred_days.join(', ') : 'Any',
    nextEligibleDate: d.next_eligible_date,
    assignedPatientId: d.bridge_patient_id,
    lastDonationDate: d.last_donation_date
  }));

  res.json({ donors, total: donors.length });
});

// =============================================
// ENDPOINT: List All Patients
// =============================================
app.get('/donors/patients/list', (req, res) => {
  const patients = accountsData.patients.map(p => ({
    id: p.patient_id,
    name: p.name,
    phone: p.phone,
    bloodGroup: p.blood_type,
    age: p.age,
    gender: p.gender,
    condition: p.condition,
    preferredHospital: p.hospital,
    nextTransfusionDate: p.next_expected_transfusion,
    lastTransfusionDate: p.last_transfusion_date,
    lastTransfusionHb: p.last_hemoglobin,
    emergencyMode: p.bridge_donors.length < 4,
    bridgeCycle: p.bridge_donors,
    currentBridgeCount: p.bridge_donors.length,
    requiredBridgesPerMonth: 4,
    cycleIndex: 0,
    skipCount: {},
    status: p.status,
    medicalNotes: p.medical_notes,
    medicalHistory: p.medical_notes
  }));

  res.json({ patients, total: patients.length });
});

// =============================================
// ENDPOINT: Smart Donor Matching (Top 3, Explainable)
// =============================================
app.post('/request-blood', (req, res) => {
  const { blood_group, urgency, patient_lat = 17.4325, patient_lon = 78.4673, top_n = 3 } = req.body;

  // Find compatible blood groups that can DONATE to this patient
  const compatible_donor_groups = Object.keys(BLOOD_COMPATIBILITY)
    .filter(bg => BLOOD_COMPATIBILITY[bg].includes(blood_group));

  // Filter eligible donors
  let pool = accountsData.donors.filter(d =>
    compatible_donor_groups.includes(d.blood_type) &&
    d.eligibility_status === 'eligible' &&
    d.active_status === true
  );

  // Score each donor
  pool = pool.map(d => {
    const { score, breakdown } = computeDonorScore(d, patient_lat, patient_lon);
    return {
      donor_id: d.donor_id,
      name: d.name,
      blood_group: d.blood_type,
      phone: d.phone,
      score,
      breakdown,
      eligible: true,
      distance_km: breakdown.distance_km,
      total_donations: d.total_donations,
      successful_donations: d.successful_donations,
      total_calls: d.total_calls,
      role: d.role,
      donor_type: d.donor_type,
      reliability_score: d.reliability_score,
      // Explainability string for judges
      explanation: `Scored ${score.toFixed(2)} because: reliability=${breakdown.reliability.toFixed(2)} (${d.successful_donations}/${d.total_calls} calls), ${breakdown.distance_km}km away (proximity=${breakdown.proximity.toFixed(2)}), ${d.total_donations} donations (experience=${breakdown.experience.toFixed(2)}${d.total_donations === 0 ? ' [grace score]' : ''})`
    };
  });

  // Sort by score descending, take top N
  pool.sort((a, b) => b.score - a.score);
  const matched = pool.slice(0, top_n);

  res.json({
    request_id: "req_" + Date.now().toString(36),
    blood_group,
    urgency,
    matched_donors: matched,
    total_matches: matched.length,
    scoring_formula: "Score = (Reliability × 0.4) + (Proximity × 0.3) + (Experience × 0.3)"
  });
});

// =============================================
// ENDPOINT: Get Active Blood Requests (3-Slot System)
// =============================================
app.get('/api/requests', (req, res) => {
  const enriched = requestsData.requests.map(r => {
    const patient = accountsData.patients.find(p => p.patient_id === r.patient_id);
    const getDonorInfo = (slot) => {
      if (!slot || !slot.donor_id) return null;
      const donor = accountsData.donors.find(d => d.donor_id === slot.donor_id);
      return donor ? { ...slot, donor_name: donor.name, blood_type: donor.blood_type, phone: donor.phone } : slot;
    };
    return {
      ...r,
      patient_name: patient?.name || 'Unknown',
      patient_hospital: patient?.hospital || 'Unknown',
      slot_1: getDonorInfo(r.slot_1),
      slot_2: getDonorInfo(r.slot_2),
      slot_3: getDonorInfo(r.slot_3)
    };
  });
  res.json({ requests: enriched });
});

// =============================================
// ENDPOINT: Create Blood Request (3-Slot Assignment)
// =============================================
app.post('/api/requests', (req, res) => {
  const { patient_id, blood_group, urgency } = req.body;
  const patient = accountsData.patients.find(p => p.patient_id === patient_id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const patLat = patient.location.lat;
  const patLng = patient.location.lng;
  const bg = blood_group || patient.blood_type;

  // Find compatible donors
  const compatible_groups = Object.keys(BLOOD_COMPATIBILITY).filter(g => BLOOD_COMPATIBILITY[g].includes(bg));
  let pool = accountsData.donors
    .filter(d => compatible_groups.includes(d.blood_type) && d.eligibility_status === 'eligible' && d.active_status)
    .map(d => ({ ...d, ...computeDonorScore(d, patLat, patLng) }))
    .sort((a, b) => b.score - a.score);

  // Auto-assign 3 slots
  const mainDonor = pool[0] || null;
  const backupDonor = pool[1] || null;
  // Emergency donor: prefer donors with role 'emergency_donor'
  const emergencyDonor = pool.find(d => d.role === 'emergency_donor' && d.donor_id !== mainDonor?.donor_id && d.donor_id !== backupDonor?.donor_id)
    || pool[2] || null;

  const request = {
    request_id: "req_" + Date.now().toString(36),
    patient_id,
    blood_type: bg,
    units_needed: 1,
    status: 'active',
    created_at: new Date().toISOString(),
    slot_1: mainDonor ? { donor_id: mainDonor.donor_id, role: 'main', status: 'pending', reminder_sent_at: null, response_received_at: null } : null,
    slot_2: backupDonor ? { donor_id: backupDonor.donor_id, role: 'backup', status: 'pending', reminder_sent_at: null, response_received_at: null } : null,
    slot_3: emergencyDonor ? { donor_id: emergencyDonor.donor_id, role: 'emergency', status: 'standby', reminder_sent_at: null, response_received_at: null } : null,
    emergency_triggered: false,
    transfusion_date: patient.next_expected_transfusion
  };

  requestsData.requests.push(request);
  saveJSON(REQUESTS_PATH, requestsData);

  res.json({ success: true, request });
});

// =============================================
// ENDPOINT: Cancel Slot (Cascade Logic — Section 2)
// =============================================
app.post('/api/requests/:id/cancel/:slot', (req, res) => {
  const { id, slot } = req.params;
  const request = requestsData.requests.find(r => r.request_id === id);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const slotKey = `slot_${slot}`;
  if (!request[slotKey]) return res.status(400).json({ error: 'Invalid slot' });

  const cancelledDonorId = request[slotKey].donor_id;

  // Log failure
  const donor = accountsData.donors.find(d => d.donor_id === cancelledDonorId);
  const now = new Date();
  failureLog.failures.push({
    donor_id: cancelledDonorId,
    type: 'cancelled',
    time_of_day: now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening',
    day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
    segment: donor ? (donor.total_donations <= 2 ? 'new' : donor.total_donations <= 9 ? 'experienced' : 'veteran') : 'unknown',
    timestamp: now.toISOString()
  });
  saveJSON(FAILURE_LOG_PATH, failureLog);

  // Cancellation cascade
  if (slot === '1') {
    // Slot 1 (Main) cancelled → Slot 2 becomes Main, Slot 3 becomes Backup, trigger emergency
    request.slot_1 = request.slot_2 ? { ...request.slot_2, role: 'main' } : null;
    request.slot_2 = request.slot_3 ? { ...request.slot_3, role: 'backup' } : null;
    // Find new emergency donor
    const usedIds = [request.slot_1?.donor_id, request.slot_2?.donor_id, cancelledDonorId].filter(Boolean);
    const newEmergency = accountsData.donors.find(d =>
      d.role === 'emergency_donor' && d.active_status && d.eligibility_status === 'eligible' && !usedIds.includes(d.donor_id)
    );
    request.slot_3 = newEmergency
      ? { donor_id: newEmergency.donor_id, role: 'emergency', status: 'standby', reminder_sent_at: null, response_received_at: null }
      : null;
    request.emergency_triggered = true;
  } else if (slot === '2') {
    // Slot 2 (Backup) cancelled → Slot 3 becomes Backup
    request.slot_2 = request.slot_3 ? { ...request.slot_3, role: 'backup' } : null;
    const usedIds = [request.slot_1?.donor_id, request.slot_2?.donor_id, cancelledDonorId].filter(Boolean);
    const newEmergency = accountsData.donors.find(d =>
      d.role === 'emergency_donor' && d.active_status && d.eligibility_status === 'eligible' && !usedIds.includes(d.donor_id)
    );
    request.slot_3 = newEmergency
      ? { donor_id: newEmergency.donor_id, role: 'emergency', status: 'standby', reminder_sent_at: null, response_received_at: null }
      : null;
  } else if (slot === '3') {
    // Slot 3 (Emergency) cancelled → trigger blood bank
    request.slot_3 = null;
    request.emergency_triggered = true;
  }

  request[slotKey + '_cancelled'] = cancelledDonorId;
  saveJSON(REQUESTS_PATH, requestsData);

  res.json({ success: true, message: `Slot ${slot} cancelled. Cascade applied.`, request });
});

// =============================================
// ENDPOINT: Admin Metrics
// =============================================
app.get('/admin/metrics', (req, res) => {
  const donors = accountsData.donors;
  res.json({
    total_active_donors: donors.filter(d => d.active_status).length,
    active_bridges: donors.filter(d => d.bridge_patient_id).length,
    inactive_donors: donors.filter(d => !d.active_status).length,
    eligible_now: donors.filter(d => d.eligibility_status === 'eligible').length,
    total_patients: accountsData.patients.length,
    bridged_patients: accountsData.patients.filter(p => p.bridge_donors.length >= 4).length,
    emergency_patients: accountsData.patients.filter(p => p.bridge_donors.length < 4).length,
    total_coins_in_system: donors.reduce((sum, d) => sum + d.coins, 0),
    requests_active: requestsData.requests.filter(r => r.status === 'active').length,
    community: accountsData.community.name
  });
});

// =============================================
// ENDPOINT: Failure Analytics (Section 6)
// =============================================
app.get('/api/analytics/failures', (req, res) => {
  const failures = failureLog.failures;

  // By time of day
  const byTimeOfDay = {};
  failures.forEach(f => {
    byTimeOfDay[f.time_of_day] = (byTimeOfDay[f.time_of_day] || 0) + 1;
  });

  // By day of week
  const byDayOfWeek = {};
  failures.forEach(f => {
    byDayOfWeek[f.day_of_week] = (byDayOfWeek[f.day_of_week] || 0) + 1;
  });

  // By segment
  const bySegment = {};
  failures.forEach(f => {
    bySegment[f.segment] = (bySegment[f.segment] || 0) + 1;
  });

  // Recommendations
  const recommendations = [];
  const maxDay = Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0];
  const maxTime = Object.entries(byTimeOfDay).sort((a, b) => b[1] - a[1])[0];

  if (maxDay) recommendations.push(`${maxDay[0]}s have the highest cancellation rate (${maxDay[1]} failures) — avoid scheduling.`);
  if (maxTime) recommendations.push(`${maxTime[0].charAt(0).toUpperCase() + maxTime[0].slice(1)} has the most failures (${maxTime[1]}) — prefer other times.`);

  const totalBySegment = Object.entries(bySegment).sort((a, b) => b[1] - a[1]);
  if (totalBySegment.length > 0) {
    recommendations.push(`"${totalBySegment[0][0]}" donors fail the most (${totalBySegment[0][1]} times).`);
  }

  res.json({
    total_failures: failures.length,
    by_time_of_day: byTimeOfDay,
    by_day_of_week: byDayOfWeek,
    by_segment: bySegment,
    recommendations
  });
});

// =============================================
// ENDPOINT: Coin Wallet / Ledger
// =============================================
app.get('/donors/wallet/ledger', (req, res) => {
  // Generate ledger from donor data
  const ledger = accountsData.donors
    .filter(d => d.total_donations > 0)
    .flatMap(d => {
      const entries = [];
      for (let i = 0; i < Math.min(d.total_donations, 3); i++) {
        entries.push({
          donor_id: d.donor_id,
          donor_name: d.name,
          date: d.last_donation_date || '2026-01-01',
          type: 'EARN',
          amount: 50,
          reason: `Successful blood donation #${d.total_donations - i}`
        });
      }
      if (d.bridge_patient_id) {
        entries.push({
          donor_id: d.donor_id,
          donor_name: d.name,
          date: d.last_donation_date || '2026-01-01',
          type: 'EARN',
          amount: 40,
          reason: 'Bridge donor bonus'
        });
      }
      return entries;
    });
  res.json({ ledger });
});

// =============================================
// ENDPOINT: Chat (Rule-Based + Bedrock-aware)
// =============================================
app.post('/chat', async (req, res) => {
  const msg = (req.body.message || "").toLowerCase();
  const donorId = req.body.donor_id;

  const donor = donorId ? accountsData.donors.find(d => d.donor_id === donorId) : null;

  let reply = "Thank you for being a Blood Warriors donor! I can answer questions about your eligibility, rewards, or general info about Thalassemia and Bridge Donors. What would you like to know? 💪";

  if (msg.includes("when") && msg.includes("next") && msg.includes("donat")) {
    reply = donor && donor.next_eligible_date
      ? `Your next eligible donation date is ${donor.next_eligible_date}. We'd love to have you donate again! 🩸`
      : "You are eligible to donate right now! 🩸";
  } else if (msg.includes("can't") || msg.includes("cancel") || msg.includes("not available")) {
    reply = "We've noted your response. Your backup has been notified and will take over. Thank you for letting us know! ❤️";
  } else if (msg.includes("coin") || msg.includes("reward") || msg.includes("point") || msg.includes("balance")) {
    reply = donor
      ? `You currently have ${donor.coins} ARIA Coins! You can redeem them for health checkups, event entries, and partner discounts. 🪙`
      : "You earn ARIA Coins for every successful donation and bridge bonus! 🪙";
  } else if (msg.includes("who") && msg.includes("patient")) {
    if (donor && donor.bridge_patient_id) {
      const patient = accountsData.patients.find(p => p.patient_id === donor.bridge_patient_id);
      reply = patient
        ? `You are bridged to ${patient.name} (${patient.blood_type}) at ${patient.hospital}. Next transfusion: ${patient.next_expected_transfusion}. Your dedication saves their life! 💪`
        : "You are assigned to a patient. Contact your community admin for details.";
    } else {
      reply = "You are not currently assigned to any patient. Consider pledging as a bridge donor!";
    }
  } else if (msg.includes("bridge") || msg.includes("patient")) {
    reply = "A Bridge Donor is part of a cycle of dedicated donors assigned to a single patient. Because donors need a cooldown period between donations, these donors rotate throughout the year, providing a reliable, lifelong supply of safe blood to the patient! ❤️";
  } else if (msg.includes("thalassemia") || msg.includes("disease") || msg.includes("condition")) {
    reply = "Thalassemia is a genetic blood disorder that prevents the body from producing enough hemoglobin. Patients require lifelong, regular blood transfusions every 2 to 4 weeks simply to survive. Your donations ensure they never have to fight to find blood. 🩸";
  } else if (msg.includes("volunteer")) {
    reply = "Volunteers are the heroes of our mission! Any healthy adult between 18-65 years weighing over 45kg can volunteer to donate blood and save lives. 🦸";
  } else if (msg.includes("cooldown") || msg.includes("rest") || msg.includes("wait")) {
    reply = "To protect your health, there is a mandatory rest period between blood donations: 90 days for men and 120 days for women. ARIA automatically tracks this to keep you safe! ⏳";
  } else if (msg.includes("eligible") || (msg.includes("when") && msg.includes("donate"))) {
    reply = donor && donor.next_eligible_date
      ? `Your next eligible date is ${donor.next_eligible_date}. Hang tight! 🩸`
      : "You are currently eligible to donate! Head to Apollo Hospital, Jubilee Hills. 🩸";
  } else if (msg.includes("donation") || msg.includes("how many")) {
    reply = donor
      ? `You have made ${donor.total_donations} donations so far. That's incredible — you've helped save approximately ${donor.total_donations * 3} lives! 🌟`
      : "Every donation you make can save up to 3 lives! You are a hero! 🌟";
  } else if (["hello", "hi", "hey"].some(w => msg.includes(w))) {
    reply = donor
      ? `Hello ${donor.name}! I'm ARIA, your Blood Warriors AI assistant. Your blood group is ${donor.blood_type} and you have ${donor.total_donations} donations. 👋 How can I help you today?`
      : "Hello! I'm ARIA, your Blood Warriors AI assistant. 👋 How can I help you today?";
  }

  res.json({
    reply,
    donor_context: donor ? { blood_group: donor.blood_type, coins: donor.coins, donations: donor.total_donations } : {},
  });
});

// =============================================
// ENDPOINT: Emergency Dispatch (WhatsApp)
// =============================================
app.post('/api/dispatch', async (req, res) => {
  const { donorId, donorName, distance } = req.body;
  const targetPhone = TEST_PHONE_NUMBER;

  const message = `🚨 EMERGENCY DISPATCH: Hi ${donorName}, ARIA has identified you as a critical match for a patient ${distance}km away at Apollo Hospital, Jubilee Hills. Can you donate blood today? Reply YES to accept or NO to decline.`;

  const success = await sendWhatsAppMessage(targetPhone, message);
  if (success) {
    const dispatches = loadPendingDispatches();
    dispatches[targetPhone] = {
      donorId,
      donorName,
      status: 'pending',
      timestamp: Date.now()
    };
    savePendingDispatches(dispatches);
    res.json({ success: true, message: 'Emergency dispatch sent via WhatsApp.' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to send WhatsApp message. Check .env config.' });
  }
});

// =============================================
// ENDPOINT: Engage Donor (WhatsApp)
// =============================================
app.post('/api/engage', async (req, res) => {
  const { donorName, messageText } = req.body;
  const targetPhone = TEST_PHONE_NUMBER;
  const success = await sendWhatsAppMessage(targetPhone, messageText);
  if (success) {
    res.json({ success: true, message: 'Engagement message sent via WhatsApp.' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to send WhatsApp message.' });
  }
});

// =============================================
// ENDPOINT: Community Info
// =============================================
app.get('/api/community', (req, res) => {
  res.json(accountsData.community);
});


// =============================================
// WHATSAPP WEBHOOKS
// =============================================
app.get('/api/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === 'ARIA_HACKATHON_TOKEN') {
    console.log('WEBHOOK_VERIFIED');  // Log to console
    res.status(200).send(challenge);   // Return challenge to Meta
  } else {
    res.status(403).send('Forbidden');
  }
});

app.post('/api/webhook/whatsapp', async (req, res) => {
  const body = req.body;

  if (body.object) {
    try {
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const phone_number = body.entry[0].changes[0].value.messages[0].from;
        const msg_body = body.entry[0].changes[0].value.messages[0].text.body;

        console.log(`[WhatsApp] Received from ${phone_number}: ${msg_body}`);

        // 1. Preference Extraction
        const extractedPrefs = extractPreferences(msg_body);
        if (extractedPrefs) {
          console.log(`[NLP] Preferences extracted:`, extractedPrefs);
        }

        // 2. Check pending dispatches
        const dispatches = loadPendingDispatches();
        const normalizedPhone = phone_number.replace('+', '');
        const possibleKeys = Object.keys(dispatches).filter(k => k.replace('+', '') === normalizedPhone);

        if (possibleKeys.length > 0) {
          const key = possibleKeys[0];
          const record = dispatches[key];

          if (record.status === 'pending' || record.status === 'followed_up') {
            // Two-tier classification
            const classification = await classifyResponse(msg_body, record.donorName);
            console.log(`[Classification] Tier ${classification.tier}: ${classification.intent}`);

            await sendWhatsAppMessage(key, classification.response);

            if (classification.intent === 'ACCEPT') {
              record.status = 'accepted';
            } else if (classification.intent === 'CANCEL') {
              record.status = 'declined';
            }

            savePendingDispatches(dispatches);
          }

          // Update preferences on donor record
          if (extractedPrefs) {
            const donor = accountsData.donors.find(d => d.donor_id === record.donorId);
            if (donor) {
              Object.assign(donor, extractedPrefs);
              saveJSON(ACCOUNTS_PATH, accountsData);
              console.log(`[DB] Updated preferences for ${record.donorName}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Webhook] Error processing message:', err);
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// =============================================
// CRON: AI Follow-up (Runs every 10 seconds for demo)
// =============================================
cron.schedule('*/10 * * * * *', async () => {
  const dispatches = loadPendingDispatches();
  let modified = false;

  for (const phone of Object.keys(dispatches)) {
    const record = dispatches[phone];
    const waitTimeMs = 15 * 1000; // 15 seconds for demo

    if (record.status === 'pending' && (Date.now() - record.timestamp > waitTimeMs)) {
      console.log(`[Cron] AI Follow-up for ${record.donorName}...`);
      const aiMessage = await invokeBedrockLLM(record.donorId, record.donorName);
      const success = await sendWhatsAppMessage(phone, aiMessage);
      if (success) {
        record.status = 'followed_up';
        modified = true;
      }
    }
  }

  if (modified) savePendingDispatches(dispatches);
});

// =============================================
// CRON: Reminder System (Section 3 - runs every minute for demo)
// =============================================
cron.schedule('* * * * *', async () => {
  const now = new Date();

  for (const request of requestsData.requests) {
    if (request.status !== 'active') continue;

    const transfusionDate = new Date(request.transfusion_date);
    const daysUntil = Math.ceil((transfusionDate - now) / (1000 * 60 * 60 * 24));

    // T-10 days: Send reminder to all 3 slots
    if (daysUntil <= 10 && daysUntil > 5) {
      for (const slotKey of ['slot_1', 'slot_2', 'slot_3']) {
        const slot = request[slotKey];
        if (slot && !slot.reminder_sent_at && slot.status !== 'confirmed') {
          const donor = accountsData.donors.find(d => d.donor_id === slot.donor_id);
          if (donor) {
            // Check 24hr cooldown
            if (donor.last_message_at && (now - new Date(donor.last_message_at)) < 24 * 60 * 60 * 1000) continue;

            const msg = `🩸 Reminder from ARIA: Hi ${donor.name}, a patient needs your blood donation on ${request.transfusion_date} at Apollo Hospital. You are the ${slot.role.toUpperCase()} donor. Please reply YES to confirm or NO to decline.`;
            console.log(`[Reminder T-10] Sending to ${donor.name} (${slot.role})`);
            // Only send if WhatsApp is configured
            if (WHATSAPP_TOKEN) {
              await sendWhatsAppMessage(TEST_PHONE_NUMBER, msg);
            }
            slot.reminder_sent_at = now.toISOString();
            donor.last_message_at = now.toISOString();
          }
        }
      }
      saveJSON(REQUESTS_PATH, requestsData);
      saveJSON(ACCOUNTS_PATH, accountsData);
    }

    // T-5 days: If main hasn't responded, auto-cancel and promote backup
    if (daysUntil <= 5 && daysUntil > 0) {
      if (request.slot_1 && request.slot_1.status === 'pending' && !request.slot_1.response_received_at) {
        console.log(`[Reminder T-5] Main donor unresponsive. Promoting backup.`);
        // Auto-cancel main, promote
        const cancelledId = request.slot_1.donor_id;
        request.slot_1 = request.slot_2 ? { ...request.slot_2, role: 'main' } : null;
        request.slot_2 = request.slot_3 ? { ...request.slot_3, role: 'backup' } : null;
        request.slot_3 = null;
        request.emergency_triggered = true;

        // Log failure
        failureLog.failures.push({
          donor_id: cancelledId,
          type: 'no_response',
          time_of_day: now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening',
          day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
          segment: 'unknown',
          timestamp: now.toISOString()
        });
        saveJSON(FAILURE_LOG_PATH, failureLog);
        saveJSON(REQUESTS_PATH, requestsData);
      }
    }
  }
});

// =============================================
// START SERVER (MUST BE LAST — AFTER ALL ROUTES)
// =============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ARIA] Server running on port ${PORT}`);
  console.log(`[ARIA] Community: ${accountsData.community.name}`);
  console.log(`[ARIA] Hospital: ${accountsData.community.hospital}`);
});
