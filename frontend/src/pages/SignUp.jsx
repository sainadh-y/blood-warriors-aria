import { useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../components/Toast';
import { ArrowLeft, Droplets, CheckCircle2, MapPin } from 'lucide-react';
import Tooltip from '../components/Tooltip';
import { apiCall, API_BASE } from '../data/api';

const BLOOD_GROUP_OPTIONS = [
  'A Positive',
  'A Negative',
  'B Positive',
  'B Negative',
  'O Positive',
  'O Negative',
  'AB Positive',
  'AB Negative'
];

export default function SignUp({ onBack, onSignupSuccess }) {
  const showToast = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    age: '',
    gender: 'Male',
    bloodGroup: 'O Positive',
    lastDonation: '',
    area: '',
    consentBridge: false
  });
  const [phoneError, setPhoneError] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDetectLocation = () => {
    setIsDetecting(true);
    setTimeout(() => {
      const simulatedAreas = [
        'Apollo Jubilee Hills Zone',
        'KIMS Secunderabad Area',
        'Yashoda Somajiguda Zone'
      ];
      setFormData((prev) => ({
        ...prev,
        area: simulatedAreas[Math.floor(Math.random() * simulatedAreas.length)]
      }));
      setIsDetecting(false);
      showToast('Location mapped to the nearest supported hospital zone.', 'success');
    }, 1200);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/signup/donor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
          bloodGroup: formData.bloodGroup,
          age: parseInt(formData.age),
          gender: formData.gender,
          location: formData.area,
          lastDonation: formData.lastDonation,
          consentBridge: formData.consentBridge,
          phone: formData.phone
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      setIsSuccess(true);
      showToast('Welcome to Blood Warriors! Your profile is active.', 'success');
      setTimeout(() => {
        onSignupSuccess?.(data.user);
      }, 1200);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 w-full absolute inset-0 z-[200]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-10 rounded-[32px] shadow-xl max-w-md w-full text-center border border-slate-200"
        >
          <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-teal-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-4 tracking-tight">Registration Complete</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Thank you, {formData.fullName}. Your donor account is live and linked to the backend dataset.
            {formData.consentBridge && ' You have also joined the bridge donor pool.'}
          </p>
          <button
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
            onClick={onBack}
          >
            Return to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 flex flex-col items-center absolute inset-0 z-[200] overflow-y-auto">
      <div className="w-full max-w-2xl mt-8 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold mb-8 transition-colors"
        >
          <ArrowLeft size={20} /> Back to Home
        </button>

        <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
              <Droplets size={200} />
            </div>
            <h1 className="text-3xl font-extrabold mb-2 relative z-10">Join the Fleet</h1>
            <p className="text-slate-400 relative z-10">Register as a Blood Warrior and sync your donor profile.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h3 className="text-xl font-bold text-slate-800 mb-6">Step 1: Basic Information</h3>

                <div className="space-y-5">
                  <div>
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Full Name
                      <Tooltip text="Use the same name you expect hospitals or coordinators to recognize." />
                    </label>
                    <input
                      required
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                      <input
                        required
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">Password</label>
                      <input
                        required
                        type="password"
                        name="password"
                        minLength="6"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                        placeholder="Create a strong password"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Contact Number
                      <Tooltip text="Used for urgent coordination. Enter exactly 10 digits." />
                    </label>
                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      name="phone"
                      maxLength="10"
                      value={formData.phone}
                      onChange={(event) => {
                        const numericValue = event.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData((prev) => ({ ...prev, phone: numericValue }));
                        setPhoneError(numericValue.length > 0 && numericValue.length !== 10 ? 'Contact number must be exactly 10 digits.' : '');
                      }}
                      className={`w-full p-4 bg-slate-50 border ${phoneError ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 focus:ring-rose-500'} rounded-xl focus:ring-2 outline-none transition-all`}
                      placeholder="9876543210"
                    />
                    {phoneError && <p className="text-xs text-rose-600 mt-2 font-semibold">{phoneError}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                        Age
                        <Tooltip text="Donors must currently be between 18 and 65 years old." />
                      </label>
                      <input
                        required
                        type="number"
                        min="18"
                        max="65"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        placeholder="25"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.fullName || !formData.email || !formData.password || !formData.age || formData.phone.length !== 10}
                    className="w-full bg-rose-600 text-white font-bold py-4 rounded-xl mt-4 hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    Next Step
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h3 className="text-xl font-bold text-slate-800 mb-6">Step 2: Medical and Location</h3>

                <div className="space-y-5">
                  <div>
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Blood Group
                      <Tooltip text="The matching engine uses this for compatibility scoring and emergency routing." />
                    </label>
                    <select
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleChange}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                    >
                      {BLOOD_GROUP_OPTIONS.map((bloodGroup) => (
                        <option key={bloodGroup} value={bloodGroup}>{bloodGroup}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Hospital Zone Mapping
                      <Tooltip text="Maps you to the nearest supported response zone for faster donor dispatch." />
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isDetecting}
                        className="bg-slate-800 text-white p-4 rounded-xl hover:bg-slate-900 transition-colors flex items-center justify-center disabled:opacity-50"
                      >
                        <MapPin size={20} className={isDetecting ? 'animate-bounce' : ''} />
                      </button>
                      <input
                        required
                        readOnly
                        name="area"
                        value={formData.area}
                        className="flex-1 p-4 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none"
                        placeholder="Click the icon to detect your zone"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                      Date of Last Donation
                      <Tooltip text="Used to calculate your cooldown period and current eligibility." />
                    </label>
                    <input
                      required
                      type="date"
                      name="lastDonation"
                      value={formData.lastDonation}
                      onChange={handleChange}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all text-slate-600"
                    />
                    <p className="text-xs text-slate-500 mt-2">ARIA uses this date to calculate your next safe donation window.</p>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 p-5 rounded-xl flex items-start gap-4 mt-6">
                    <input
                      type="checkbox"
                      name="consentBridge"
                      checked={formData.consentBridge}
                      onChange={handleChange}
                      className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                      id="consent-bridge"
                    />
                    <label htmlFor="consent-bridge" className="text-sm text-slate-700 cursor-pointer select-none">
                      <strong className="text-rose-900 block mb-1">Pledge as a Bridge Donor</strong>
                      I am willing to support recurring donations for a specific patient when ARIA assigns me.
                    </label>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 mt-8">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="md:w-1/3 bg-slate-100 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!formData.area || !formData.lastDonation || isSubmitting}
                      className="md:w-2/3 bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                    >
                      {isSubmitting ? 'Registering...' : 'Complete Registration'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
