import React, { useState } from 'react';
import {
  Sliders,
  Building2,
  Database,
  Key,
  ShieldCheck,
  CheckCircle2,
  Check,
  Plus,
  Trash2,
  Info,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Hotel } from '../../types';
import { GeoIntelligenceView } from '../geo/GeoIntelligenceView';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../../services/supabaseClient';

interface SettingsViewProps {
  hotels: Hotel[];
  onAddHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
  selectedHotelId?: string;
  onSelectHotel?: (hotelId: string) => void;
  onShowToast?: (message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  hotels,
  onAddHotel,
  onDeleteHotel,
  selectedHotelId,
  onSelectHotel,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'hotels' | 'geo' | 'rm_rules' | 'supabase'>('hotels');

  // Supabase Configuration State
  const initialCreds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(initialCreds.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialCreds.anonKey);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    tested: boolean;
    success?: boolean;
    message?: string;
  }>({
    tested: !!initialCreds.url && !!initialCreds.anonKey,
  });

  // RM configuration state
  const [priorityThreshold, setPriorityThreshold] = useState(50);
  const [stopSellThreshold, setStopSellThreshold] = useState(85);
  const [searchRadiusKm, setSearchRadiusKm] = useState(25);

  // New hotel form state
  const [isAddingHotel, setIsAddingHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('Paris');
  const [newHotelRooms, setNewHotelRooms] = useState(80);
  const [newHotelStars, setNewHotelStars] = useState(4);
  const [newHotelSegment, setNewHotelSegment] = useState<'Luxe' | 'Boutique' | 'Affaires' | 'Économique' | 'Resort'>('Affaires');
  const [newHotelADR, setNewHotelADR] = useState(240);

  const handleCreateHotel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHotelName.trim()) return;

    const newHotel: Hotel = {
      id: `hotel-${Date.now()}`,
      name: newHotelName,
      group: 'Flowtym Hospitality Group',
      city: newHotelCity,
      country: 'France',
      address: `${newHotelCity} Centre`,
      lat: 48.8566,
      lng: 2.3522,
      stars: newHotelStars,
      roomCount: newHotelRooms,
      segment: newHotelSegment,
      baseADR: newHotelADR,
    };

