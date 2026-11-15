import React from 'react';
import { Hotel } from '../../types';

interface BacktestingValidationDashboardProps {
  hotel: Hotel;
  onShowToast: (msg: string) => void;
}

export const BacktestingValidationDashboard: React.FC<BacktestingValidationDashboardProps> = (_props) => (
  <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
    <h2 className="text-base font-bold">Backtesting temporairement désactivé</h2>
    <p className="mt-2 text-sm">
      L'ancien moteur de backtesting injectait du bruit simulé dans les prédictions. Ses scores d'exactitude ne constituent donc pas une mesure fiable de performance et ne doivent pas être présentés comme des résultats réels.
    </p>
    <p className="mt-2 text-sm">
      Le backtesting sera réactivé uniquement lorsque des snapshots OTB historiques authentiques, des réalisations PMS vérifiées et des prévisions archivées hors échantillon seront disponibles. Aucun score MAE, RMSE, WAPE ou biais n'est affiché tant que ces conditions ne sont pas réunies.
    </p>
  </section>
);
