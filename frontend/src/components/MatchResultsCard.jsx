import { useState } from 'react';
import { requestBloodMatch } from '../data/api';
import { useToast } from './Toast';
import { Search, Zap, MapPin, Award, Activity, ChevronDown, ChevronUp } from 'lucide-react';

export default function MatchResultsCard() {
  const showToast = useToast();
  const [formData, setFormData] = useState({
    patientName: '',
    bloodGroup: 'B Positive',
    urgency: 'high'
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedDonor, setExpandedDonor] = useState(null);

  const bloodGroups = [
    'A Positive', 'A Negative', 'B Positive', 'B Negative',
    'AB Positive', 'AB Negative', 'O Positive', 'O Negative'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientName.trim()) {
      showToast('Please enter a patient name', 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = await requestBloodMatch(formData.bloodGroup, formData.urgency, 3);
      setResults(data);
      showToast(`Found ${data.matched_donors?.length || 0} top matching donors`, 'success');
    } catch (err) {
      showToast('Failed to search donors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getScoreGradient = (score) => {
    if (score >= 0.8) return 'from-emerald-500 to-teal-500';
    if (score >= 0.6) return 'from-amber-400 to-orange-500';
    return 'from-rose-400 to-red-500';
  };

  const getSlotLabel = (idx) => {
    if (idx === 0) return { text: 'MAIN DONOR (Slot 1)', color: 'bg-teal-100 text-teal-800 border-teal-200' };
    if (idx === 1) return { text: 'BACKUP DONOR (Slot 2)', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { text: 'EMERGENCY (Slot 3)', color: 'bg-rose-100 text-rose-800 border-rose-200' };
  };

  return (
    <div className="card">
      <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4">
        <Search size={20} className="text-indigo-600" /> Smart Donor Matching — Top 3
      </h3>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 text-xs text-indigo-800">
        <strong>Scoring Formula:</strong> Score = (Reliability × 0.4) + (Proximity × 0.3) + (Experience × 0.3)<br />
        <span className="text-indigo-600">No black-box ML — pure explainable formula. Grace score 0.1 for first-time donors.</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Patient Name</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter patient name..."
              value={formData.patientName}
              onChange={e => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group Required</label>
            <select
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.bloodGroup}
              onChange={e => setFormData(prev => ({ ...prev, bloodGroup: e.target.value }))}
            >
              {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-700 mb-1">Urgency Level</label>
          <div className="flex gap-2">
            {['high', 'medium', 'low'].map(level => (
              <button
                key={level}
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors border ${
                  formData.urgency === level
                    ? level === 'high' ? 'bg-rose-600 text-white border-rose-600'
                      : level === 'medium' ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, urgency: level }))}
              >
                {level === 'high' ? '🔴' : level === 'medium' ? '🟡' : '🟢'} {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <><div className="w-5 h-5 border-2 border-t-white border-white/30 rounded-full animate-spin"></div> Scoring donors...</>
          ) : (
            <><Zap size={18} /> FIND TOP 3 MATCHING DONORS</>
          )}
        </button>
      </form>

      {/* Results: Top 3 with Explainable Breakdown */}
      {results && results.matched_donors && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-600">
              Found <strong className="text-indigo-600">{results.matched_donors.length}</strong> top donors
            </span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded">
              {results.request_id}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {results.matched_donors.map((donor, idx) => {
              const slot = getSlotLabel(idx);
              const isExpanded = expandedDonor === donor.donor_id;

              return (
                <div
                  key={donor.donor_id}
                  className={`border-2 rounded-xl overflow-hidden transition-all ${
                    idx === 0 ? 'border-teal-300 shadow-lg shadow-teal-100' :
                    idx === 1 ? 'border-amber-200 shadow-md shadow-amber-50' :
                    'border-rose-200 shadow-sm'
                  }`}
                >
                  {/* Donor Header */}
                  <div className="p-4 bg-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-black ${idx === 0 ? 'text-teal-600' : idx === 1 ? 'text-amber-500' : 'text-rose-500'}`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                          {donor.name}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${slot.color}`}>
                            {slot.text}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                          <span className="font-semibold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">{donor.blood_group}</span>
                          <span className="flex items-center gap-1"><MapPin size={10} /> {donor.distance_km} km</span>
                          <span>{donor.total_donations} donations</span>
                          <span className="capitalize">{donor.role.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Score Badge */}
                      <div className={`bg-gradient-to-r ${getScoreGradient(donor.score)} text-white px-4 py-2 rounded-xl text-center shadow-lg`}>
                        <div className="text-2xl font-black">{(donor.score * 100).toFixed(0)}%</div>
                        <div className="text-[9px] font-bold opacity-80">MATCH</div>
                      </div>

                      <button
                        className="text-slate-400 hover:text-slate-600 p-1"
                        onClick={() => setExpandedDonor(isExpanded ? null : donor.donor_id)}
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Explainable Score Breakdown */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-3 mb-2">
                        Score Breakdown (Explainable AI)
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                          <Activity size={16} className="mx-auto text-indigo-500 mb-1" />
                          <div className="text-xs text-slate-500 font-bold">Reliability</div>
                          <div className="text-lg font-black text-indigo-600">{(donor.breakdown.reliability * 100).toFixed(0)}%</div>
                          <div className="text-[10px] text-slate-400">{donor.successful_donations}/{donor.total_calls} calls</div>
                          <div className="text-[10px] text-slate-400 font-semibold">×0.4 weight</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                          <MapPin size={16} className="mx-auto text-teal-500 mb-1" />
                          <div className="text-xs text-slate-500 font-bold">Proximity</div>
                          <div className="text-lg font-black text-teal-600">{(donor.breakdown.proximity * 100).toFixed(0)}%</div>
                          <div className="text-[10px] text-slate-400">{donor.distance_km} km away</div>
                          <div className="text-[10px] text-slate-400 font-semibold">×0.3 weight</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                          <Award size={16} className="mx-auto text-amber-500 mb-1" />
                          <div className="text-xs text-slate-500 font-bold">Experience</div>
                          <div className="text-lg font-black text-amber-600">{(donor.breakdown.experience * 100).toFixed(0)}%</div>
                          <div className="text-[10px] text-slate-400">{donor.total_donations} donations{donor.total_donations === 0 ? ' (grace)' : ''}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">×0.3 weight</div>
                        </div>
                      </div>

                      {/* Natural Language Explanation */}
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800">
                        <strong>🧠 Judge Explanation:</strong> "{donor.explanation}"
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
