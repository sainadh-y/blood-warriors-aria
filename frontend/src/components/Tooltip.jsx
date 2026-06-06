import { Info } from 'lucide-react';

export default function Tooltip({ text }) {
  return (
    <div className="relative flex items-center group cursor-help ml-1 inline-block">
      <div className="w-4 h-4 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-800 hover:text-white transition-colors">
        <span className="text-[10px] font-bold">!</span>
      </div>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-slate-700">
        {text}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
      </div>
    </div>
  );
}
