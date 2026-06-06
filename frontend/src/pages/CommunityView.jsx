import { useState, useEffect } from 'react';
import { autoAssignBridges } from '../data/state';
import { useToast } from '../components/Toast';
import MatchResultsCard from '../components/MatchResultsCard';
import { AlertCircle, CheckCircle2, AlertTriangle, Activity, Users, Shield, User, HeartPulse, Search, MessageSquare, Send, Phone, Banknote, HelpCircle, Radio, Clock, BarChart3, TrendingDown, XCircle } from 'lucide-react';
import Tooltip from '../components/Tooltip';
import { apiCall, API_BASE, fetchRequests, cancelSlot, fetchFailureAnalytics, createRequest } from '../data/api';

export default function CommunityView({ activeSection, patients, donors, onPatientAdded }) {
  const showToast = useToast();
  const [autoAssignments, setAutoAssignments] = useState({});
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showEngageModal, setShowEngageModal] = useState(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [broadcastTimer, setBroadcastTimer] = useState(0);
  const [requests, setRequests] = useState([]);
  const [failureData, setFailureData] = useState(null);

  // New Patient Form State
  const [newPatientData, setNewPatientData] = useState({
    name: '',
    email: '',
    password: '',
    bloodGroup: 'O Positive',
    nextTransfusionDate: '',
    age: '',
    preferredHospital: ''
  });
  // Filters
  const [patientFilter, setPatientFilter] = useState('all');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'Dr. Rajesh Kumar',
    region: 'Hyderabad',
    contactEmail: 'admin@bloodwarriors.org'
  });

  useEffect(() => {
    const assignments = {};
    patients.forEach(p => {
      assignments[p.id] = autoAssignBridges(p, donors);
    });
    setAutoAssignments(assignments);
  }, [patients, donors]);

  useEffect(() => {
    let interval;
    if (broadcastTimer > 0) {
      interval = setInterval(() => setBroadcastTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [broadcastTimer]);

  // Load requests and failure analytics
  useEffect(() => {
    fetchRequests().then(data => {
      if (data?.requests) setRequests(data.requests);
    });
    fetchFailureAnalytics().then(data => {
      if (data?.total_failures !== undefined) setFailureData(data);
    });
  }, []);

  const activeAlerts = patients.filter(p => p.emergencyMode);

  const handleSaveProfile = () => {
    setIsEditingProfile(false);
    showToast('Admin Profile updated successfully', 'success');
  };

  const handleAddPatientSubmit = async (e) => {
    e.preventDefault();
    showToast(`Patient ${newPatientData.name} registration simulated. In production, this hits Cognito.`, 'success');
    if (onPatientAdded) {
      onPatientAdded({
        id: 'pat_new_' + Date.now().toString(36),
        name: newPatientData.name,
        bloodGroup: newPatientData.bloodGroup,
        age: newPatientData.age || 30,
        preferredHospital: newPatientData.preferredHospital || 'Apollo Hospital, Jubilee Hills',
        nextTransfusionDate: newPatientData.nextTransfusionDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        emergencyMode: true,
        bridgeCycle: [],
        currentBridgeCount: 0,
        requiredBridgesPerMonth: 4,
        cycleIndex: 0,
        skipCount: {},
        status: 'needs_bridge'
      });
    }
    setShowAddPatient(false);
    setNewPatientData({ name: '', email: '', password: '', bloodGroup: 'O Positive', nextTransfusionDate: '', age: '', preferredHospital: '' });
  };

  const handleCancelSlot = async (requestId, slotNum) => {
    const result = await cancelSlot(requestId, slotNum);
    if (result?.success) {
      showToast(`Slot ${slotNum} cancelled. Cascade applied — donors promoted.`, 'success');
      // Reload requests
      const data = await fetchRequests();
      if (data?.requests) setRequests(data.requests);
    } else {
      showToast('Failed to cancel slot.', 'error');
    }
  };

  const handleCreateRequest = async (patientId, bloodGroup) => {
    const result = await createRequest(patientId, bloodGroup, 'high');
    if (result?.success) {
      showToast('Blood request created with 3-slot assignment!', 'success');
      const data = await fetchRequests();
      if (data?.requests) setRequests(data.requests);
    } else {
      showToast('Failed to create request.', 'error');
    }
  };

  // Filter Logic
  const filteredPatients = patients.filter(p => {
    if (patientFilter === 'emergency') return p.emergencyMode;
    if (patientFilter === 'stable') return !p.emergencyMode;
    return true;
  }).filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.bloodGroup.includes(searchQuery));

  const filteredFleet = donors.filter(d => {
    if (fleetFilter === 'eligible') return d.canDonate;
    if (fleetFilter === 'cooldown') return !d.canDonate;
    if (fleetFilter === 'low-score') return d.reliabilityScore < 70;
    return true;
  }).filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.bloodGroup.includes(searchQuery))
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  const emergencyDonors = donors
    .filter(d => d.canDonate && d.reliabilityScore >= 80)
    .sort((a, b) => parseFloat(a.travelDistanceKm) - parseFloat(b.travelDistanceKm))
    .slice(0, 5);

  return (
    <div className="w-full h-full flex flex-col">

      {/* =========================================
          SECTION: AI MATCHING
          ========================================= */}
      {activeSection === 'ai-matching' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="flex flex-col gap-6">

            {/* AI Emergency Escalations */}
            <div className="card border-l-4 border-l-rose-500">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-2">
                <AlertCircle className="text-rose-500 animate-pulse" size={20} /> AI Emergency Escalations
              </h3>
              <p className="text-sm text-slate-600 mb-4 bg-rose-50 p-3 rounded-lg">
                <strong>What does Override AI do?</strong> Normally, ARIA automatically dispatches emergency donors. Clicking "Override AI" allows the Admin to pause the auto-dispatch and manually intervene.
              </p>

              {activeAlerts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {activeAlerts.map(p => (
                    <div key={`alert-${p.id}`} className="bg-rose-50 p-4 rounded-lg border border-rose-100 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-rose-900 mb-1">{p.name} (Need: {p.bloodGroup})</div>
                        <p className="text-xs text-rose-700">
                          {p.status === 'needs_bridge' ? 'New patient — needs bridge formation urgently!' : 'Bridge cycle broken! Sending SOS.'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="bg-white text-rose-600 border border-rose-200 text-xs font-semibold py-2 px-4 rounded shadow-sm hover:bg-rose-50 transition-colors" onClick={() => showToast('AI Dispatch Paused. Manual control engaged.', 'info')}>
                          Override AI
                        </button>
                        <button className="bg-rose-600 text-white text-xs font-semibold py-2 px-4 rounded shadow-sm hover:bg-rose-700 transition-colors whitespace-nowrap" onClick={() => setShowMatchModal(true)}>
                          Find Matching Donor
                        </button>
                        <button className="bg-indigo-600 text-white text-xs font-semibold py-2 px-4 rounded shadow-sm hover:bg-indigo-700 transition-colors whitespace-nowrap" onClick={() => handleCreateRequest(p.id, p.bloodGroup)}>
                          Create 3-Slot Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 bg-teal-50 rounded-lg border border-teal-100">
                  <CheckCircle2 className="text-teal-500 mb-2" size={32} />
                  <span className="font-semibold text-teal-700">All Patient Cycles Stable</span>
                  <span className="text-xs text-teal-600 mt-1">No AI escalations required right now.</span>
                </div>
              )}
            </div>

            {showMatchModal && (
              <div className="mb-6">
                <MatchResultsCard />
              </div>
            )}

            {/* 3-Slot Blood Requests */}
            {requests.length > 0 && (
              <div className="card">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4">
                  <Activity size={20} className="text-indigo-600" /> Active Blood Requests (3-Slot System)
                </h3>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 text-xs text-indigo-800">
                  <strong>How it works:</strong> Each request has 3 slots: Main → Backup → Emergency. If Main cancels, Backup promotes to Main, Emergency promotes to Backup, and a new Emergency is found automatically.
                </div>
                <div className="flex flex-col gap-4">
                  {requests.map(req => (
                    <div key={req.request_id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="font-bold text-slate-800">{req.patient_name}</span>
                          <span className="text-xs text-slate-400 ml-2">({req.blood_type})</span>
                          <span className="text-xs text-slate-400 ml-2">Transfusion: {req.transfusion_date}</span>
                        </div>
                        <div className="flex gap-2">
                          {req.emergency_triggered && (
                            <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded animate-pulse">⚠️ EMERGENCY TRIGGERED</span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-1 rounded ${req.status === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { slot: req.slot_1, num: 1, color: 'teal' },
                          { slot: req.slot_2, num: 2, color: 'amber' },
                          { slot: req.slot_3, num: 3, color: 'rose' }
                        ].map(({ slot, num, color }) => (
                          <div key={num} className={`border-2 rounded-lg p-3 ${slot ? `border-${color}-200 bg-${color}-50/30` : 'border-dashed border-slate-300 bg-slate-50'}`}>
                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 text-${color}-700`}>
                              Slot {num}: {num === 1 ? 'Main' : num === 2 ? 'Backup' : 'Emergency'}
                            </div>
                            {slot ? (
                              <>
                                <div className="font-semibold text-sm text-slate-800">{slot.donor_name || slot.donor_id}</div>
                                <div className="text-[10px] text-slate-500 mt-1">
                                  Status: <span className={`font-bold ${slot.status === 'confirmed' ? 'text-teal-600' : slot.status === 'standby' ? 'text-amber-600' : 'text-slate-500'}`}>{slot.status}</span>
                                </div>
                                {slot.reminder_sent_at && <div className="text-[10px] text-slate-400 mt-0.5">Reminded: ✓</div>}
                                <button
                                  className="mt-2 w-full bg-white border border-slate-200 text-rose-600 text-[10px] font-bold py-1 rounded hover:bg-rose-50 transition-colors flex items-center justify-center gap-1"
                                  onClick={() => handleCancelSlot(req.request_id, num)}
                                >
                                  <XCircle size={10} /> Cancel Slot
                                </button>
                              </>
                            ) : (
                              <div className="text-xs text-slate-400 italic">Empty — awaiting assignment</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failure Analytics */}
            {failureData && (
              <div className="card">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4">
                  <BarChart3 size={20} className="text-rose-500" /> Failure Analytics & Learning
                </h3>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mb-4 text-xs text-rose-800">
                  <strong>Analytics-driven learning loop.</strong> No ML training — we track cancellations by time, day, and donor segment, then recommend better scheduling.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">By Time of Day</div>
                    {Object.entries(failureData.by_time_of_day || {}).map(([time, count]) => (
                      <div key={time} className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-600 capitalize">{time}</span>
                        <span className="font-bold text-slate-800">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">By Day of Week</div>
                    {Object.entries(failureData.by_day_of_week || {}).map(([day, count]) => (
                      <div key={day} className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-600">{day}</span>
                        <span className="font-bold text-slate-800">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">By Donor Segment</div>
                    {Object.entries(failureData.by_segment || {}).map(([seg, count]) => (
                      <div key={seg} className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-600 capitalize">{seg}</span>
                        <span className="font-bold text-slate-800">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {failureData.recommendations && failureData.recommendations.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <TrendingDown size={14} /> AI Recommendations
                    </div>
                    {failureData.recommendations.map((rec, i) => (
                      <div key={i} className="text-sm text-amber-900 mb-1">• {rec}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bridge Broadcast */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card h-full">
                <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Radio size={18} className="text-indigo-600" /> Broadcast Bridge Requests
                </h3>
                <p className="text-xs text-slate-600 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <strong>How does this work?</strong> This broadcasts an invitation to unassigned donors. They have a <strong>6-hour buffer</strong> to accept the request.
                </p>

                <button
                  disabled={broadcastTimer > 0}
                  className={`w-full font-bold py-3 rounded-xl mb-4 shadow transition-colors flex items-center justify-center gap-2 ${broadcastTimer > 0 ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  onClick={() => {
                    setBroadcastTimer(24 * 3600);
                    showToast('Requests broadcasted! Donors have 6 hours to accept.', 'success');
                  }}
                >
                  {broadcastTimer > 0 ? (
                    <><Clock size={18} /> Re-broadcast in {Math.floor(broadcastTimer / 3600)}h {Math.floor((broadcastTimer % 3600) / 60)}m</>
                  ) : (
                    <><Radio size={18} /> BROADCAST REQUESTS NOW</>
                  )}
                </button>

                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {patients.map(p => {
                    const assignData = autoAssignments[p.id];
                    if (!assignData) return null;

                    return (
                      <div key={`assign-${p.id}`} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm text-slate-700">{p.name}</span>
                          {p.currentBridgeCount >= 8 ? (
                            <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded border border-teal-200">{p.currentBridgeCount}/8 STAFFED</span>
                          ) : (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">{p.currentBridgeCount}/8 ASSIGNED</span>
                          )}
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.currentBridgeCount >= 8 ? 'bg-teal-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, (p.currentBridgeCount / 8) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          SECTION: PATIENTS
          ========================================= */}
      {activeSection === 'patients' && (
        <div className="card h-full flex flex-col">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <HeartPulse className="text-rose-600" size={20} /> Patient Database
            </h3>

            <div className="flex gap-4">
              <button
                className="bg-rose-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
                onClick={() => setShowAddPatient(true)}
              >
                + Add Patient
              </button>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                  placeholder="Search name or BG..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="py-2 px-3 border border-slate-300 rounded-lg text-sm bg-white"
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
              >
                <option value="all">All Patients</option>
                <option value="emergency">Emergency Mode</option>
                <option value="stable">Stable Bridges</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-slate-700 mb-2 text-sm flex items-center gap-2">
              <HelpCircle size={16} className="text-slate-500" /> What is a Stable Patient?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              A <strong>Stable</strong> patient has a functioning Bridge Cycle with at least 4 active donors. An <strong>Emergency</strong> patient has fewer than 4 active donors, placing them at high risk.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
            {filteredPatients.map(p => (
              <div key={p.id} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-1 w-2/3">
                  <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                    {p.name}
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100">{p.bloodGroup}</span>
                    <span className="text-xs text-slate-400 font-normal">ID: {p.id}</span>
                    {p.age && <span className="text-xs text-slate-400">Age: {p.age}</span>}
                  </div>
                  <div className="text-xs text-slate-500 grid grid-cols-2 mt-1 gap-1">
                    <span>🏥 Hospital: {p.preferredHospital}</span>
                    <span>📅 Next Need: {p.nextTransfusionDate} <Tooltip text="The exact date the patient will need blood." /></span>
                    <span>🔄 Status: {p.status || 'active'}</span>
                    <span>⚠️ Bridge Donors: {p.currentBridgeCount}</span>
                    <span className="col-span-2 mt-1 bg-slate-50 p-1 rounded border border-slate-100 text-[10px]">
                      Bridge IDs: {p.bridgeCycle?.length ? p.bridgeCycle.join(', ') : 'None'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {p.emergencyMode ? (
                    <span className="bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow-sm">
                      <AlertTriangle size={14} /> EMERGENCY <Tooltip text="Bridge cycle critically low (<4 donors)." />
                    </span>
                  ) : (
                    <span className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow-sm">
                      <CheckCircle2 size={14} /> STABLE <Tooltip text="Bridge cycle operational." />
                    </span>
                  )}
                  <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded flex items-center">
                    {p.currentBridgeCount}/8 Donors <Tooltip text="Bridge requires 8 rotating donors." />
                  </div>
                </div>
              </div>
            ))}
            {filteredPatients.length === 0 && <div className="text-center py-10 text-slate-500 italic">No patients match the filters.</div>}
          </div>

          {/* Add Patient Modal */}
          {showAddPatient && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="bg-rose-600 p-4 flex justify-between items-center text-white">
                  <h3 className="font-bold flex items-center gap-2"><User size={18} /> Register New Patient</h3>
                  <button onClick={() => setShowAddPatient(false)} className="text-white/80 hover:text-white font-bold">&times;</button>
                </div>
                <form onSubmit={handleAddPatientSubmit} className="p-6 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Patient Full Name</label>
                      <input required className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none" value={newPatientData.name} onChange={e => setNewPatientData({ ...newPatientData, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Age</label>
                      <input required type="number" min="1" max="100" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none" value={newPatientData.age} onChange={e => setNewPatientData({ ...newPatientData, age: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
                    <select required className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white" value={newPatientData.bloodGroup} onChange={e => setNewPatientData({ ...newPatientData, bloodGroup: e.target.value })}>
                      {["O Positive", "O Negative", "A Positive", "A Negative", "B Positive", "B Negative", "AB Positive", "AB Negative"].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between">
                      Preferred Hospital
                      <button 
                        type="button" 
                        className="text-rose-600 hover:text-rose-700 text-[10px] flex items-center gap-1"
                        onClick={() => {
                          showToast('Fetching location...', 'info');
                          setTimeout(() => {
                            setNewPatientData(prev => ({ ...prev, preferredHospital: 'Apollo Hospital, Jubilee Hills' }));
                            showToast('Location identified: Apollo Hospital', 'success');
                          }, 800);
                        }}
                      >
                        <Search size={10} /> Use Current Location
                      </button>
                    </label>
                    <input required className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none" placeholder="e.g. Apollo Hospital" value={newPatientData.preferredHospital} onChange={e => setNewPatientData({ ...newPatientData, preferredHospital: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Next Transfusion Date</label>
                    <input required type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none" value={newPatientData.nextTransfusionDate} onChange={e => setNewPatientData({ ...newPatientData, nextTransfusionDate: e.target.value })} />
                  </div>
                  <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 mt-2 transition-colors">
                    REGISTER PATIENT
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================
          SECTION: DONOR FLEET
          ========================================= */}
      {activeSection === 'fleet' && (
        <div className="card h-full flex flex-col">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Users className="text-indigo-600" size={20} /> Donor Fleet
            </h3>
            <div className="flex gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50" placeholder="Search name or BG..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <select className="py-2 px-3 border border-slate-300 rounded-lg text-sm bg-white" value={fleetFilter} onChange={(e) => setFleetFilter(e.target.value)}>
                <option value="all">All Donors</option>
                <option value="eligible">Eligible Now</option>
                <option value="cooldown">In Cooldown</option>
                <option value="low-score">Low Reliability (&lt; 70%)</option>
              </select>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-indigo-900 mb-2 text-sm flex items-center gap-2"><HelpCircle size={16} /> Cooldown & Eligibility</h4>
            <p className="text-xs text-indigo-800 leading-relaxed">Donors require a mandatory rest period (90/120 days). <strong>Engage</strong> allows admins to ping low-reliability donors via WhatsApp.</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFleet.map(d => (
              <div key={d.id} className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {d.name}
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{d.bloodGroup}</span>
                      {d.activeStatus === 'Active' ? (
                        <span className="w-2 h-2 rounded-full bg-teal-500" title="Active"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" title="Inactive"></span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex gap-2">
                      <span>ID: {d.id}</span>
                      <span>| {d.assignedPatientId ? `Bridged (${d.assignedPatientId})` : 'Unassigned'}</span>
                      <span>| {d.travelDistanceKm}km</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {d.canDonate ? (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded border border-teal-200">✅ ELIGIBLE</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">⏳ COOLDOWN</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 flex flex-col gap-1">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                    <span>Role: <span className="font-semibold text-slate-700 capitalize">{d.role.replace(/_/g, ' ')}</span></span>
                    <span>Type: <span className="font-semibold text-slate-700">{d.donorType}</span></span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1 pt-1">
                    <span>Donations: <span className="font-semibold text-slate-700">{d.totalDonations}</span></span>
                    <span>Call Ratio: <span className="font-semibold text-slate-700">{d.callRatio}</span></span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span>Reliability: <span className={d.reliabilityScore >= 80 ? 'text-teal-600 font-bold' : d.reliabilityScore < 70 ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>{d.reliabilityScore}%</span></span>
                    <span>Coins: <span className="font-semibold text-amber-600">{d.coins}</span></span>
                  </div>
                </div>

                {d.reliabilityScore < 70 && (
                  <button
                    className="mt-1 w-full bg-slate-100 hover:bg-slate-200 text-indigo-700 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border border-slate-200"
                    onClick={() => setShowEngageModal(d)}
                  >
                    <MessageSquare size={14} /> ENGAGE DONOR
                  </button>
                )}
              </div>
            ))}
            {filteredFleet.length === 0 && <div className="text-center py-10 text-slate-500 italic md:col-span-2">No donors match the filters.</div>}
          </div>
        </div>
      )}

      {/* Engage Modal */}
      {showEngageModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2"><MessageSquare size={18} /> Engage Donor</h3>
              <button onClick={() => setShowEngageModal(null)} className="text-white/80 hover:text-white font-bold">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                You are about to manually engage <strong>{showEngageModal.name}</strong>. Their reliability score is critically low ({showEngageModal.reliabilityScore}%).
              </p>
              <textarea
                id="engageMessageInput"
                className="w-full border border-slate-300 rounded-lg p-3 text-sm h-24 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                defaultValue={`Hi ${showEngageModal.name.split(' ')[0]}, this is the ARIA Blood Warriors team. We noticed you haven't donated in a while. A patient at Apollo Hospital urgently needs your help. Can we count on you?`}
              ></textarea>
              <button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2"
                onClick={async () => {
                  const messageText = document.getElementById('engageMessageInput').value;
                  showToast('Sending engagement message via WhatsApp...', 'info');
                  try {
                    const res = await fetch(`${API_BASE}/api/engage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ donorName: showEngageModal.name, messageText })
                    });
                    const data = await res.json();
                    if (data.success) {
                      showToast(`Message dispatched to ${showEngageModal.name} via WhatsApp.`, 'success');
                      setShowEngageModal(null);
                    } else {
                      showToast('Failed to send WhatsApp message.', 'error');
                    }
                  } catch (err) {
                    showToast('Failed to reach backend API.', 'error');
                  }
                }}
              >
                <Send size={18} /> SEND DISPATCH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          SECTION: EMERGENCY DONORS
          ========================================= */}
      {activeSection === 'emergencies' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <div className="lg:col-span-2 card h-full flex flex-col">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 border-b border-slate-200 pb-4 mb-4">
              <AlertTriangle className="text-amber-500" size={20} /> Emergency Response Fleet
            </h3>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4 text-sm text-amber-800">
              <strong>Dispatch Now</strong> sends an emergency WhatsApp message to the donor immediately.
            </div>

            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
              {emergencyDonors.map(d => (
                <div key={d.id} className="p-4 bg-white border-2 border-amber-100 rounded-xl flex justify-between items-center shadow-sm hover:border-amber-300 transition-colors">
                  <div className="flex flex-col gap-1 w-2/3">
                    <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      {d.name}
                      <span className="text-xs font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">{d.bloodGroup}</span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
                      ID: {d.id} | Location: {d.travelDistanceKm}km away
                    </div>
                    <div className="text-xs text-amber-600 font-semibold mt-1">
                      Reliability: {d.reliabilityScore}% | Donations: {d.totalDonations}
                    </div>
                  </div>
                  <button
                    className="bg-amber-500 text-white text-xs font-bold px-5 py-3 rounded-xl hover:bg-amber-600 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                    onClick={async () => {
                      showToast('Sending emergency dispatch via WhatsApp...', 'info');
                      try {
                        const res = await fetch(`${API_BASE}/api/dispatch`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ donorId: d.id, donorName: d.name, distance: d.travelDistanceKm })
                        });
                        const data = await res.json();
                        if (data.success) {
                          showToast(`🚨 EMERGENCY DISPATCH SENT to ${d.name}!`, 'success');
                        } else {
                          showToast('Failed to send WhatsApp message.', 'error');
                        }
                      } catch (err) {
                        showToast('Failed to reach backend API.', 'error');
                      }
                    }}
                  >
                    <Phone size={16} /> DISPATCH NOW
                  </button>
                </div>
              ))}
              {emergencyDonors.length === 0 && <div className="text-center py-10 text-slate-500 italic">No emergency donors available right now.</div>}
            </div>
          </div>

          <div className="card h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Banknote className="text-rose-600" size={20} /> Local Blood Bank Status
            </h3>
            <p className="text-xs text-slate-600 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <strong>Why Pull From Bank?</strong> If the live volunteer pool completely fails, the Admin can manually request packed red blood cells from central reserves.
            </p>

            <div className="flex flex-col gap-4">
              <div className="border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-800">B+ Packed Cells</div>
                  <div className="text-xs text-slate-500">Apollo Blood Bank</div>
                </div>
                <div className="text-2xl font-black text-teal-600">18<span className="text-sm font-normal text-slate-500 ml-1">units</span></div>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-800">O+ Packed Cells</div>
                  <div className="text-xs text-slate-500">Apollo Blood Bank</div>
                </div>
                <div className="text-2xl font-black text-amber-500">6<span className="text-sm font-normal text-slate-500 ml-1">units</span></div>
              </div>
              <div className="border border-rose-200 bg-rose-50 rounded-xl p-4 flex justify-between items-center shadow-inner">
                <div>
                  <div className="font-bold text-rose-900">O- Universal</div>
                  <div className="text-xs text-rose-700">Central Reserve</div>
                </div>
                <div className="text-2xl font-black text-rose-600">2<span className="text-sm font-normal text-rose-600/70 ml-1">units</span></div>
              </div>
            </div>

            <button
              className="w-full mt-auto bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-colors flex justify-center items-center gap-2 shadow-lg"
              onClick={() => showToast('CRITICAL: Pulling 2 units of O- from Central Reserve.', 'info')}
            >
              <Banknote size={18} /> PULL FROM BANK
            </button>
          </div>
        </div>
      )}

      {/* =========================================
          SECTION: ADMIN PORTAL
          ========================================= */}
      {activeSection === 'admin' && (
        <div className="card max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Shield className="text-slate-500" size={20} /> Admin Settings
            </h3>
            <button
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg border ${isEditingProfile ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800 text-white border-slate-800'}`}
              onClick={() => {
                if (isEditingProfile) setProfileData({ name: 'Dr. Rajesh Kumar', region: 'Hyderabad', contactEmail: 'admin@bloodwarriors.org' });
                setIsEditingProfile(!isEditingProfile);
              }}
            >
              {isEditingProfile ? 'Cancel' : 'Edit Configuration'}
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <label className="!mt-0">Admin Name</label>
              {isEditingProfile ? (
                <input value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} />
              ) : (
                <div className="text-sm text-slate-800 font-medium py-2">{profileData.name}</div>
              )}
            </div>
            <div>
              <label className="!mt-0">City/Region</label>
              {isEditingProfile ? (
                <input value={profileData.region} onChange={e => setProfileData({ ...profileData, region: e.target.value })} />
              ) : (
                <div className="text-sm text-slate-800 font-medium py-2">{profileData.region}</div>
              )}
            </div>
            <div>
              <label className="!mt-0">Escalation Email</label>
              {isEditingProfile ? (
                <input value={profileData.contactEmail} onChange={e => setProfileData({ ...profileData, contactEmail: e.target.value })} />
              ) : (
                <div className="text-sm text-slate-800 font-medium py-2">{profileData.contactEmail}</div>
              )}
            </div>
            {isEditingProfile && (
              <button className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl shadow hover:bg-teal-700 mt-4" onClick={handleSaveProfile}>
                Save System Config
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
