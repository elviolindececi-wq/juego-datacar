import React from 'react';
import { isChunkLoadError } from '../utils/chunkRecovery';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

export class ChunkErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    isChunkError: false,
  };

  public static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
    };
  }

  private handleHardRefresh = (): void => {
    try {
      window.sessionStorage.removeItem('datacar_chunk_reload_ts_v1');
      const url = new URL(window.location.href);
      url.searchParams.set('v', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-[#050e17] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-cyan-400/45 bg-[#081826] p-6 text-center shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
            DATACAR ARENA
          </p>
          <h1 className="mt-2 font-display text-2xl font-black italic uppercase text-white">
            {this.state.isChunkError
              ? 'Nueva versión lista para cargar'
              : 'Reconexión de recursos requerida'}
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            {this.state.isChunkError
              ? 'Se publicó una actualización del juego y tu navegador tenía archivos en caché de una versión anterior.'
              : 'Un módulo tardó en responder en la red móvil. Tocá el botón para cargar la versión actualizada al instante.'}
          </p>
          <button
            type="button"
            onClick={this.handleHardRefresh}
            className="dc-btn-gold mt-5 inline-flex items-center justify-center px-6 py-3 text-sm font-black italic uppercase cursor-pointer"
          >
            Actualizar y entrar ahora
          </button>
        </div>
      </div>
    );
  }
}
