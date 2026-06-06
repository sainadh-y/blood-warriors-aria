import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { generateBridgePrompts, coupons, events, chatMessages } from '../data/state';
import { Droplets, Award, Calendar, Send, User, MapPin, HeartPulse, Clock, ShieldAlert, Radio, Timer } from 'lucide-react';
import Tooltip from '../components/Tooltip';

export default function DonorView({ activeSection, donor, patients, onUpdate }) {
  const showToast = useToast();
  const [prompts, setPrompts] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [ledger, setLedger] = useState([]);
  const [redeemedCodes, setRedeemedCodes] = useState({});
  const [eventPasses, setEventPasses] = useState({});

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: donor.name,
    contact: donor.contact,
    preferredLocation: donor.preferredLocation || 'Main Blood Center',
  });

  useEffect(() => {
    setPrompts(generateBridgePrompts(4));
    fetch('http://localhost:3000/donors/wallet/ledger')
      .then(res => res.json())
      .then(data => {
        if (data && data.ledger) setLedger(data.ledger);
      })
      .catch(err => console.log('Failed to fetch ledger:', err));
  }, []);

  const myPatient = patients.find(p => p.id === donor.assignedPatientId);

  // Early donation logic (within 10 days)
  const today = new Date();
  const eligibleDate = donor.nextEligibleDate ? new Date(donor.nextEligibleDate) : today;
  const daysUntilEligible = Math.ceil((eligibleDate - today) / (1000 * 60 * 60 * 24));
  const canDonateEarly = !donor.canDonate && daysUntilEligible > 0 && daysUntilEligible <= 10;

  const handleSaveProfile = () => {
    onUpdate({ ...donor, ...profileData });
    setIsEditingProfile(false);
    showToast('Profile updated successfully', 'success');
  };

  const handleRecordDonation = () => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 90);
    const updatedDonor = {
      ...donor,
      canDonate: false,
      nextEligibleDate: nextDate.toISOString().split('T')[0],
      totalDonations: donor.totalDonations + 1,
      coins: donor.coins + 90
    };
    onUpdate(updatedDonor);
    showToast(`🩸 Donation recorded! +90 coins earned. Next eligible: ${updatedDonor.nextEligibleDate}`, 'success');
  };

  const handleBecomeBridge = (prompt) => {
    showToast(`Pledged to become a bridge for ${prompt.patientName}.`, 'success');
    setPrompts(prev => prev.filter(p => p.id !== prompt.id));
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* =========================================
          SECTION: MAIN DASHBOARD 
          ========================================= */}
      {activeSection === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dynamic Left Column based on Bridge Status */}
          <div className="flex flex-col gap-6">
            {myPatient ? (
              // IS BRIDGED VIEW
              <div className="card h-full flex flex-col">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-6">
                  <HeartPulse className="text-rose-500" size={20} /> My Bridge Mission
                </h3>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
                  <div className="font-bold text-slate-800 text-xl mb-1">{myPatient.name}</div>
                  <div className="text-sm text-slate-500 mb-4 flex items-center gap-2">
                    <MapPin size={14} /> {myPatient.preferredHospital || 'City Hospital'}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Urgency</span>
                      <span className={`font-bold ${myPatient.emergencyMode ? 'text-rose-600' : 'text-teal-600'}`}>
                        {myPatient.emergencyMode ? 'HIGH - EMERGENCY' : 'STABLE'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Blood Required</span>
                      <span className="font-bold text-slate-800">{donor.bloodGroup}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Next Transfusion</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Clock size={14} /> {myPatient.nextTransfusionDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto">
                  {donor.canDonate ? (
                    <button className="w-full bg-rose-600 text-white font-semibold py-3 rounded-xl shadow hover:bg-rose-700 transition-colors" onClick={handleRecordDonation}>
                      Record Donation (+90 coins)
                    </button>
                  ) : canDonateEarly ? (
                    <div className="w-full text-center p-4 border border-teal-200 bg-teal-50 rounded-xl">
                      <div className="text-sm text-teal-800 font-bold mb-2">You are within 10 days of your eligibility ({daysUntilEligible} days left).</div>
                      <button className="w-full bg-teal-600 text-white font-semibold py-2 rounded-lg hover:bg-teal-700 transition-colors" onClick={handleRecordDonation}>
                        Donate Early at Hospital
                      </button>
                    </div>
                  ) : (
                    <div className="w-full text-center bg-amber-50 text-amber-700 font-semibold py-3 rounded-xl border border-amber-100">
                      Cooldown period. Next eligible: {donor.nextEligibleDate}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // NOT BRIDGED VIEW
              <div className="card h-full">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-2">
                  <Droplets className="text-rose-500" size={20} /> Choose Your Path
                </h3>
                <p className="text-sm text-slate-500 mb-6">You are currently unassigned. Choose how you want to save lives.</p>

                {!donor.canDonate && (
                  <div className="w-full text-center bg-amber-50 text-amber-700 font-semibold py-4 rounded-xl border border-amber-100 mb-6">
                    <div className="text-lg mb-1">⏳ Cooldown Active</div>
                    <div className="text-sm font-normal">You recently donated. You cannot pledge or donate again until: <strong>{donor.nextEligibleDate}</strong></div>
                  </div>
                )}

                {donor.canDonate && (
                  <>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-6 shadow-sm">
                      <h4 className="font-bold text-rose-900 mb-2 flex items-center gap-2">
                        <Droplets size={16} /> Donate Now (One-Time)
                      </h4>
                      <p className="text-xs text-rose-700 mb-4">
                        Provide a one-time blood donation to the general pool. This will put you on a mandatory 90-day cooldown where you cannot be bridged or donate again.
                      </p>
                      <button 
                        className="w-full bg-rose-600 text-white font-bold py-3 rounded-lg hover:bg-rose-700 transition-colors shadow"
                        onClick={handleRecordDonation}
                      >
                        RECORD ONE-TIME DONATION (+90 COINS)
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 mb-6">
                      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col hover:shadow-lg transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Radio size={80} /></div>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                          <div>
                            <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                              <Radio size={16} className="text-teal-400" /> Incoming Bridge Request
                            </h4>
                            <p className="text-xs text-slate-400">The AI has identified you as a perfect match for Priya Sharma (A+). Will you pledge?</p>
                          </div>
                          <div className="bg-slate-800 text-rose-400 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 shadow-inner">
                            <Timer size={14} className="animate-pulse" /> 05:59:42 LEFT <Tooltip text="If you do not accept within 6 hours, the AI will bypass you and request another donor." />
                          </div>
                        </div>
                        
                        <div className="text-[10px] text-slate-500 bg-slate-800 p-2 rounded mb-4 border border-slate-700">
                          Note: Once accepted, you and 9 other donors have exactly <strong>15 days</strong> to fulfill the remaining slots and complete this bridge.
                        </div>

                        <div className="flex gap-2 w-full relative z-10">
                          <button className="flex-1 bg-slate-700 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-slate-600 transition-colors">
                            DECLINE
                          </button>
                          <button 
                            className="flex-1 bg-teal-500 text-slate-900 text-xs font-extrabold py-2.5 rounded-lg hover:bg-teal-400 transition-colors shadow-lg"
                            onClick={() => showToast('Bridge request accepted! You have 15 days to form the bridge.', 'success')}
                          >
                            ACCEPT REQUEST
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto pr-2">
                      {prompts.slice(0, 3).map(prompt => (
                        <div key={prompt.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-amber-300 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${prompt.urgency === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                              {prompt.urgency === 'high' ? 'Urgent Need' : 'Unbridged'}
                            </span>
                          </div>
                          <div className="font-bold text-slate-800">{prompt.patientName}</div>
                          <div className="text-xs text-slate-500 mb-3">{prompt.location} • Needs {prompt.bridgesNeeded - prompt.currentBridges} bridges</div>
                          <button 
                            className="w-full bg-slate-800 text-white text-xs font-semibold py-2 rounded-lg hover:bg-slate-900"
                            onClick={() => handleBecomeBridge(prompt)}
                          >
                            Pledge as Bridge
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Chat (Only if bridged) or General status */}
          <div className="flex flex-col gap-6">
            {myPatient ? (
              <div className="card flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                  Communication
                </h3>
                
                <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 min-h-[300px]">
                  {chatMessages.filter(c => c.bridgeId === `${myPatient.id}-${donor.id}`).map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.type === 'donor' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                        msg.type === 'donor' ? 'bg-amber-100 text-amber-900 rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex gap-2 pt-3 border-t border-slate-100">
                  <input
                    className="flex-1 bg-slate-50 text-sm"
                    placeholder="Message..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && setChatInput('')}
                  />
                  <button className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-900" onClick={() => setChatInput('')}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center min-h-[300px] text-center p-8 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
                  <Droplets className="text-amber-500" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">No Active Assignment</h3>
                <p className="text-sm text-slate-500 mb-6">
                  You are currently floating in the general donor pool. ARIA will automatically assign you to a patient if an emergency match occurs, or you can pledge manually.
                </p>
                <div className="flex gap-4 w-full">
                  <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 flex flex-col">
                    <div className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1">Reliability <Tooltip text="Drops drastically if you miss hospital appointments or ignore AI dispatches." /></div>
                    <div className="text-xl font-bold text-teal-600 mt-1">{donor.reliabilityScore}%</div>
                  </div>
                  <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 flex flex-col">
                    <div className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1">Status <Tooltip text="Whether you are legally cleared to donate today, based on your 90/120 day resting window." /></div>
                    <div className="text-sm font-bold mt-1 text-slate-700">{donor.canDonate ? 'Ready' : 'Cooldown'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================
          SECTION: DONATION NEEDS
          ========================================= */}
      {activeSection === 'needs' && (
        myPatient ? (
          <div className="card h-[600px] flex flex-col items-center justify-center text-center bg-slate-50 border-rose-100">
             <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 shadow-sm text-rose-500">
               <ShieldAlert size={40} />
             </div>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
             <p className="text-slate-500 max-w-md">
               You are currently locked into an active bridge for <strong>{myPatient.name}</strong>. To ensure their survival, the AI engine strictly forbids you from donating to the general pool or pledging to another patient until your cycle is complete.
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card h-[600px] overflow-y-auto">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-6">
                <ShieldAlert className="text-rose-500" size={20} /> Urgent Needs & New Needers
              </h3>

            <div className="flex flex-col gap-4">
              {prompts.map(prompt => (
                <div key={prompt.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                  {prompt.urgency === 'high' && (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-100 rounded-bl-full flex items-start justify-end p-2">
                      <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse mr-1 mt-1"></div>
                    </div>
                  )}
                  
                  <div className="font-bold text-slate-800 text-lg mb-1">{prompt.patientName}</div>
                  <div className="text-sm text-slate-500 mb-4 flex items-center gap-2">
                    <MapPin size={14} /> {prompt.location}
                  </div>
                  
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg mb-4">
                    <div className="text-center">
                      <div className="text-xs text-slate-400 uppercase font-bold">Blood Group</div>
                      <div className="font-bold text-slate-700">{donor.bloodGroup}</div>
                    </div>
                    <div className="text-center border-l border-r border-slate-200 px-4">
                      <div className="text-xs text-slate-400 uppercase font-bold">Bridges Needed</div>
                      <div className="font-bold text-slate-700">{prompt.bridgesNeeded - prompt.currentBridges}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-400 uppercase font-bold">Required By</div>
                      <div className="font-bold text-rose-600">{prompt.needByDate}</div>
                    </div>
                  </div>
                  
                    <button 
                      className={`w-full font-semibold py-3 rounded-lg transition-colors ${prompt.urgency === 'high' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                      onClick={() => handleBecomeBridge(prompt)}
                    >
                      Commit to Donate
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="card h-[600px] flex flex-col items-center justify-center text-center bg-slate-50">
               <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-slate-400">
                 <HeartPulse size={32} />
               </div>
               <h3 className="font-bold text-slate-700 mb-2">More Needs Loading...</h3>
               <p className="text-sm text-slate-500">ARIA is continuously scanning for compatible patients.</p>
            </div>
          </div>
        )
      )}

      {/* =========================================
          SECTION: WALLET (Rewards & Camps)
          ========================================= */}
      {activeSection === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="card text-center bg-gradient-to-b from-amber-50 to-white border-amber-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Award size={100} /></div>
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
                <Award className="text-amber-500" size={40} />
              </div>
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1 relative z-10">Total ARIA Coins</h4>
              <div className="text-5xl font-extrabold text-amber-600 mb-6 relative z-10">{donor.coins}</div>
              
              <div className="bg-white rounded-lg border border-slate-100 p-4 text-left relative z-10">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Lifetime Impact</div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Total Donations</span>
                  <span className="font-bold text-slate-800">{donor.totalDonations}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Lives Saved (Est.)</span>
                  <span className="font-bold text-slate-800">{donor.totalDonations * 3}</span>
                </div>
              </div>
            </div>

            <div className="card max-h-[400px] flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Financial Ledger</h3>
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                {ledger.slice(0, 8).map((tx, idx) => (
                  <div key={idx} className="flex flex-col border-b border-slate-50 pb-2 mb-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] text-slate-400 font-bold">{tx.date || 'Today'}</span>
                      {tx.type === 'EARN' ? (
                        <span className="text-xs font-bold text-teal-600">+{tx.amount}</span>
                      ) : (
                        <span className="text-xs font-bold text-rose-600">{tx.amount}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 leading-snug">{tx.reason.replace(/"/g, '')}</div>
                  </div>
                ))}
                {ledger.length === 0 && <div className="text-xs text-slate-500 text-center italic">No transactions found.</div>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="card">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Award size={20} className="text-amber-500" /> Redeem Rewards
              </h3>
              <p className="text-sm text-slate-500 mb-6 bg-slate-50 p-3 rounded-lg">Exchange your ARIA Coins for exclusive health checkups and partner discounts. Redeemed codes expire strictly in 20 days.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coupons.map(c => {
                  const isRedeemed = redeemedCodes[c.id];
                  return (
                    <div key={c.id} className={`border ${isRedeemed ? 'border-teal-300 bg-teal-50' : 'border-slate-200'} rounded-xl p-5 relative overflow-hidden transition-all`}>
                      <div className="font-bold text-lg text-slate-800 mb-1">{c.code}</div>
                      <div className="text-sm font-semibold text-amber-600 mb-4">
                        {c.discountType === 'percentage' ? `${c.discountValue}% Off` : `₹${c.discountValue} Discount`}
                      </div>
                      
                      {isRedeemed ? (
                        <div className="mt-2 text-center">
                          <div className="bg-white border border-teal-200 rounded p-2 mb-2 font-mono text-teal-800 font-bold text-lg shadow-sm">
                            ARIA-{c.id.toUpperCase()}-{(Math.random()*10000).toFixed(0)}
                          </div>
                          <div className="text-[10px] font-bold text-rose-600">EXPIRES IN 20 DAYS</div>
                        </div>
                      ) : (
                        <button 
                          className="w-full border-2 border-amber-500 text-amber-600 font-bold py-2 rounded-lg hover:bg-amber-500 hover:text-white transition-colors"
                          onClick={() => {
                            if (donor.coins >= 50) {
                              setRedeemedCodes(prev => ({...prev, [c.id]: true}));
                              onUpdate({...donor, coins: donor.coins - 50});
                              showToast(`Successfully redeemed! 50 coins deducted.`, 'success');
                            } else {
                              showToast('Insufficient ARIA coins.', 'error');
                            }
                          }}
                        >
                          REDEEM (50 Coins)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-indigo-500" /> Community Events & Camps
              </h3>
              <p className="text-sm text-slate-500 mb-6 bg-slate-50 p-3 rounded-lg">Pay with coins to enter ARIA-verified events. Your event pass expires exactly at midnight on the event date.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map(e => {
                  const hasPass = eventPasses[e.id];
                  return (
                    <div key={e.id} className={`p-4 ${hasPass ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'} border rounded-xl flex flex-col gap-4 items-start transition-colors`}>
                      <div className="flex gap-4 w-full">
                        <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center shadow-sm flex-shrink-0 ${hasPass ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-slate-50 border-slate-200 text-rose-600'}`}>
                          <Calendar size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 leading-tight">{e.name}</div>
                          <div className="text-xs text-slate-500 mt-1">{e.venue}</div>
                          <div className="text-xs font-semibold text-teal-600 mt-2 bg-teal-50 inline-block px-2 py-1 rounded">
                            {e.date}
                          </div>
                        </div>
                      </div>
                      
                      {hasPass ? (
                        <div className="w-full bg-indigo-100 text-indigo-800 text-center text-xs font-bold py-2 rounded">
                          ENTRY PASS GRANTED (EXPIRES ON {e.date})
                        </div>
                      ) : (
                        <button 
                          className="w-full bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded hover:bg-slate-200 transition-colors"
                          onClick={() => {
                            if (donor.coins >= 100) {
                              setEventPasses(prev => ({...prev, [e.id]: true}));
                              onUpdate({...donor, coins: donor.coins - 100});
                              showToast(`Event Pass granted! 100 coins deducted.`, 'success');
                            } else {
                              showToast('Insufficient ARIA coins.', 'error');
                            }
                          }}
                        >
                          PAY WITH COINS (100)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          SECTION: PROFILE
          ========================================= */}
      {activeSection === 'profile' && (
        <div className="card max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <User className="text-slate-500" size={20} /> Donor Profile
            </h3>
            <button 
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg border ${isEditingProfile ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800 text-white border-slate-800'}`}
              onClick={() => {
                if (isEditingProfile) {
                  setProfileData({ name: donor.name, contact: donor.contact, preferredLocation: donor.preferredLocation || 'Main Blood Center' });
                }
                setIsEditingProfile(!isEditingProfile);
              }}
            >
              {isEditingProfile ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
          
          <div className="flex flex-col gap-6">
            <div>
              <label className="!mt-0">Full Name</label>
              {isEditingProfile ? (
                <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} />
              ) : (
                <div className="text-sm text-slate-800 font-medium py-2">{donor.name}</div>
              )}
            </div>

            <div>
              <label className="!mt-0">Contact Number</label>
              {isEditingProfile ? (
                <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" value={profileData.contact} onChange={e => setProfileData({ ...profileData, contact: e.target.value })} />
              ) : (
                <div className="text-sm text-slate-800 font-medium py-2">{donor.contact}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="!mt-0 flex items-center gap-1">Blood Group <Tooltip text="Immutable field. Assigned by the AI engine based on your medical records." /></label>
                <div className="text-sm font-bold text-rose-600 bg-rose-50 inline-block px-3 py-1.5 rounded mt-2 cursor-not-allowed">{donor.bloodGroup}</div>
              </div>
              <div>
                <label className="!mt-0 flex items-center gap-1">Gender <Tooltip text="Immutable field." /></label>
                <div className="text-sm text-slate-500 bg-slate-50 inline-block px-3 py-1.5 rounded mt-2 border border-slate-200 cursor-not-allowed">{donor.gender || 'Not Specified'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="!mt-0 flex items-center gap-1">Age <Tooltip text="Immutable field." /></label>
                <div className="text-sm text-slate-500 bg-slate-50 inline-block px-3 py-1.5 rounded mt-2 border border-slate-200 cursor-not-allowed">{donor.age || 'Not Specified'}</div>
              </div>
              <div>
                <label className="!mt-0 flex items-center gap-1">Reliability Score <Tooltip text="Calculated dynamically by the AI based on your participation." /></label>
                <div className="text-sm font-bold text-teal-600 bg-teal-50 inline-block px-3 py-1.5 rounded mt-2 border border-teal-200 cursor-not-allowed">{donor.reliabilityScore}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="!mt-0 flex items-center gap-1">Total Donations <Tooltip text="Lifetime donation count." /></label>
                <div className="text-sm text-slate-500 bg-slate-50 inline-block px-3 py-1.5 rounded mt-2 border border-slate-200 cursor-not-allowed">{donor.totalDonations}</div>
              </div>
              <div>
                <label className="!mt-0 flex items-center gap-1">Last Donation Date <Tooltip text="Used to calculate cooldowns." /></label>
                <div className="text-sm text-slate-500 bg-slate-50 inline-block px-3 py-1.5 rounded mt-2 border border-slate-200 cursor-not-allowed">{donor.lastDonationDate || 'N/A'}</div>
              </div>
            </div>

            <div>
              <label className="!mt-0 flex items-center gap-1">Preferred Donation Area <Tooltip text="Used by the AI to map you to the nearest hospital zone." /></label>
              {isEditingProfile ? (
                <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" value={profileData.preferredLocation} onChange={e => setProfileData({ ...profileData, preferredLocation: e.target.value })} />
              ) : (
                <div className="text-sm text-slate-800 font-medium py-2">{profileData.preferredLocation}</div>
              )}
            </div>

            {isEditingProfile && (
              <button className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl shadow hover:bg-teal-700 mt-4" onClick={handleSaveProfile}>
                Save Changes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
