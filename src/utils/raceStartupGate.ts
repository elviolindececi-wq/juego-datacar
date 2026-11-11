/** Contrato compartido de preparación antes de iniciar una carrera real. */
export type RaceStartupSnapshot = {
  sceneRendered: boolean;
  loadedModels: number;
  requiredModels: number;
  modelError: boolean;
};

/** Ningún pitido / tick de física antes de render y modelos instanciados. */
export function canStartCountdown(snapshot: RaceStartupSnapshot): boolean {
  return snapshot.sceneRendered
    && !snapshot.modelError
    && Number.isInteger(snapshot.requiredModels)
    && snapshot.requiredModels >= 0
    && snapshot.loadedModels >= snapshot.requiredModels;
}

/** Permite un mensaje fiel durante la carga, no un porcentaje ficticio. */
export function raceStartupMessage(snapshot: RaceStartupSnapshot): string {
  if (snapshot.modelError) return 'No fue posible cargar los modelos 3D.';
  if (snapshot.loadedModels < snapshot.requiredModels) return 'Cargando modelos de los vehículos…';
  if (!snapshot.sceneRendered) return 'Preparando la primera imagen de la pista…';
  return 'Pista y vehículos listos. Preparando la largada…';
}
