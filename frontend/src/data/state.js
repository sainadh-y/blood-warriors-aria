// =============================================
// Blood Warriors ARIA — State & Helper Utilities
// Reduced version for V2 Backend Integration
// =============================================

// Indian name pools for random generation (used for generic prompts)
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith',
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aanya', 'Aadhya', 'Ira', 'Anika',
  'Priya', 'Neha', 'Pooja', 'Riya', 'Kavya', 'Tanvi', 'Meera', 'Shreya'
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Nair', 'Reddy', 'Kumar', 'Singh', 'Gupta',
  'Mehta', 'Kapoor', 'Joshi', 'Rao', 'Iyer', 'Pillai', 'Deshmukh'
];
const LOCATIONS = ['Hyderabad', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function randomName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomFutureDate(minDays, maxDays) {
  const today = new Date();
  const days = minDays + Math.floor(Math.random() * (maxDays - minDays));
  today.setDate(today.getDate() + days);
  return today.toISOString().split('T')[0];
}

// =============================================
// Bridge Cycle Helper
// =============================================
export function getCurrentBridgePair(patient) {
  if (!patient.bridgeCycle || patient.bridgeCycle.length === 0) {
    return { mainId: null, backupId: null };
  }
  const cycleIndex = patient.cycleIndex || 0;
  const mainId = patient.bridgeCycle[cycleIndex];
  const backupId = patient.bridgeCycle[(cycleIndex + 1) % patient.bridgeCycle.length];
  return { mainId, backupId };
}

export function handleBridgeSkip(patientId, skippedDonorId) {
  // In V2, we should ideally handle this via backend API,
  // but keeping this for local UI state manipulation if needed.
  console.log(`Simulated skip for donor ${skippedDonorId} on patient ${patientId}`);
}

export function advanceBridgeCycle(patientId, donorWhoGaveId) {
  console.log(`Simulated donation advance for donor ${donorWhoGaveId} on patient ${patientId}`);
}

export function calculateEmergencyMode(patientList) {
  patientList.forEach(p => {
    p.emergencyMode = p.currentBridgeCount < p.requiredBridgesPerMonth;
  });
}

// =============================================
// Mock Constants (For Visual Components)
// =============================================

export const chatMessages = [
  { bridgeId: 'pat_01-donor_01', from: 'Kiran Mehta', text: "I'm available for the August 5 transfusion. Confirmed!", timestamp: '2026-06-05 10:30', type: 'donor' },
  { bridgeId: 'pat_01-donor_01', from: "Ananya's Mother", text: "Thank you Kiran! Hospital confirmed at 4PM. Really appreciate your help.", timestamp: '2026-06-05 10:45', type: 'patient' },
  { bridgeId: 'pat_01-donor_02', from: 'Arjun Nair', text: 'Ready for my rotation. Will be there.', timestamp: '2026-06-04 15:20', type: 'donor' }
];

export const coupons = [
  { id: 'c1', code: 'HEALTHY25', discountType: 'percentage', discountValue: 25, validUntil: '2026-10-01', claimed: false, claimedBy: null },
  { id: 'c2', code: 'MARATHON24', discountType: 'free_event', discountValue: 100, validUntil: '2026-09-15', claimed: false, claimedBy: null },
  { id: 'c3', code: 'MEDPLUS50', discountType: 'fixed', discountValue: 50, validUntil: '2026-08-30', claimed: true, claimedBy: 'donor_01' },
  { id: 'c4', code: 'FITINDIA', discountType: 'percentage', discountValue: 15, validUntil: '2026-12-31', claimed: false, claimedBy: null }
];

export const events = [
  { id: 'e1', name: '🏃‍♂️ Blood Warriors Hyderabad Marathon', date: '2026-08-15', venue: 'Gachibowli Stadium', registeredDonors: ['donor_01'], status: 'upcoming' },
  { id: 'e2', name: '🩸 Mega Donation Camp', date: '2026-09-05', venue: 'Nehru Zoological Park', registeredDonors: [], status: 'upcoming' },
  { id: 'e3', name: '💪 Thalassemia Awareness Walk', date: '2026-09-20', venue: 'Hussain Sagar', registeredDonors: ['donor_02'], status: 'upcoming' }
];

export function generateBridgePrompts(count = 5) {
  const prompts = [];
  for (let i = 0; i < count; i++) {
    const bridgesNeeded = 2 + Math.floor(Math.random() * 6);
    const currentBridges = Math.floor(Math.random() * bridgesNeeded);
    prompts.push({
      id: `bp-${i}`,
      patientName: randomName() + '-rn',
      bloodGroup: BLOOD_GROUPS[Math.floor(Math.random() * BLOOD_GROUPS.length)],
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      needByDate: randomFutureDate(3, 30),
      becomeByDate: randomFutureDate(1, 14),
      bridgesNeeded,
      currentBridges,
      urgency: currentBridges < bridgesNeeded / 2 ? 'high' : 'medium'
    });
  }
  return prompts;
}

export function autoAssignBridges(patient, allDonors) {
  // Adapted logic for UI display
  const today = new Date();
  const compatible = allDonors.filter(d => d.bloodGroup === patient.bloodGroup && d.activeStatus === 'Active');
  
  compatible.sort((a, b) => (b.reliabilityScore || 0) - (a.reliabilityScore || 0));

  const needed = patient.requiredBridgesPerMonth || 4;
  const selected = compatible.slice(0, needed);

  const mainCount = Math.ceil(selected.length / 2);
  return {
    mainDonors: selected.slice(0, mainCount),
    backupDonors: selected.slice(mainCount),
    totalAssigned: selected.length,
    totalNeeded: needed,
    fullyStaffed: selected.length >= needed
  };
}

export function canDonateNow(donor) {
  if (!donor.nextEligibleDate) return true;
  return new Date() >= new Date(donor.nextEligibleDate);
}

export function refreshDonorStatus(donorList) {
  donorList.forEach(d => d.canDonate = canDonateNow(d));
}
