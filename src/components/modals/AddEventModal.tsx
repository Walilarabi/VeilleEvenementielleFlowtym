import React, { useState } from 'react';
import { X, Calendar, Plus, MapPin, Building2, TrendingUp } from 'lucide-react';
import { EventItem, EventCategory, RMImpactLevel, Venue, Hotel } from '../../types';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (newEvent: EventItem) => void;
  venues: Venue[];
  hotels: Hotel[];
  defaultDate?: string;
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  onClose,
  onAddEvent,
  venues,
  hotels,
  defaultDate,
}) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('salons_foires');
  const [venueId, setVenueId] = useState(venues[0]?.id || '');
  const [city, setCity] = useState('Paris');
  const [startDate, setStartDate] = useState(defaultDate || '2026-10-15');
  const [endDate, setEndDate] = useState(defaultDate || '2026-10-17');
  const [expectedAttendance, setExpectedAttendance] = useState(30000);
  const [internationalRatioPercent, setInternationalRatioPercent] = useState(40);
  const [impactLevel, setImpactLevel] = useState<RMImpactLevel>('modere');
  const [isRecurring, setIsRecurring] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedVenue = venues.find((v) => v.id === venueId);
    const venueName = selectedVenue ? selectedVenue.name : 'Site principal';

    // Calculate simulated RM score based on input
    const baseScore = impactLevel === 'hyper' ? 92 : impactLevel === 'critique' ? 82 : impactLevel === 'modere' ? 62 : 45;

    const newEvent: EventItem = {
      id: `ev-custom-${Date.now()}`,
      title,
      subtitle: subtitle || undefined,
      category,
      venueId,
      venueName,
      city,
      country: 'France',
      startDate,
      endDate: endDate >= startDate ? endDate : startDate,
      expectedAttendance,
      internationalRatioPercent,
      status: 'confirmed',
      impactLevel,
      scoreBreakdown: {
        attendanceScore: Math.round(expectedAttendance / 20000),
        internationalScore: Math.round(internationalRatioPercent / 5),
        saturationScore: 15,
        proximityScore: 16,
        compressionScore: 12,
        finalRMScore: baseScore,
        confidenceScore: 95,
      },
      sources: ['Saisie Manuelle Revenue Manager'],
      evidences: [],
      hotelImpacts: {},
      isRecurring,
      recurrenceFrequency: 'annual',
      isFavorite: false,
      isWatchlist: false,
      isYieldActive: impactLevel === 'hyper' || impactLevel === 'critique',
      createdAt: new Date().toISOString().slice(0, 10),
      lastVerifiedAt: new Date().toISOString().slice(0, 10),
    };

    onAddEvent(newEvent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ajouter un Événement</h3>
              <p className="text-[11px] text-slate-500">Ajoutez une manifestation pour intégrer son impact au calcul RM</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Nom de l&apos;événement *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Congrès International des Avocats 2026"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Sous-titre / Description courte
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Ex: Édition annuelle européenne"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="salons_foires">Salons & Foires</option>
                <option value="congres_medical">Congrès & Médical</option>
                <option value="concerts_spectacles">Concerts & Spectacles</option>
                <option value="sport">Sport & Compétitions</option>
                <option value="festivals">Festivals & Culture</option>
                <option value="mode_luxe">Mode & Fashion</option>
                <option value="corporate_sommet">Sommets & Corporate</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Impact RM Estimé</label>
              <select
                value={impactLevel}
                onChange={(e) => setImpactLevel(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="hyper">Hyper (Stop-sell requis)</option>
                <option value="critique">Critique (Yield actif)</option>
                <option value="modere">Modéré</option>
                <option value="faible">Faible</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date début</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date fin</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Lieu / Infrastructure</label>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Affluence attendue</label>
              <input
                type="number"
                min={500}
                value={expectedAttendance}
                onChange={(e) => setExpectedAttendance(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="recurrent-check"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
            />
            <label htmlFor="recurrent-check" className="text-xs text-slate-700 font-medium cursor-pointer">
              Événement récurrent (reconduction annuelle prévisible)
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors"
            >
              Créer l&apos;événement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
