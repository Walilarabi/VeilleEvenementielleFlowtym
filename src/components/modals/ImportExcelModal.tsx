import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { EventItem } from '../../types';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportEvents: (newEvents: EventItem[]) => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  onImportEvents,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parsedPreviewCount, setParsedPreviewCount] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSimulateFile = (name: string) => {
    setSelectedFileName(name);
    setParsedPreviewCount(4); // 4 valid rows parsed
  };

  const handleConfirmImport = () => {
    // Generate 4 imported events
    const imported: EventItem[] = [
      {
        id: `ev-imp-${Date.now()}-1`,
        title: 'Salon International de l’Emballage Paris 2026',
        subtitle: 'All4Pack Emballage Paris',
        category: 'salons_foires',
        venueId: 'venue-nord-villepinte',
        venueName: 'Paris Nord Villepinte',
        city: 'Paris',
        country: 'France',
        startDate: '2026-11-23',
        endDate: '2026-11-26',
        expectedAttendance: 65000,
        internationalRatioPercent: 48,
        status: 'confirmed',
        impactLevel: 'modere',
        scoreBreakdown: {
          attendanceScore: 16,
          internationalScore: 12,
          saturationScore: 15,
          proximityScore: 14,
          compressionScore: 11,
          finalRMScore: 68,
          confidenceScore: 98,
        },
        sources: ['Fichier Import Excel Utilisateur'],
        evidences: [],
        hotelImpacts: {},
        isRecurring: true,
        recurrenceFrequency: 'biennial',
        isFavorite: false,
        isWatchlist: false,
        isYieldActive: false,
        createdAt: new Date().toISOString().slice(0, 10),
        lastVerifiedAt: new Date().toISOString().slice(0, 10),
      },
      {
        id: `ev-imp-${Date.now()}-2`,
        title: 'Congrès National de Cardiologie Interventionnelle',
        subtitle: 'Sessions annuelles plénières',
        category: 'congres_medical',
        venueId: 'venue-porte-versailles',
        venueName: 'Paris Expo Porte de Versailles',
        city: 'Paris',
        country: 'France',
        startDate: '2026-12-02',
        endDate: '2026-12-04',
        expectedAttendance: 18000,
        internationalRatioPercent: 32,
        status: 'confirmed',
        impactLevel: 'modere',
        scoreBreakdown: {
          attendanceScore: 13,
          internationalScore: 10,
          saturationScore: 14,
          proximityScore: 16,
          compressionScore: 10,
          finalRMScore: 63,
          confidenceScore: 95,
        },
        sources: ['Fichier Import Excel Utilisateur'],
        evidences: [],
        hotelImpacts: {},
        isRecurring: true,
        recurrenceFrequency: 'annual',
        isFavorite: false,
        isWatchlist: false,
        isYieldActive: false,
        createdAt: new Date().toISOString().slice(0, 10),
        lastVerifiedAt: new Date().toISOString().slice(0, 10),
      },
    ];

    onImportEvents(imported);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Importer un fichier Excel / CSV</h3>
              <p className="text-[11px] text-slate-500">Ajoutez en bloc votre calendrier d&apos;événements d&apos;entreprise</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files[0];
              if (file) handleSimulateFile(file.name);
            }}
            className={`border-2 border-dashed rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-colors ${
              dragActive ? 'border-violet-500 bg-violet-50/50' : 'border-slate-200 hover:border-violet-300 bg-slate-50/50'
            }`}
            onClick={() => handleSimulateFile('flowtym_events_import_2026.xlsx')}
          >
            <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-violet-600 mx-auto">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">
                {selectedFileName || 'Glissez-déposez votre fichier .xlsx ou .csv ici'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Ou cliquez pour sélectionner un fichier test compatible Flowtym
              </p>
            </div>
          </div>

          {/* Parsed Preview info */}
          {selectedFileName && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-violet-600" />
                <span className="font-semibold text-slate-800">{selectedFileName}</span>
              </div>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {parsedPreviewCount} événements valides
              </span>
            </div>
          )}

          {isSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Événements importés avec succès !</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                const headers = ['titre', 'date_debut', 'date_fin', 'categorie', 'lieu', 'ville', 'participants_attendus', 'statut'];
                const rows = [
                  ['Salon International du Luxe 2026', '2026-11-20', '2026-11-22', 'mode_luxe', 'Palais Brongniart', 'Paris', 25000, 'confirmed'],
                  ['Congrès Européen d’Oncologie', '2026-12-05', '2026-12-08', 'congres_medical', 'Palais des Congrès', 'Paris', 18000, 'confirmed'],
                ];
                import('../../utils/helpers').then(({ downloadGenericCsv }) => {
                  downloadGenericCsv('modele_import_evenements_flowtym.csv', headers, rows);
                });
              }}
              className="text-xs font-bold text-violet-700 hover:text-violet-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Télécharger le modèle (.CSV)</span>
            </button>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                disabled={!selectedFileName || isSuccess}
                onClick={handleConfirmImport}
                className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl shadow-xs cursor-pointer"
              >
                Intégrer les événements
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
