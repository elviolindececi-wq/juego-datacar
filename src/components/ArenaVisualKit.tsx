import React from 'react';
import type { Vehicle } from '../types/vehicle';

export interface ArenaVehicleSpecDisplay {
  brand: string;
  modelName: string;
  trimBadge: string;
  categoryBadge: string;
  summary: string;
  powerDisplay: string;
  torqueDisplay: string;
  accelDisplay: string;
  hasSimulationNote: boolean;
}

/**
 * Formatea exclusivamente datos reales del catálogo `PRESET_VEHICLES`
 * respetando campos no declarados oficialmente (`estimatedFieldNames`) y notas híbridas.
 */
export function formatArenaVehicleCardData(vehicle: Vehicle): ArenaVehicleSpecDisplay {
  const est = new Set(vehicle.estimatedFieldNames ?? []);
  const isPowerUndeclared = vehicle.id === 'chery-t2-pro-max' && est.has('powerHp');
  const isTorqueUndeclared = vehicle.id === 'chery-t2-pro-max' && est.has('torqueNm');

  let categoryBadge = 'SUV';
  if (vehicle.isCustom) {
    categoryBadge =
      vehicle.equipment?.seatingCapacity >= 7 ? 'GENÉRICO · 7 PLAZAS' : 'AUTO GENÉRICO';
  } else if (vehicle.equipment?.seatingCapacity === 7) {
    categoryBadge = 'SUV · 7 PLAZAS';
  } else if (vehicle.hybridSystem?.kind === 'self-charging-hev') {
    categoryBadge = 'SUV · HEV';
  } else if (vehicle.hybridSystem?.kind === 'mild-12v') {
    categoryBadge = 'SUV · MILD HYBRID';
  }

  const cleanTrim = (vehicle.trim || `${vehicle.year}`)
    .replace(/\s*·\s*ficha DATACAR/i, '')
    .trim();
  const trimBadge = cleanTrim.includes(String(vehicle.year))
    ? cleanTrim.toUpperCase()
    : `${cleanTrim} · ${vehicle.year}`.toUpperCase();

  let summary = vehicle.description;
  switch (vehicle.id) {
    case 'nissan-kicks-2027':
      summary = 'Motor 1.2L con caja 6DCT de doble embrague, pantalla de 12,3" y asistencias de conducción.';
      break;
    case 'toyota-corolla-cross-seg-2027':
      summary = 'Motor 2.0L Dynamic Force con caja CVT de 10 marchas preprogramadas, 7 airbags y confort superior.';
      break;
    case 'chevrolet-tracker-lite':
      summary = 'Respuesta ágil con motor 1.2L Turbo de 3 cilindros, caja automática de 6 marchas y pantalla de 11".';
      break;
    case 'kia-carens-ex':
      summary = 'Tres filas para 7 pasajeros con motor 1.5L CRDi Turbo Diésel de alto par y gran autonomía en ruta.';
      break;
    case 'chery-t4-pro-luxury-hev':
      summary = 'Propulsión híbrida autorrecargable (HEV) con respuesta eléctrica inmediata y paquete ADAS completo.';
      break;
    case 'suzuki-fronx':
      summary = 'Crossover compacto 1.5L Dualjet con asistencia Mild Hybrid 12V, cámara 360° y Head-Up Display.';
      break;
    case 'chery-t2-pro-max':
      summary = 'Diseño robusto aventurero con motor 1.5L, caja automática CVT, pantalla de 10,25" y techo solar.';
      break;
  }

  let powerDisplay = `${Math.round(vehicle.powerHp)} HP`;
  if (isPowerUndeclared) {
    powerDisplay = 'No especificado';
  } else if (vehicle.id === 'chevrolet-tracker-lite') {
    powerDisplay = '139 CV';
  }

  let torqueDisplay = `${vehicle.torqueNm} Nm`;
  if (isTorqueUndeclared) {
    torqueDisplay = 'No especificado';
  } else if (vehicle.hybridSystem?.torqueNmIsElectricOnly) {
    torqueDisplay = `${vehicle.torqueNm} Nm (eléc.)`;
  }

  const isAccelEstimated = est.has('accel0100') || Boolean(vehicle.estimatedSimulationParameters);
  const accelBase = `${vehicle.accel0100.toFixed(1).replace('.', ',')} s`;
  const accelFormatted = isAccelEstimated ? `≈ ${accelBase} (sim.)` : accelBase;

  return {
    brand: vehicle.brand,
    modelName: vehicle.name,
    trimBadge,
    categoryBadge,
    summary,
    powerDisplay,
    torqueDisplay,
    accelDisplay: accelFormatted,
    hasSimulationNote: Boolean(vehicle.estimatedSimulationParameters),
  };
}

