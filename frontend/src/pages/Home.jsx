import { motion } from 'framer-motion';
import { Shield, HeartPulse, Droplets, ArrowRight, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState } from 'react';
import SignUp from './SignUp';

function FeatureCard({ title, description, icon: Icon, gradient, delay, onClick }) {
  // Use a clean white background for the inner padding-box instead of the dark #1A1A1C requested
  const cardBackground = `linear-gradient(#ffffff, #ffffff) padding-box, ${gradient} border-box`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut", delay }}
      className="relative flex flex-col justify-start items-start w-full max-w-[260px] md:max-w-[300px] group mx-auto cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -5 }}
    >
      {/* Glow Background */}
      <div
        className="absolute w-full h-[260px] md:h-[300px] opacity-40 group-hover:opacity-60 transition-opacity duration-300 rounded-[40px] pointer-events-none"
        style={{ background: gradient, filter: "blur(45px)" }}
      />

      {/* Foreground Card with Gradient Border */}
      <div
        className="relative self-stretch h-[260px] md:h-[300px] rounded-[40px] z-10 overflow-hidden shadow-sm"
        style={{
          border: '8px solid transparent',
          background: cardBackground
        }}
      >
        <div className="w-full h-full p-7 flex flex-col justify-between">
          <div className="text-slate-700 bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner">
            <Icon size={32} strokeWidth={2.5} />
          </div>

          <div>
            <h3 className="text-slate-900 font-semibold text-xl mb-3 tracking-tight">{title}</h3>
            <p className="text-slate-500 text-[14px] leading-[1.6] font-normal selection:bg-rose-100">
              {description}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const mockChartData = [
  { name: 'Donors', count: 7033, color: '#0ea5e9' }, // Blue
  { name: 'Bridges', count: 786, color: '#0d9488' }, // Teal
  { name: 'Emergencies', count: 4, color: '#e11d48' } // Crimson
];

export default function Home({ onSelectRole, patients = [], donors = [], onNewDonor }) {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  
  const [authForm, setAuthForm] = useState({ 
    email: '', 
    password: '', 
    role: 'donor',
    selectedId: '',
    selectedName: ''
  });

  const handleSignIn = (e) => {
    e.preventDefault();
    onSelectRole(authForm.role, authForm.selectedId, authForm.selectedName);
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    onSelectRole('donor');
  };
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans overflow-x-hidden">

      {/* HackerRank-style Top Navbar */}
      <header className="w-full bg-white border-b border-slate-200 py-4 px-8 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-rose-600 text-white flex items-center justify-center font-bold">A</div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">ARIA</span>
        </div>
        <nav className="hidden md:flex gap-6 text-sm font-semibold text-slate-500">
          <a href="#" className="hover:text-slate-900">How it Works</a>
          <a href="#" className="hover:text-slate-900">For Doctors</a>
          <a href="#" className="hover:text-slate-900">For Donors</a>
        </nav>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowSignIn(true)} className="text-sm font-bold text-slate-800 hover:text-rose-600 transition-colors">
            Sign In
          </button>
          <button onClick={() => setShowSignUp(true)} className="text-sm font-bold text-white bg-rose-600 border border-rose-600 rounded px-4 py-2 hover:bg-rose-700 transition-colors shadow-sm">
            Sign Up
          </button>
        </div>
      </header>

      {/* Hero Section (Replaces the old text block) */}
      <section className="w-full max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
              Empowering Blood Warriors. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-rose-400">
                Connecting Lifelines.
              </span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
              ARIA is the intelligent nervous system for blood donation. We automatically manage bridge teams, track cooldowns, and predict emergencies before they happen.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowSignUp(true)} className="bg-slate-900 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                Join as Volunteer <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Data Visualization (Replaces text stats) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white rounded-[24px] border border-slate-200 shadow-xl shadow-slate-200/50 p-6 h-[350px] flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800">Live Network Capacity</h3>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              AI Active
            </span>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {mockChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </section>

      {/* Role Selection (Glowing Framer Motion Cards) */}
      <section className="w-full bg-white py-20 border-t border-slate-200 flex-1 flex flex-col items-center">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Access Your Portal</h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Select your role to enter the dashboard. ARIA provides specialized tools for administrators, patients, and donors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-3 lg:gap-8 w-full max-w-[1000px] px-6">
          <FeatureCard
            title="Community Admin"
            description="Manage the donor fleet, oversee AI bridge assignments, and monitor critical shortage alerts."
            icon={Shield}
            delay={0.1}
            gradient="linear-gradient(137deg, #0d9488 0%, #5eead4 45%, #0ea5e9 100%)"
            onClick={() => onSelectRole('community')}
          />
          <FeatureCard
            title="Patient Portal"
            description="Track your next transfusion dates, communicate with your bridge team, and manage records."
            icon={HeartPulse}
            delay={0.2}
            gradient="linear-gradient(137deg, #e11d48 0%, #fda4af 45%, #f43f5e 100%)"
            onClick={() => onSelectRole('patient')}
          />
          <FeatureCard
            title="Donor Hub"
            description="Log donations, earn rewards, and pledge to become a lifeline bridge for patients in need."
            icon={Droplets}
            delay={0.3}
            gradient="linear-gradient(137deg, #f59e0b 0%, #fcd34d 45%, #fb923c 100%)"
            onClick={() => onSelectRole('donor')}
          />
        </div>
      </section>

      {/* Info Section */}
      <section className="w-full bg-slate-50 py-20 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Understanding the Mission</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Everything you need to know about the Blood Warriors ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-xl font-bold text-rose-600 mb-3 flex items-center gap-2">
                <HeartPulse size={24} /> What is Thalassemia?
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Thalassemia is a genetic blood disorder that prevents the body from producing enough hemoglobin.
                Patients require lifelong, regular blood transfusions every 2 to 4 weeks simply to survive.
                Our mission ensures they never have to fight to find blood.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-xl font-bold text-teal-600 mb-3 flex items-center gap-2">
                <Shield size={24} /> Who are Bridge Donors?
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                A "Bridge" is a cycle of 10 dedicated donors assigned to a single patient. Because donors need a cooldown period between donations, these 10 donors rotate throughout the year. This guarantees the patient a reliable, lifelong supply of safe blood.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-xl font-bold text-sky-600 mb-3 flex items-center gap-2">
                <Droplets size={24} /> Volunteer Eligibility & Cooldowns
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Any healthy adult between 18-65 years weighing over 45kg can volunteer to donate! For safety, there is a mandatory rest period between donations: <strong>90 days for men</strong> and <strong>120 days for women</strong>. ARIA automatically tracks this to protect your health.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-xl font-bold text-amber-500 mb-3 flex items-center gap-2">
                🪙 ARIA Rewards System
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                To thank you for saving lives, ARIA awards <strong>Coins</strong> for every successful donation, rapid chatbot response, and consistent donation streak. Coins can be redeemed for exclusive health checkups, community events, and partner discounts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-slate-900 text-slate-400 py-12 px-8 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded bg-rose-600 text-white flex items-center justify-center font-bold">A</div>
              <span className="font-bold text-xl text-white tracking-tight">ARIA</span>
            </div>
            <p className="text-sm max-w-sm leading-relaxed mb-6">
              The intelligent AI nervous system powering the Blood Warriors foundation. Ensuring no patient ever has to wait for life-saving blood.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-rose-400 transition-colors">About Blood Warriors</a></li>
              <li><a href="#" className="hover:text-rose-400 transition-colors">Our Bridge Methodology</a></li>
              <li><a href="#" className="hover:text-rose-400 transition-colors">Donor Eligibility</a></li>
              <li><a href="#" className="hover:text-rose-400 transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:contact@bloodwarriors.in" className="hover:text-white transition-colors">contact@bloodwarriors.in</a></li>
              <li><a href="tel:+918005550199" className="hover:text-white transition-colors">+91 800-555-0199</a></li>
              <li className="pt-2">123 Lifeline Avenue, Hyderabad, India</li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-800 text-sm text-slate-500 flex justify-between items-center">
          <p>© 2026 Blood Warriors ARIA. All rights reserved.</p>
        </div>
      </footer>

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h3>
                <button onClick={() => setShowSignIn(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sign in as</label>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['donor', 'patient', 'community'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          const list = r === 'donor' ? donors : (r === 'patient' ? patients : []);
                          setAuthForm({ 
                            ...authForm, 
                            role: r, 
                            selectedId: list.length > 0 ? list[0].id : '',
                            selectedName: list.length > 0 ? list[0].name : ''
                          });
                        }}
                        className={`py-2 rounded-lg text-xs font-bold transition-colors border ${authForm.role === r ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {r === 'community' ? 'Admin' : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {authForm.role !== 'community' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Profile</label>
                    <select 
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white mb-4"
                      value={authForm.selectedId}
                      onChange={e => {
                        const list = authForm.role === 'donor' ? donors : patients;
                        const selected = list.find(item => item.id === e.target.value);
                        setAuthForm({ ...authForm, selectedId: selected?.id, selectedName: selected?.name });
                      }}
                    >
                      {authForm.selectedId === '' && <option value="" disabled>Select a profile...</option>}
                      {(authForm.role === 'donor' ? donors : patients).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.bloodGroup || 'Admin'})</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <input type="password" disabled className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-slate-50 text-slate-400 outline-none" placeholder="Password not required for demo" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
                </div>
                <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-lg mt-2 transition-colors">
                  Enter Portal
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Sign Up Modal / View */}
      {showSignUp && (
        <SignUp
          onBack={() => setShowSignUp(false)}
          onSignupSuccess={(newUser) => {
            if (onNewDonor) onNewDonor(newUser);
            onSelectRole('donor', newUser.id, newUser.name);
          }}
        />
      )}
    </div>
  );
}
