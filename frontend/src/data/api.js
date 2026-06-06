// =============================================
// Blood Warriors ARIA — API Layer (v2)
// Connects to the new JSON-based backend
// =============================================

const API_BASE = 'http://localhost:3000';

export async function apiCall(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(API_BASE + path, opts);
    return res.json();
  } catch (err) {
    console.error(`API call failed: ${path}`, err);
    return {};
  }
}

// Convenience wrappers
export async function fetchDonors() {
  return apiCall('/donors/list');
}

export async function fetchPatients() {
  return apiCall('/donors/patients/list');
}

export async function requestBloodMatch(bloodGroup, urgency, topN = 3) {
  return apiCall('/request-blood', 'POST', { blood_group: bloodGroup, urgency, top_n: topN });
}

export async function fetchRequests() {
  return apiCall('/api/requests');
}

export async function createRequest(patientId, bloodGroup, urgency) {
  return apiCall('/api/requests', 'POST', { patient_id: patientId, blood_group: bloodGroup, urgency });
}

export async function cancelSlot(requestId, slotNumber) {
  return apiCall(`/api/requests/${requestId}/cancel/${slotNumber}`, 'POST');
}

export async function fetchFailureAnalytics() {
  return apiCall('/api/analytics/failures');
}

export async function fetchAdminMetrics() {
  return apiCall('/admin/metrics');
}

export async function sendChat(message, donorId = null) {
  return apiCall('/chat', 'POST', { message, donor_id: donorId });
}

export async function dispatchDonor(donorId, donorName, distance) {
  return apiCall('/api/dispatch', 'POST', { donorId, donorName, distance });
}

export async function engageDonor(donorName, messageText) {
  return apiCall('/api/engage', 'POST', { donorName, messageText });
}

export { API_BASE };