export function ArenaBrandEmblem({ brand, className = 'w-12 h-12' }: { brand: string; className?: string }) {
  const key = brand.trim().toUpperCase();

  if (key === 'NISSAN') {
    return (
      <svg viewBox="0 0 64 54" className={className} fill="none" aria-hidden="true">
        <path
          d="M14.5 19.5A19.5 19.5 0 0 1 49.5 19.5"
          stroke="#F3F7FC"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M49.5 34.5A19.5 19.5 0 0 1 14.5 34.5"
          stroke="#F3F7FC"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <rect x="6" y="22.2" width="52" height="9.6" rx="1.6" fill="#0A1A24" stroke="#F3F7FC" strokeWidth="2.1" />
        <text
          x="32"
          y="29.3"
          textAnchor="middle"
          fill="#F3F7FC"
          fontSize="7.4"
          fontWeight="800"
          letterSpacing="1.5"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          NISSAN
        </text>
      </svg>
    );
  }

  if (key === 'TOYOTA') {
    return (
      <svg viewBox="0 0 64 46" className={className} fill="none" aria-hidden="true">
        <ellipse cx="32" cy="23" rx="26" ry="17" stroke="#F3F7FC" strokeWidth="3" />
        <ellipse cx="32" cy="23" rx="7.8" ry="16.2" stroke="#F3F7FC" strokeWidth="2.6" />
        <ellipse cx="32" cy="14.6" rx="17.5" ry="6.2" stroke="#F3F7FC" strokeWidth="2.6" />
      </svg>
    );
  }

  if (key === 'CHEVROLET') {
    return (
      <svg viewBox="0 0 72 36" className={className} fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="chevyGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE082" />
            <stop offset="50%" stopColor="#FFAA12" />
            <stop offset="100%" stopColor="#C67600" />
          </linearGradient>
        </defs>
        <polygon
          points="25,6 47,6 47,12 66,12 61,24 47,24 47,30 25,30 25,24 6,24 11,12 25,12"
          fill="url(#chevyGold)"
          stroke="#F3F7FC"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (key === 'KIA') {
    return (
      <svg viewBox="0 0 76 34" className={className} fill="none" aria-hidden="true">
        <path
          d="M8 25V9L23 9L13 18.5L24 25H31L39 9V25M44 25L56 9H66V25"
          stroke="#F3F7FC"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (key === 'CHERY') {
    return (
      <svg viewBox="0 0 68 42" className={className} fill="none" aria-hidden="true">
        <ellipse cx="34" cy="21" rx="27" ry="13.5" stroke="#F3F7FC" strokeWidth="2.8" />
        <path d="M20 28L34 10L48 28" stroke="#F3F7FC" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M26 22H42" stroke="#00E5F5" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (key === 'SUZUKI') {
    return (
      <svg viewBox="0 0 56 52" className={className} fill="none" aria-hidden="true">
        <path
          d="M28 5L47 16.5L32.5 24.5L47 33.5L28 47L9 35.5L23.5 27.5L9 18.5L28 5Z"
          fill="#F3F7FC"
          stroke="#94A3B8"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 56 56" className={className} fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="22" stroke="#F3F7FC" strokeWidth="2.6" />
      <text x="28" y="32" textAnchor="middle" fill="#F3F7FC" fontSize="11" fontWeight="800">
        {key.slice(0, 4)}
      </text>
    </svg>
  );
}

export function ArenaPilotHelmetAvatar({ className = 'w-11 h-11' }: { className?: string }) {
  return (
    <div
      className={`relative rounded-full p-[2px] bg-gradient-to-br from-[#00E5F5] via-[#38BDF8] to-[#FFAA12] shadow-[0_0_14px_rgba(0,229,245,0.45)] shrink-0 ${className}`}
      aria-hidden="true"
    >
      <div className="w-full h-full rounded-full bg-gradient-to-b from-[#132938] to-[#050d14] flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 48 48" className="w-[88%] h-[88%]" fill="none">
          {/* Racing suit shoulders */}
          <path d="M9 46C11 39 16 36 24 36C32 36 37 39 39 46" fill="#1E293B" stroke="#FFAA12" strokeWidth="2" />
          {/* Helmet shell */}
          <path
            d="M12 24C12 14.6 18 9 25.5 9C33.5 9 38 14.8 38 23.2C38 28.8 35.4 33.6 30.2 35.2L17.5 35.2C13.8 33.5 12 29.3 12 24Z"
            fill="#0F1F2C"
            stroke="#CBD5E1"
            strokeWidth="1.6"
          />
          {/* Top racing stripe */}
          <path d="M18 11.5C22 10 27 10 31 12" stroke="#00E5F5" strokeWidth="2.2" strokeLinecap="round" />
          {/* Dark reflective visor */}
          <path
            d="M16.5 19.5H36.8C36.9 23.2 35.2 26.2 31.5 27H18.5C16.8 25.2 16.2 22.4 16.5 19.5Z"
            fill="#040911"
            stroke="#00E5F5"
            strokeWidth="1.4"
          />
          {/* Visor specular highlight */}
          <path d="M19 21.5H31" stroke="#67E8F9" strokeOpacity="0.65" strokeWidth="1.5" strokeLinecap="round" />
          {/* Jaw accent */}
          <path d="M16 31.2H29.5" stroke="#FFAA12" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export function ArenaCenterLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="dc-arena-logo-housing select-none" aria-label="DATACAR ARENA">
      <div className="dc-arena-logo-inner">
        <div
          className={`font-display font-black italic uppercase tracking-[0.06em] leading-[0.88] text-[#F3F7FC] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] ${
            compact ? 'text-lg sm:text-xl md:text-2xl' : 'text-xl sm:text-2xl md:text-[30px]'
          }`}
        >
          DATACAR
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          {/* Left warm checkered speed wing */}
          <svg viewBox="0 0 28 12" className={compact ? 'w-5 h-2.5' : 'w-6 h-3'} aria-hidden="true">
            <g transform="skewX(-22)">
              <rect x="6" y="0" width="4.5" height="4.5" fill="#FFAA12" />
              <rect x="15" y="0" width="4.5" height="4.5" fill="#FFAA12" />
              <rect x="10.5" y="4.5" width="4.5" height="4.5" fill="#FFAA12" opacity="0.85" />
              <rect x="19.5" y="4.5" width="4.5" height="4.5" fill="#FFAA12" />
              <rect x="6" y="7.5" width="4.5" height="3.5" fill="#D97706" />
              <rect x="15" y="7.5" width="4.5" height="3.5" fill="#FFAA12" />
            </g>
          </svg>
          <span
            className={`font-display font-black italic uppercase tracking-[0.14em] leading-none bg-gradient-to-b from-[#FFD166] via-[#FFAA12] to-[#E67E00] bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
              compact ? 'text-xs sm:text-sm md:text-base' : 'text-sm sm:text-base md:text-[19px]'
            }`}
          >
            ARENA
          </span>
          {/* Right cyan checkered speed wing */}
          <svg viewBox="0 0 28 12" className={compact ? 'w-5 h-2.5' : 'w-6 h-3'} aria-hidden="true">
            <g transform="skewX(-22)">
              <rect x="5" y="0" width="4.5" height="4.5" fill="#00E5F5" />
              <rect x="14" y="0" width="4.5" height="4.5" fill="#7DD3FC" />
              <rect x="9.5" y="4.5" width="4.5" height="4.5" fill="#00E5F5" />
              <rect x="18.5" y="4.5" width="4.5" height="4.5" fill="#00E5F5" opacity="0.8" />
              <rect x="5" y="7.5" width="4.5" height="3.5" fill="#38BDF8" />
              <rect x="14" y="7.5" width="4.5" height="3.5" fill="#00E5F5" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export function ArenaCrownTitle({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center select-none z-10">
      {/* Crown + horizontal golden flare */}
      <div className="relative flex items-center justify-center mb-0.5">
        <div className="w-24 sm:w-36 h-[1.5px] bg-gradient-to-r from-transparent via-[#FFAA12]/80 to-transparent" />
        <svg
          viewBox="0 0 44 30"
          className={`${compact ? 'w-6 h-4' : 'w-8 h-5 sm:w-9 sm:h-6'} mx-[-14px] drop-shadow-[0_0_10px_rgba(255,170,18,0.85)]`}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 23L2 7L13.5 15L22 3L30.5 15L42 7L39 23H5Z"
            fill="#FFAA12"
            stroke="#FFE082"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect x="6" y="25" width="32" height="3.2" rx="1.2" fill="#FFAA12" />
        </svg>
        <div className="w-24 sm:w-36 h-[1.5px] bg-gradient-to-r from-transparent via-[#FFAA12]/80 to-transparent" />
      </div>

      {/* Side cyan light bars + metallic white italic title */}
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <div
          className="hidden xs:block sm:block w-10 sm:w-20 md:w-24 h-[3.5px] bg-gradient-to-l from-[#00E5F5] to-transparent shadow-[0_0_12px_rgba(0,229,245,0.8)] -skew-x-12"
          aria-hidden="true"
        />
        <h1
          id="intro-heading"
          className={`font-display font-black italic uppercase tracking-[0.04em] leading-[0.95] text-transparent bg-clip-text bg-gradient-to-b from-[#FFFFFF] via-[#F3F7FC] to-[#CBD5E1] drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)] text-center ${
            compact
              ? 'text-[clamp(1.35rem,3.4vw,2.35rem)]'
              : 'text-[clamp(1.65rem,3.9vw,3.1rem)]'
          }`}
        >
          LOS MÁS BUSCADOS
        </h1>
        <div
          className="hidden xs:block sm:block w-10 sm:w-20 md:w-24 h-[3.5px] bg-gradient-to-r from-[#00E5F5] to-transparent shadow-[0_0_12px_rgba(0,229,245,0.8)] -skew-x-12"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function ArenaGarageIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 32" className={className} fill="none" aria-hidden="true">
      <path d="M3 12L18 4L33 12V28H29V14H7V28H3V12Z" stroke="#CBD5E1" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M9 17H27M9 20.5H27" stroke="#64748B" strokeWidth="1.4" />
      <path
        d="M11.5 27.5L13 22.5H23L24.5 27.5H11.5Z"
        fill="#1E293B"
        stroke="#F3F7FC"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="14.2" cy="25.5" r="1.2" fill="#00E5F5" />
      <circle cx="21.8" cy="25.5" r="1.2" fill="#00E5F5" />
    </svg>
  );
}

export function ArenaCompareIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 32" className={className} fill="none" aria-hidden="true">
      <path d="M18 5V27M11 27H25" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 9.5H29" stroke="#F3F7FC" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 9.5L4.5 18.5H11.5L8 9.5Z" stroke="#CBD5E1" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4.2 18.5C4.5 21 11.5 21 11.8 18.5" fill="#94A3B8" />
      <path d="M28 9.5L24.5 18.5H31.5L28 9.5Z" stroke="#CBD5E1" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M24.2 18.5C24.5 21 31.5 21 31.8 18.5" fill="#94A3B8" />
    </svg>
  );
}

export function ArenaCircuitsIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M7 27C7 21 25 21 25 14.5C25 9.5 14 9.5 17 4.5"
        stroke="#CBD5E1"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M7 27C7 21 25 21 25 14.5C25 9.5 14 9.5 17 4.5"
        stroke="#0A1926"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M7 27C7 21 25 21 25 14.5C25 9.5 14 9.5 17 4.5"
        stroke="#00E5F5"
        strokeWidth="1.3"
        strokeDasharray="2.5 2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArenaRunChevronsIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 26" className={className} fill="none" aria-hidden="true">
      <path d="M4 4L14.5 13L4 22" stroke="#FFFFFF" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 4L27 13L16.5 22" stroke="#FFFFFF" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Fondo genérico nocturno de estadio DATACAR ARENA para las demás secciones
 * (Garaje, Comparar, Circuitos, Preparación y Resultados), manteniendo atmósfera
 * cohesiva de reflectores cian/ámbar y asfalto húmedo con alto contraste de lectura.
 */
export function ArenaSectionBackdrop({ fixed = false }: { fixed?: boolean }) {
  return (
    <div
      className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 z-0 overflow-hidden select-none`}
      aria-hidden="true"
    >
      <img
        src="/assets/aistudio/arena_home_bg_4f3f8584.webp"
        alt=""
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover object-[center_64%] scale-[1.03] opacity-55"
      />
      <div className="dc-arena-section-scrim absolute inset-0" />
    </div>
  );
}

export interface ArenaFlowStepItem {
  label: string;
  onSelect?: () => void;
}

/**
 * Barra superior angular con pestaña de marca DATACAR ARENA y stepper hexagonal biselado
 * idéntica al mockup de Selección de Circuitos y reutilizable en todo el flujo.
 */
export function ArenaFlowTopBar({
  steps,
  currentStep,
  onLogoClick,
  rightSlot,
}: {
  steps?: ArenaFlowStepItem[];
  currentStep?: number;
  onLogoClick: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="dc-circuit-topbar relative z-30 w-full select-none">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 sm:px-8 py-2.5">
        {/* Pestaña izquierda angular con barra diagonal cian + DATACAR ARENA */}
        <button
          type="button"
          onClick={onLogoClick}
          className="dc-circuit-brand-tab group flex items-center gap-3 pr-6 py-1 text-left cursor-pointer"
          aria-label="Volver a Los más buscados"
        >
          <span className="dc-circuit-brand-slash" aria-hidden="true" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-2xl sm:text-[28px] font-black italic uppercase tracking-[0.04em] text-[#F3F7FC] group-hover:text-white transition-colors">
              DATACAR
            </span>
            <span className="font-display text-xs sm:text-sm font-black uppercase tracking-[0.34em] text-[#FFAA12] pl-1 mt-0.5">
              ARENA
            </span>
          </span>
        </button>

        {/* Stepper hexagonal biselado (1. CIRCUITO > 2. TU AUTO 360° > 3. PREPARAR > 4. CORRER > 5. RESULTADOS) */}
        {steps && steps.length > 0 && (
          <nav
            className="flex flex-wrap items-center gap-1.5 sm:gap-2"
            aria-label="Etapas de la experiencia"
          >
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isDone = typeof currentStep === 'number' && index < currentStep;
              const clickable = Boolean(step.onSelect) && !isActive;
              const content = (
                <span
                  className={`dc-hex-step-inner text-[10px] sm:text-xs ${
                    isActive
                      ? 'active'
                      : isDone
                        ? 'done'
                        : ''
                  }`}
                >
                  {index + 1}. {step.label}
                </span>
              );

              return (
                <React.Fragment key={step.label}>
                  {index > 0 && (
                    <span
                      className={`font-display text-sm sm:text-base font-black select-none ${
                        isActive || isDone ? 'text-[#00E5F5]' : 'text-slate-500'
                      }`}
                      aria-hidden="true"
                    >
                      &gt;
                    </span>
                  )}
                  {clickable ? (
                    <button
                      type="button"
                      onClick={step.onSelect}
                      className={`dc-hex-step-wrap cursor-pointer ${isActive ? 'active' : isDone ? 'done' : ''}`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      className={`dc-hex-step-wrap ${isActive ? 'active' : isDone ? 'done' : ''}`}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      {content}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {rightSlot && <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>}
      </div>
    </header>
  );
}
