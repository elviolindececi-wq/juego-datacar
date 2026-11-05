import React, { useRef, useEffect, useState } from 'react';
import { Vehicle, RaceTrackConfig, SimulationTelemetrySample, VehicleRaceResult } from '../types/vehicle';
import { Play, Pause, RotateCcw, FastForward, Flag, Award, Eye, Truck, Volume2, VolumeX, Gauge, Zap } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import { getCleanZenithSprite } from '../utils/zenithSpriteProcessor';

interface RaceCanvasProps {
  vehicles: Vehicle[];
  track: RaceTrackConfig;
  simulationResults: VehicleRaceResult[];
  onFinishRace: () => void;
}

export const RaceCanvas: React.FC<RaceCanvasProps> = ({
  vehicles,
  track,
  simulationResults,
  onFinishRace,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null); // 3, 2, 1, 0 = GO!
  const [hasFinished, setHasFinished] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [isMuted, setIsMuted] = useState(false);
  const [, setSpriteTick] = useState(0);
  const vehicleImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Pre-cargar imágenes reales de los modelos (incluyendo fotos cenitales/superiores)
  useEffect(() => {
    vehicles.forEach((v) => {
      const zenithSrc = v.photoAngles?.topZenith;
      if (zenithSrc && !vehicleImagesRef.current.has(`${v.id}-zenith`)) {
        const zImg = new Image();
        zImg.src = zenithSrc;
        zImg.onload = () => {
          vehicleImagesRef.current.set(`${v.id}-zenith`, zImg);
        };
      }
      if (v.imageUrl && !vehicleImagesRef.current.has(v.id)) {
        const img = new Image();
        img.src = v.imageUrl;
        img.onload = () => {
          vehicleImagesRef.current.set(v.id, img);
        };
      }
    });
  }, [vehicles]);

  // Determinar la duración máxima de la carrera simulada
  const maxRaceTimeSec = simulationResults.length > 0
    ? Math.max(...simulationResults.map((r) => r.finishTimeSec))
    : 15;

  // Iniciar cuenta regresiva al cargar nueva carrera
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
    setHasFinished(false);
    setCountdown(3);

    const timer1 = setTimeout(() => setCountdown(2), 600);
    const timer2 = setTimeout(() => setCountdown(1), 1200);
    const timer3 = setTimeout(() => {
      setCountdown(0);
      setIsPlaying(true);
    }, 1800);
    const timer4 = setTimeout(() => setCountdown(null), 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      soundEngine.stopAll();
    };
  }, [track.id, vehicles]);

  // Manejo de silenciador
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Loop de animación y sintetizador de sonido en tiempo real
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const dt = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      if (isPlaying && countdown === null) {
        setCurrentTimeSec((prev) => {
          const next = prev + dt * playbackSpeed;
          if (next >= maxRaceTimeSec + 0.8) {
            setIsPlaying(false);
            setHasFinished(true);
            soundEngine.stopAll();
            onFinishRace();
            return maxRaceTimeSec;
          }
          return next;
        });

        // Actualizar sonido dinámico de los motores
        vehicles.forEach((v) => {
          const st = getVehicleStateAtTime(v.id, currentTimeSec);
          soundEngine.updateTelemetry(
            v,
            st.rpm,
            st.speedKmh,
            st.isBraking,
            v.id === selectedVehicleId
          );
        });
      } else {
        // En pausa o cuenta regresiva silenciar aceleración
        vehicles.forEach((v) => {
          soundEngine.updateTelemetry(v, 900, 0, false, false);
        });
      }

      renderCanvas();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, countdown, playbackSpeed, maxRaceTimeSec, currentTimeSec, vehicles, selectedVehicleId, isMuted]);

  // Interpolación de datos de telemetría en el tiempo actual
  const getVehicleStateAtTime = (vId: string, time: number) => {
    const result = simulationResults.find((r) => r.vehicle.id === vId);
    if (!result || result.telemetryHistory.length === 0) {
      return {
        distance: 0,
        speedKmh: 0,
        accelG: 0,
        fuelRemaining: 0,
        gear: 1,
        rpm: 1000,
        isBraking: false,
        inCorner: false,
        currentCornerRadiusM: 999,
        outOfFuel: false,
      };
    }

    const history = result.telemetryHistory;
    let sample = history[0];
    for (let i = 0; i < history.length; i++) {
      if (history[i].timeSec <= time) {
        sample = history[i];
      } else {
        break;
      }
    }
    return {
      distance: sample.distanceMeters,
      speedKmh: sample.speedKmh,
      accelG: sample.accelerationG,
      fuelRemaining: sample.fuelRemaining,
      gear: sample.gear,
      rpm: sample.rpm,
      isBraking: sample.isBraking || false,
      inCorner: sample.inCorner || false,
      currentCornerRadiusM: sample.currentCornerRadiusM,
      outOfFuel: sample.outOfFuel || false,
    };
  };

  /**
   * Calcula la curvatura lateral (desviación dY) de la pista según la distancia en metros.
   * Modela rectas que desembocan en curvas pronunciadas a la izquierda y derecha,
   * chicanas de paso rápido y horquillas cerradas.
   */
  const getTrackCurvatureOffset = (distM: number, trackId: string): number => {
    if (trackId === 'drag_quarter' || trackId === 'drag_half') {
      return 0; // Pista recta pura
    }

    if (trackId === 'brake_slalom') {
      // Circuito técnico con horquillas muy cerradas (desviación lateral de ±55px)
      const cycle = 260; // metros por ciclo de curva
      const phase = (distM % cycle) / cycle;
      // Curva en S con transiciones en ápice
      return Math.sin(phase * Math.PI * 2) * 60 + Math.sin(phase * Math.PI * 4) * 20;
    }

    if (trackId === 'circuit') {
      // Curvas de circuito Grand Prix suaves y rápidas
      const cycle = 420;
      const phase = (distM % cycle) / cycle;
      return Math.sin(phase * Math.PI * 2) * 45;
    }

    if (trackId === 'load_hillclimb') {
      // Curvas de montaña estilo puerto alpino
      const cycle = 320;
      const phase = (distM % cycle) / cycle;
      return Math.sin(phase * Math.PI * 2) * 35;
    }

    return Math.sin((distM / 300) * Math.PI * 2) * 30;
  };

  // Renderizado gráfico en Canvas
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Limpiar fondo
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    const laneCount = vehicles.length;
    const laneHeight = (height - 40) / Math.max(1, laneCount);

    // Calcular posición del líder para la CÁMARA DINÁMICA DE SEGUIMIENTO (Scroller dinámico)
    let maxDistance = 0;
    vehicles.forEach((v) => {
      const state = getVehicleStateAtTime(v.id, currentTimeSec);
      if (state.distance > maxDistance) maxDistance = state.distance;
    });

    const trackLength = track.distanceMeters;

    // Ventana visible de la pista: en lugar de mostrar el 100% (que aplasta todo),
    // mostramos una ventana de ~280 metros alrededor del líder en alta velocidad.
    // Esto hace que la pista avance vertiginosamente y los objetos al costado vuelen hacia atrás.
    const windowLengthM = track.id === 'drag_quarter' ? 220 : 280;
    
    // El líder se coloca en el 60% horizontal de la pantalla para ver hacia adelante
    const cameraLeadFraction = 0.55;
    const cameraStartDist = Math.max(0, maxDistance - windowLengthM * cameraLeadFraction);
    const cameraEndDist = cameraStartDist + windowLengthM;

    // Función para convertir metros en coordenadas X del canvas
    const meterToPixelX = (m: number) => {
      return ((m - cameraStartDist) / windowLengthM) * width;
    };

    // 1. DIBUJAR ENTORNO PERIFÉRICO DE ALTA VELOCIDAD (Césped, asfalto lateral, luces y árboles)
    const backgroundGrad = ctx.createLinearGradient(0, 0, 0, height);
    backgroundGrad.addColorStop(0, '#0a101d');
    backgroundGrad.addColorStop(0.5, '#050811');
    backgroundGrad.addColorStop(1, '#0a101d');
    ctx.fillStyle = backgroundGrad;
    ctx.fillRect(0, 0, width, height);

    // Líneas de velocidad y textura de movimiento en el césped superior e inferior
    const speedStripDist = cameraStartDist % 20;
    ctx.fillStyle = '#0f172a';
    for (let px = -speedStripDist; px < width; px += 35) {
      ctx.fillRect(px, 0, 18, 14);
      ctx.fillRect(px, height - 14, 18, 14);
    }

    // Postes de luz / Balizas de pista al costado volando a gran velocidad (efecto parallax)
    const beaconSpacingM = 25; // Cada 25 metros un poste reflectivo
    const firstBeaconIdx = Math.floor(cameraStartDist / beaconSpacingM);
    const lastBeaconIdx = Math.ceil(cameraEndDist / beaconSpacingM);

    for (let b = firstBeaconIdx; b <= lastBeaconIdx; b++) {
      const beaconDist = b * beaconSpacingM;
      const bx = meterToPixelX(beaconDist);
      const curveY = getTrackCurvatureOffset(beaconDist, track.id);

      // Baliza reflectiva superior
      ctx.fillStyle = b % 2 === 0 ? '#38bdf8' : '#f59e0b';
      ctx.fillRect(bx - 2, 14 + curveY * 0.15, 4, 8);

      // Sombra proyectada por la velocidad
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(bx - 12, 14 + curveY * 0.15, 10, 8);

      // Baliza reflectiva inferior
      ctx.fillStyle = b % 2 === 0 ? '#ef4444' : '#f8fafc';
      ctx.fillRect(bx - 2, height - 22 + curveY * 0.15, 4, 8);
    }

    // 2. RENDERIZAR CARRILES CON CURVATURA ORGÁNICA REAL
    for (let i = 0; i < laneCount; i++) {
      const vehicle = vehicles[i];
      const baseLaneCenterY = 25 + i * laneHeight + laneHeight / 2;

      // Dibujar asfalto curvado del carril usando trazo continuo segmentado
      ctx.beginPath();
      const stepM = 4; // Muestreo cada 4 metros para curva suave
      const startSampleM = Math.floor(cameraStartDist / stepM) * stepM;
      const endSampleM = Math.ceil(cameraEndDist / stepM) * stepM;

      // Superficie del carril
      ctx.fillStyle = i % 2 === 0 ? '#0f172a' : '#0b1120';
      ctx.beginPath();
      // Borde superior del carril
      for (let m = startSampleM; m <= endSampleM; m += stepM) {
        const x = meterToPixelX(m);
        const curY = baseLaneCenterY - laneHeight / 2 + getTrackCurvatureOffset(m, track.id);
        if (m === startSampleM) ctx.moveTo(x, curY);
        else ctx.lineTo(x, curY);
      }
      // Borde inferior del carril
      for (let m = endSampleM; m >= startSampleM; m -= stepM) {
        const x = meterToPixelX(m);
        const curY = baseLaneCenterY + laneHeight / 2 + getTrackCurvatureOffset(m, track.id);
        ctx.lineTo(x, curY);
      }
      ctx.closePath();
      ctx.fill();

      // Límites de carril (bordillo)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Línea discontinua central del carril animada a velocidad de paso
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      const dashLenM = 6;
      const gapLenM = 8;
      const totalDashCycle = dashLenM + gapLenM;
      const firstDashM = Math.floor(cameraStartDist / totalDashCycle) * totalDashCycle;

      for (let dm = firstDashM; dm <= cameraEndDist; dm += totalDashCycle) {
        const dStartX = meterToPixelX(dm);
        const dEndX = meterToPixelX(dm + dashLenM);
        const y1 = baseLaneCenterY + getTrackCurvatureOffset(dm, track.id);
        const y2 = baseLaneCenterY + getTrackCurvatureOffset(dm + dashLenM, track.id);

        ctx.beginPath();
        ctx.moveTo(dStartX, y1);
        ctx.lineTo(dEndX, y2);
        ctx.stroke();
      }

      // Pianos de competición (Kerbs) en las zonas de curvas pronunciadas
      if (track.id === 'brake_slalom' || track.id === 'circuit') {
        const cornerInterval = track.id === 'brake_slalom' ? 260 : 420;
        const cornerZoneLength = track.id === 'brake_slalom' ? 95 : 120;
        const numCorners = Math.floor(trackLength / cornerInterval);

        for (let c = 1; c <= numCorners; c++) {
          const cornerEndDist = c * cornerInterval;
          const cornerStartDist = cornerEndDist - cornerZoneLength;

          // Solo dibujar si está en la ventana de cámara visible
          if (cornerEndDist >= cameraStartDist && cornerStartDist <= cameraEndDist) {
            const kerbStepM = 3;
            for (let km = cornerStartDist; km < cornerEndDist; km += kerbStepM) {
              const kx = meterToPixelX(km);
              const kw = (kerbStepM / windowLengthM) * width;
              const kyTop = baseLaneCenterY - laneHeight / 2 + getTrackCurvatureOffset(km, track.id);
              const kyBot = baseLaneCenterY + laneHeight / 2 + getTrackCurvatureOffset(km, track.id);

              const isRed = Math.floor(km / kerbStepM) % 2 === 0;
              ctx.fillStyle = isRed ? '#ef4444' : '#f8fafc';
              ctx.fillRect(kx, kyTop - 1, kw, 3);
              ctx.fillRect(kx, kyBot - 2, kw, 3);
            }

            // Cartel de curva
            if (i === 0) {
              const apexM = cornerStartDist + cornerZoneLength / 2;
              const apexX = meterToPixelX(apexM);
              if (apexX > -50 && apexX < width + 50) {
                const ay = baseLaneCenterY - laneHeight / 2 + getTrackCurvatureOffset(apexM, track.id);
                ctx.fillStyle = '#f59e0b';
                ctx.font = 'bold 9px "JetBrains Mono", monospace';
                ctx.fillText(`⚡ ÁPICE CURVA C${c}`, apexX - 25, ay - 8);
              }
            }
          }
        }
      }
    }

    // 3. LÍNEAS DE INICIO Y META SI ESTÁN DENTRO DE LA VENTANA VISIBLE
    // Línea de salida (0m)
    if (cameraStartDist <= 20) {
      const startLineX = meterToPixelX(0);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(startLineX, 20);
      ctx.lineTo(startLineX, height - 20);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('SALIDA 0m', startLineX + 6, 20);
    }

    // Línea de meta ajedrezada (trackLength)
    if (cameraEndDist >= trackLength - 30) {
      const finishLineX = meterToPixelX(trackLength);
      const checkSize = 10;
      for (let py = 20; py < height - 20; py += checkSize) {
        for (let px = 0; px < 2; px++) {
          const isWhite = (Math.floor(py / checkSize) + px) % 2 === 0;
          ctx.fillStyle = isWhite ? '#f8fafc' : '#020617';
          ctx.fillRect(finishLineX + px * checkSize, py, checkSize, checkSize);
        }
      }

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(`META (${trackLength}m)`, finishLineX - 85, 20);
    }

    // Marcadores de distancia visibles cada 100 metros
    const markSpacing = 100;
    const firstMark = Math.ceil(cameraStartDist / markSpacing) * markSpacing;
    for (let markM = firstMark; markM <= cameraEndDist && markM < trackLength; markM += markSpacing) {
      const mx = meterToPixelX(markM);
      const my = 20 + getTrackCurvatureOffset(markM, track.id);
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(mx, 20);
      ctx.lineTo(mx, height - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${markM}m`, mx - 12, 14);
    }

    // 4. DIBUJAR VEHÍCULOS CON SEGUIMIENTO DE CURVATURA Y EFECTO DE VELOCIDAD
    vehicles.forEach((vehicle, index) => {
      const vState = getVehicleStateAtTime(vehicle.id, currentTimeSec);
      const baseLaneCenterY = 25 + index * laneHeight + laneHeight / 2;

      // Desviación lateral de la curva en la posición actual del coche
      const curveOffsetY = getTrackCurvatureOffset(vState.distance, track.id);
      const carPixelX = meterToPixelX(vState.distance);
      const carPixelY = baseLaneCenterY + curveOffsetY;

      // Calcular ángulo tangente de la curva para que el coche apunte en la dirección de la pista
      const deltaM = 2.0;
      const futureCurveY = getTrackCurvatureOffset(vState.distance + deltaM, track.id);
      const angleRad = Math.atan2(futureCurveY - curveOffsetY, deltaM * (width / windowLengthM));

      const carLength = vehicle.category === 'heavy_truck' ? 76 : 56;
      const carWidth = vehicle.category === 'heavy_truck' ? 26 : 22;

      ctx.save();
      ctx.translate(carPixelX, carPixelY);
      ctx.rotate(angleRad);

      // Estelas de viento y velocidad lateral (Speed lines)
      if (vState.speedKmh > 60 && isPlaying) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        for (let sl = 1; sl <= 3; sl++) {
          ctx.beginPath();
          ctx.moveTo(-carLength / 2 - sl * 8, (Math.random() - 0.5) * carWidth);
          ctx.lineTo(-carLength / 2 - sl * 25, (Math.random() - 0.5) * carWidth);
          ctx.stroke();
        }
      }

      // Sombra del vehículo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.ellipse(0, 4, carLength / 2 + 6, carWidth / 2 + 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Humo / derrape si está frenando bruscamente en curva
      if (vState.isBraking && vState.speedKmh > 35) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
        for (let sm = 0; sm < 4; sm++) {
          ctx.beginPath();
          ctx.arc(-carLength / 3 - sm * 10, (Math.random() - 0.5) * carWidth * 1.2, 5 + sm * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Remolque de carga si aplica
      if (track.cargoPayloadKg > 0) {
        const trailerLength = 40;
        const trailerWidth = carWidth;
        const trailerX = -carLength / 2 - trailerLength / 2 - 8;

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-carLength / 2, 0);
        ctx.lineTo(trailerX + trailerLength / 2, 0);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.fillRect(trailerX - trailerLength / 2, -trailerWidth / 2, trailerLength, trailerWidth);
        ctx.strokeRect(trailerX - trailerLength / 2, -trailerWidth / 2, trailerLength, trailerWidth);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText(`+${track.cargoPayloadKg}kg`, trailerX - 16, 3);
      }

      // Renderizado del vehículo en vista cenital / superior realista sin fondo
      const cleanSprite = getCleanZenithSprite(
        vehicle.id,
        vehicle.photoAngles?.topZenith || vehicle.imageUrl || '',
        vehicle.color,
        () => setSpriteTick((t) => t + 1)
      );

      const renderLength = vehicle.category === 'heavy_truck' ? 96 : 84;
      const renderWidth = cleanSprite ? Math.max(34, Math.round(renderLength / cleanSprite.aspectRatio)) : 40;

      if (cleanSprite) {
        // 1. Sombra de contacto profunda y suave bajo el vehículo sobre el asfalto
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.ellipse(-renderLength * 0.04, 3, renderLength * 0.50, renderWidth * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Haz de luz de faros delanteros con mayor alcance proyectado sobre el asfalto de la pista
        ctx.save();
        const beamLength = 175; // Gran alcance de iluminación hacia adelante
        const startX = renderLength * 0.44;

        // Cono de iluminación amplio sobre el pavimento
        const headlightGrad = ctx.createRadialGradient(
          startX + 10, 0, 8,
          startX + beamLength * 0.6, 0, beamLength * 0.85
        );
        headlightGrad.addColorStop(0, 'rgba(255, 255, 245, 0.48)');
        headlightGrad.addColorStop(0.25, 'rgba(224, 242, 254, 0.28)');
        headlightGrad.addColorStop(0.60, 'rgba(186, 230, 253, 0.12)');
        headlightGrad.addColorStop(1, 'rgba(186, 230, 253, 0.0)');

        ctx.fillStyle = headlightGrad;
        ctx.beginPath();
        ctx.moveTo(startX, -renderWidth * 0.38);
        ctx.lineTo(startX + beamLength, -renderWidth * 1.10);
        ctx.bezierCurveTo(
          startX + beamLength * 1.08, 0,
          startX + beamLength * 1.08, 0,
          startX + beamLength, renderWidth * 1.10
        );
        ctx.lineTo(startX, renderWidth * 0.38);
        ctx.closePath();
        ctx.fill();

        // Haces directos concentrados de cada faro individual
        const leftBeamGrad = ctx.createLinearGradient(startX, -renderWidth * 0.28, startX + beamLength * 0.85, -renderWidth * 0.45);
        leftBeamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        leftBeamGrad.addColorStop(0.4, 'rgba(224, 242, 254, 0.25)');
        leftBeamGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
        ctx.fillStyle = leftBeamGrad;
        ctx.beginPath();
        ctx.moveTo(startX, -renderWidth * 0.32);
        ctx.lineTo(startX + beamLength * 0.85, -renderWidth * 0.55);
        ctx.lineTo(startX + beamLength * 0.85, -renderWidth * 0.15);
        ctx.lineTo(startX, -renderWidth * 0.22);
        ctx.closePath();
        ctx.fill();

        const rightBeamGrad = ctx.createLinearGradient(startX, renderWidth * 0.28, startX + beamLength * 0.85, renderWidth * 0.45);
        rightBeamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        rightBeamGrad.addColorStop(0.4, 'rgba(224, 242, 254, 0.25)');
        rightBeamGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
        ctx.fillStyle = rightBeamGrad;
        ctx.beginPath();
        ctx.moveTo(startX, renderWidth * 0.22);
        ctx.lineTo(startX + beamLength * 0.85, renderWidth * 0.15);
        ctx.lineTo(startX + beamLength * 0.85, renderWidth * 0.55);
        ctx.lineTo(startX, renderWidth * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 3. DIBUJAR EXCLUSIVAMENTE EL PNG REAL (Sin óvalos ni marcos artificiales)
        ctx.drawImage(
          cleanSprite.canvas,
          -renderLength * 0.5,
          -renderWidth * 0.5,
          renderLength,
          renderWidth
        );

        // 4. Freno incandescente auténtico solo si está desacelerando bruscamente
        if (vState.isBraking) {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
          ctx.fillRect(-renderLength * 0.48, -renderWidth * 0.38, 2, 5);
          ctx.fillRect(-renderLength * 0.48, renderWidth * 0.38 - 5, 2, 5);
          ctx.restore();
        }

        // 5. Balizas de emergencia intermitentes si el vehículo se quedó sin combustible o varado en la pista
        if (vState.outOfFuel) {
          const isHazardFlashOn = Math.floor(currentTimeSec * 3.5) % 2 === 0;
          if (isHazardFlashOn) {
            ctx.save();
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
            // Faros delanteros intermitentes ámbar
            ctx.fillRect(renderLength * 0.44, -renderWidth * 0.36, 4, 5);
            ctx.fillRect(renderLength * 0.44, renderWidth * 0.36 - 5, 4, 5);
            // Luces traseras intermitentes ámbar
            ctx.fillRect(-renderLength * 0.48, -renderWidth * 0.38, 3, 5);
            ctx.fillRect(-renderLength * 0.48, renderWidth * 0.38 - 5, 3, 5);
            ctx.restore();
          }
        }
      } else {
        // Fallback vectorial temporal mientras carga la imagen
        ctx.fillStyle = vehicle.color;
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(carLength * 0.42, -carWidth * 0.32);
        ctx.bezierCurveTo(carLength * 0.52, -carWidth * 0.22, carLength * 0.52, carWidth * 0.22, carLength * 0.42, carWidth * 0.32);
        ctx.lineTo(carLength * 0.28, carWidth * 0.48);
        ctx.lineTo(carLength * 0.12, carWidth * 0.48);
        ctx.lineTo(carLength * 0.02, carWidth * 0.44);
        ctx.lineTo(-carLength * 0.22, carWidth * 0.49);
        ctx.lineTo(-carLength * 0.40, carWidth * 0.46);
        ctx.bezierCurveTo(-carLength * 0.50, carWidth * 0.35, -carLength * 0.50, -carWidth * 0.35, -carLength * 0.40, -carWidth * 0.46);
        ctx.lineTo(-carLength * 0.22, -carWidth * 0.49);
        ctx.lineTo(carLength * 0.02, -carWidth * 0.44);
        ctx.lineTo(carLength * 0.12, -carWidth * 0.48);
        ctx.lineTo(carLength * 0.28, -carWidth * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(carLength * 0.22, -carWidth * 0.35);
        ctx.lineTo(carLength * 0.08, -carWidth * 0.38);
        ctx.lineTo(carLength * 0.08, carWidth * 0.38);
        ctx.lineTo(carLength * 0.22, carWidth * 0.35);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // 4. TELEMETRÍA EN CABECERA DEL CARRIL (FIJA EN EL CARRIL, NUNCA TAPA A LOS VEHÍCULOS)
      const isSelected = vehicle.id === selectedVehicleId;
      const hudX = 14;
      const hudY = baseLaneCenterY - laneHeight / 2 + 6;
      const hudWidth = 265;
      const hudHeight = 22;

      ctx.save();
      ctx.fillStyle = isSelected ? 'rgba(15, 23, 42, 0.90)' : 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = vState.outOfFuel ? '#ef4444' : isSelected ? '#38bdf8' : 'rgba(51, 65, 85, 0.8)';
      ctx.lineWidth = isSelected || vState.outOfFuel ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudWidth, hudHeight, 4);
      ctx.fill();
      ctx.stroke();

      // Punto distintivo del vehículo
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.arc(hudX + 10, hudY + hudHeight / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Nombre del vehículo
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`${vehicle.name.slice(0, 10)}`, hudX + 20, hudY + 15);

      // Si se quedó sin combustible / batería
      if (vState.outOfFuel) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const isEv = vehicle.fuelType === 'electric';
        ctx.fillText(isEv ? '⚡ 0% BATERÍA' : '⚠️ SIN COMBUSTIBLE', hudX + 85, hudY + 15);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText(`VARADO ${vState.distance.toFixed(0)}m`, hudX + 185, hudY + 15);
      } else {
        // Velocidad
        ctx.fillStyle = vState.isBraking ? '#f87171' : '#38bdf8';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(`${vState.speedKmh.toFixed(0)} km/h`, hudX + 85, hudY + 15);

        // Distancia y aceleración
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${vState.distance.toFixed(0)}m · ${vState.accelG.toFixed(2)}G`, hudX + 145, hudY + 15);

        // Estado dinámico
        if (vState.isBraking) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.fillText('FRENO', hudX + hudWidth - 36, hudY + 15);
        } else if (vState.inCorner) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.fillText('CURVA', hudX + hudWidth - 36, hudY + 15);
        }
      }
      ctx.restore();
    });

    // Semáforo de salida si estamos en cuenta regresiva
    if (countdown !== null) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = countdown === 0 ? '#10b981' : '#f59e0b';
      ctx.font = 'bold 64px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(countdown === 0 ? '¡GO!' : countdown.toString(), width / 2, height / 2 + 20);
      ctx.textAlign = 'start';
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTimeSec(val);
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  const selectedVehicleState = selectedVehicle
    ? getVehicleStateAtTime(selectedVehicle.id, currentTimeSec)
    : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Track Info Banner */}
      <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="text-blue-400 font-semibold">{track.name}</span>
            <span aria-hidden="true">·</span>
            <span>Distancia: {track.distanceMeters}m</span>
            {track.inclineGradePercent > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-semibold">Pendiente: +{track.inclineGradePercent}%</span>
              </>
            )}
            {track.cargoPayloadKg > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-purple-400 font-semibold flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Carga: +{track.cargoPayloadKg} kg
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{track.subtitle}</p>
        </div>

        {/* Audio Toggle & Live Race Timer */}
        <div className="flex items-center gap-3">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1.5 ${
              isMuted
                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                : 'bg-slate-800 border-slate-700 text-sky-400 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Activar rugido de motor' : 'Silenciar sonido'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Audio ON'}</span>
          </button>

          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-center font-mono">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Tiempo</span>
            <span className="text-base font-bold text-white tabular-nums">
              {currentTimeSec.toFixed(2)}s
            </span>
          </div>

          {hasFinished && (
            <button
              onClick={onFinishRace}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Ver Resultados</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Dynamic High-Speed Curved Canvas */}
      <div className="relative bg-[#060a12] w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1100}
          height={vehicles.length * 95 + 40}
          className="w-full h-auto block cursor-crosshair"
        />
      </div>

      {/* Playback Controls & Scrubber */}
      <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Play / Pause / Reset / Speed */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-md shadow-blue-600/30"
            title={isPlaying ? 'Pausar' : 'Reanudar'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => {
              setCurrentTimeSec(0);
              setIsPlaying(true);
              setHasFinished(false);
            }}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors border border-slate-700"
            title="Reiniciar Carrera"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 ml-2 text-xs font-mono">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="flex-1 max-w-md w-full flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400">0.00s</span>
          <input
            type="range"
            min="0"
            max={maxRaceTimeSec}
            step="0.02"
            value={currentTimeSec}
            onChange={handleSeek}
            className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
          <span className="text-[11px] font-mono text-slate-400">{maxRaceTimeSec.toFixed(2)}s</span>
        </div>

        {/* Selected Vehicle Selector for Telemetry Focus */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-blue-400" /> Foco:
          </span>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Focused Vehicle Digital Dashboard Strip */}
      {selectedVehicle && selectedVehicleState && (
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/60 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-500 block uppercase">Velocímetro</span>
            <span className="text-base font-bold text-sky-400 tabular-nums">
              {selectedVehicleState.speedKmh.toFixed(1)} <span className="text-[10px] text-slate-400">km/h</span>
            </span>
          </div>

          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-500 block uppercase">Fuerza G</span>
            <span className="text-base font-bold text-amber-400 tabular-nums">
              {selectedVehicleState.accelG.toFixed(2)} <span className="text-[10px] text-slate-400">G</span>
            </span>
          </div>

          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-500 block uppercase">Distancia</span>
            <span className="text-base font-bold text-white tabular-nums">
              {selectedVehicleState.distance.toFixed(1)} <span className="text-[10px] text-slate-400">m</span>
            </span>
          </div>

          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <span className="text-[10px] text-slate-500 block uppercase">Marcha & RPM</span>
            <span className="text-base font-bold text-emerald-400 tabular-nums">
              G{selectedVehicleState.gear} <span className="text-[10px] text-slate-400">({selectedVehicleState.rpm} rpm)</span>
            </span>
          </div>

          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-500 block uppercase">Frenos & Sector</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tabular-nums ${
                  selectedVehicleState.isBraking
                    ? 'bg-red-500 text-white animate-pulse'
                    : selectedVehicleState.inCorner
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-slate-300'
                }`}
              >
                {selectedVehicleState.isBraking
                  ? '⚡ FRENADA'
                  : selectedVehicleState.inCorner
                  ? 'EN CURVA'
                  : 'RECTA'}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {selectedVehicle.equipment?.brakesType === '4_discs' ? '4 Discos' : 'Disco/Tambor'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
