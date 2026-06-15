import React, { useState } from 'react';
import { MapPin, AlertTriangle, Construction, CloudRain, Car, Send, X, MessageSquarePlus } from 'lucide-react';

interface CongestionReport {
  id: string;
  lat: number;
  lng: number;
  severity: number; // 1-5
  type: string;
  note: string;
  timestamp: string;
}

interface Props {
  reports: CongestionReport[];
  onSubmitReport: (report: { lat: number; lng: number; severity: number; type: string; note: string }) => void;
  mapCenter: [number, number];
}

const REPORT_TYPES = [
  { id: 'traffic_jam', label: 'Traffic Jam', icon: Car, color: 'text-rose-400' },
  { id: 'accident', label: 'Accident', icon: AlertTriangle, color: 'text-amber-400' },
  { id: 'road_work', label: 'Road Work', icon: Construction, color: 'text-orange-400' },
  { id: 'flooding', label: 'Flooding', icon: CloudRain, color: 'text-blue-400' },
];

export default function CongestionReporter({ reports, onSubmitReport, mapCenter }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState(3);
  const [type, setType] = useState('traffic_jam');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!location.trim()) return;
    setIsSubmitting(true);

    // Try to geocode the location using ORS
    let lat = mapCenter[0] + (Math.random() - 0.5) * 0.02;
    let lng = mapCenter[1] + (Math.random() - 0.5) * 0.02;

    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(location)}`);
      const data = await res.json();
      if (data.lat && data.lng) {
        lat = data.lat;
        lng = data.lng;
      }
    } catch (e) {
      // Use random offset from center as fallback
    }

    onSubmitReport({ lat, lng, severity, type, note });

    setIsSubmitting(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setIsOpen(false);
      setLocation('');
      setNote('');
      setSeverity(3);
      setType('traffic_jam');
    }, 1500);
  };

  const activeReports = reports.filter(r => {
    const age = Date.now() - new Date(r.timestamp).getTime();
    return age < 30 * 60 * 1000; // 30 minutes
  });

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute bottom-6 right-6 z-[1000] p-3.5 rounded-2xl shadow-xl transition-all duration-300 ${
          isOpen
            ? 'bg-slate-800 border border-slate-700 text-slate-400'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-105'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : (
          <div className="relative">
            <MessageSquarePlus className="w-5 h-5" />
            {activeReports.length > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-rose-500 text-[9px] text-white font-bold rounded-full flex items-center justify-center">
                {activeReports.length}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Report Modal */}
      {isOpen && (
        <div className="absolute bottom-20 right-6 z-[1000] w-80 bg-[#0B0F19]/95 backdrop-blur-xl border border-amber-500/25 rounded-2xl shadow-[0_8px_40px_rgba(245,158,11,0.15)] overflow-hidden">
          {showSuccess ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-bold text-emerald-400">Report Submitted!</p>
              <p className="text-[10px] text-slate-500 mt-1">It will appear on the map for 30 minutes.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-800/80 bg-gradient-to-r from-amber-900/20 to-orange-900/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">Report Congestion</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Help others avoid traffic hotspots</p>
              </div>

              <div className="p-4 space-y-3">
                {/* Location */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" /> Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Silk Board Junction"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                  />
                </div>

                {/* Type */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Issue Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REPORT_TYPES.map(rt => {
                      const Icon = rt.icon;
                      return (
                        <button
                          key={rt.id}
                          onClick={() => setType(rt.id)}
                          className={`p-2 rounded-lg text-[10px] flex items-center gap-1.5 border transition-all ${
                            type === rt.id
                              ? 'bg-amber-950/30 border-amber-500/40 text-amber-200 font-semibold'
                              : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${rt.color}`} />
                          <span>{rt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Severity */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Severity</label>
                    <span className="text-[10px] font-bold text-amber-400">{severity}/5</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                          severity >= s
                            ? s <= 2 ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                              : s <= 3 ? 'bg-amber-950/30 border-amber-500/40 text-amber-400'
                                : 'bg-rose-950/30 border-rose-500/40 text-rose-400'
                            : 'bg-slate-950/40 border-slate-800 text-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Note (optional)</label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder:text-slate-600 resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!location.trim() || isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
                </button>
              </div>

              {/* Active Reports Count */}
              {activeReports.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-800/80 text-[10px] text-slate-500">
                  📍 {activeReports.length} active report{activeReports.length !== 1 ? 's' : ''} on map (expire after 30 min)
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