    onAddHotel(newHotel);
    setIsAddingHotel(false);
    setNewHotelName('');
  };

  const handleSaveSupabase = () => {
    saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    if (onShowToast) {
      onShowToast('Paramètres Supabase enregistrés avec succès !');
    }
  };

  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseStatus({
        tested: true,
        success: false,
        message: 'Veuillez renseigner votre URL de projet Supabase et votre clé Anon Key.',
      });
      return;
    }

    setIsTestingSupabase(true);
    const result = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    setIsTestingSupabase(false);
    setSupabaseStatus({
      tested: true,
      success: result.success,
      message: result.message,
    });
    if (result.success) {
      saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
      if (onShowToast) onShowToast(result.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Paramètres & Configuration Système
              </h2>
              <p className="text-xs text-slate-500">
                Gestion du parc hôtelier, pondérations des scores RM et infrastructure Supabase
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            <button
              onClick={() => setActiveTab('hotels')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'hotels'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portefeuille Hôtels
            </button>
            <button
              onClick={() => setActiveTab('geo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'geo'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Veille Géographique (10/30 km)
            </button>
            <button
              onClick={() => setActiveTab('rm_rules')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'rm_rules'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Seuils Revenue Management
            </button>
            <button
              onClick={() => setActiveTab('supabase')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'supabase'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Base de Données Supabase
            </button>
          </div>
        </div>
      </div>

      {/* Tab: Veille Géographique */}
      {activeTab === 'geo' && (
        <GeoIntelligenceView
          hotels={hotels}
          selectedHotelId={selectedHotelId || hotels[0]?.id || ''}
          onSelectHotel={onSelectHotel || (() => {})}
          onShowToast={onShowToast || (() => {})}
        />
      )}

      {/* Tab 1: Portefeuille Hôtels */}
      {activeTab === 'hotels' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Établissements sous Gestion ({hotels.length})
              </h3>
              <p className="text-xs text-slate-500">
                Chaque hôtel dispose de son propre calcul d&apos;impact kilométrique et de compression de marché
              </p>
            </div>

            <button
              onClick={() => setIsAddingHotel(!isAddingHotel)}
              className="inline-flex items-center gap-1.5 px-3 py-1.8 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un établissement</span>
            </button>
          </div>

          {/* Add hotel inline form */}
          {isAddingHotel && (
            <form onSubmit={handleCreateHotel} className="p-4 bg-slate-50 rounded-xl border border-violet-200 space-y-4">
              <h4 className="text-xs font-bold text-violet-900 uppercase tracking-wider">
                Nouvel Établissement Hôtelier
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom de l&apos;hôtel</label>
                  <input
                    type="text"
                    required
                    value={newHotelName}
                    onChange={(e) => setNewHotelName(e.target.value)}
                    placeholder="Ex: Hôtel Elysées Rivoli"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Ville</label>
                  <select
                    value={newHotelCity}
                    onChange={(e) => setNewHotelCity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  >
                    <option value="Paris">Paris</option>
                    <option value="Lyon">Lyon</option>
                    <option value="Nice">Nice</option>
                    <option value="Bordeaux">Bordeaux</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre de chambres</label>
                  <input
                    type="number"
                    min={1}
                    value={newHotelRooms}
                    onChange={(e) => setNewHotelRooms(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Étoiles</label>
                  <select
                    value={newHotelStars}
                    onChange={(e) => setNewHotelStars(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  >
                    <option value={3}>3 étoiles</option>
                    <option value={4}>4 étoiles</option>
                    <option value={5}>5 étoiles / Palace</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Segment</label>
                  <select
                    value={newHotelSegment}
                    onChange={(e) => setNewHotelSegment(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  >
                    <option value="Affaires">Affaires & Séminaires</option>
                    <option value="Boutique">Boutique & Lifestyle</option>
                    <option value="Luxe">Luxe & Prestige</option>
                    <option value="Resort">Resort & Loisirs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ADR de base (€)</label>
                  <input
                    type="number"
                    min={50}
                    value={newHotelADR}
                    onChange={(e) => setNewHotelADR(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingHotel(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                >
                  Enregistrer l&apos;hôtel
                </button>
              </div>
            </form>
          )}

          {/* Hotels Table */}
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
            {hotels.map((h) => (
              <div
                key={h.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-sm shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>{h.name}</span>
                      <span className="text-amber-500 text-xs">{'★'.repeat(h.stars)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {h.address} · {h.roomCount} chambres · Segment {h.segment}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 tabular-nums">
                      ADR Ref: {h.baseADR}€
                    </div>
                    <div className="text-[11px] text-slate-400">Tarif moyen annuel</div>
                  </div>

                  {hotels.length > 1 && (
                    <button
                      onClick={() => onDeleteHotel(h.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Supprimer l'hôtel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: RM Scoring Rules */}
      {activeTab === 'rm_rules' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Pondération & Seuils de Déclenchement Automatiques
            </h3>
            <p className="text-xs text-slate-500">
              Configurez les seuils d&apos;alerte qui classent un événement en priorité RMS ou nécessitent un stop-sell
            </p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-800">
                <span>Seuil de déclenchement : Priorités RMS</span>
                <span className="text-violet-700 tabular-nums">Score RM &ge; {priorityThreshold}/100</span>
              </div>
              <input
                type="range"
                min={30}
                max={80}
                value={priorityThreshold}
                onChange={(e) => setPriorityThreshold(parseInt(e.target.value, 10))}
                className="w-full accent-violet-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Tout événement atteignant ce score apparaîtra dans les priorités du Flowboard.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-800">
                <span>Seuil critique : Stop-sell automatique OTA</span>
                <span className="text-rose-700 tabular-nums">Score RM &ge; {stopSellThreshold}/100</span>
              </div>
              <input
                type="range"
                min={70}
                max={95}
                value={stopSellThreshold}
                onChange={(e) => setStopSellThreshold(parseInt(e.target.value, 10))}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Déclenche la recommandation de blocage des canaux tiers et l&apos;application du tarif BAR maximal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Supabase Integration & Tables Creation */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          {/* Section 1: Supabase Connection Credentials */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Connexion Supabase (Base de Données PostgreSQL)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configuration des clés API de votre projet Supabase pour la persistance temps réel
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {supabaseStatus.tested ? (
                  supabaseStatus.success ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Supabase Connecté
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Erreur de connexion
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Non vérifié
                  </span>
                )}
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  URL du projet Supabase
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Disponible dans votre dashboard Supabase &gt; Project Settings &gt; API
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Clé Anonyme Publique (anon / public key)
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Clé sécurisée pour les accès client avec Row Level Security (RLS)
                </p>
              </div>
            </div>

            {/* Test Result Feedback */}
            {supabaseStatus.tested && supabaseStatus.message && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  supabaseStatus.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {supabaseStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{supabaseStatus.message}</span>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Les clés sont persistées localement et injectées dans le client Supabase.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={isTestingSupabase}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                  <span>{isTestingSupabase ? 'Test en cours...' : 'Tester la connexion'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveSupabase}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistrer les identifiants</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Versioned database schema */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Schéma HOPTYM Revenue — migrations versionnées</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Le schéma est déjà déployé sur le projet Supabase HOPTYM. Il est maintenu par des migrations SQL versionnées dans GitHub, pas par un script monolithique à copier-coller.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-900 tabular-nums">35</div>
                <div className="text-[11px] text-slate-500">Tables métier et fondation</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-900 tabular-nums">35/35</div>
                <div className="text-[11px] text-slate-500">Tables publiques avec RLS activé</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-lg font-bold text-slate-900 tabular-nums">0</div>
                <div className="text-[11px] text-slate-500">Clés étrangères sans index couvrant</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
              <strong>Ne pas exécuter l'ancien script SQL intégré à cette application.</strong>
              Il correspond à un ancien modèle de démonstration et n'est plus compatible avec le schéma actuel. Les migrations du dépôt constituent la source de vérité.
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="https://github.com/Walilarabi/VeilleEvenementielleFlowtym/tree/feat/hoptym-revenue-backend/supabase/migrations"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl">
                Voir les migrations SQL GitHub <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a href="https://supabase.com/dashboard/project/aliploqizujgovnlgjvg"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl">
                Ouvrir le projet Supabase <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
