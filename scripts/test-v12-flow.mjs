import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=x=>readFileSync(resolve(root,x),'utf8');
const mobile=read('src/components/mobile/MobileGameExperience.tsx');
const race=read('src/components/Race3DPerspectiveView.tsx');
const power=read('src/utils/powertrainDynamics.ts');
const css=read('src/index.css');
const catalog=read('src/data/presetVehicles.ts');
const tests=[
 ['Nombre aprobado',mobile.includes('LOS MÁS<br/><em>BUSCADOS.')],
 ['Portada swipe',mobile.includes('onTouchEnd={event=>')&&mobile.includes('dc12-featured-nav')],
 ['Comparador selección explícita',mobile.includes('dc12-select-compare')&&mobile.includes('setCompareFocusId')],
 ['Comparación visual 3D',mobile.includes('experience="comparison"')&&mobile.includes('setCompareSimulation(true)')],
 ['Visor exclusivamente manual',!mobile.includes('autoPlay muted loop controls')&&mobile.includes('Photographic360Viewer')],
 ['Vista técnica',mobile.includes('showroomCar.technicalDetails')],
 ['Pantalla carga real',mobile.includes('loadVehicleGLTF(')&&mobile.includes('setStage(\'loading\')')],
 ['Start manual',race.includes('raceGateReady')&&race.includes('setStartRequested(true)')],
 ['Cuenta regresiva 1 segundo',race.includes('1000);')&&race.includes('startStep(')],
 ['Mensaje al atascarse',race.includes('VEHÍCULO ATASCADO')&&race.includes('nearPothole')],
 ['Reiniciar carrera',race.includes('onRestartRace?.()')],
 ['Caja y RPM comunes al HUD',race.includes('simulatedGear(car.vehicle,car.speed)')&&power.includes('export function simulatedGear')],
 ['Audio usa RPM física',race.includes('soundEngine.updateTelemetry(v, st.rpm')],
 ['Toma final lenta',race.includes('finishCinematicStartedAt')&&race.includes('finishCarPose')],
 ['Resultados extendidos',mobile.includes('TODOS LOS DATOS')&&mobile.includes('MobileTelemetryChart')],
 ['Responsive mobile',css.includes('.dc12-featured')],
 ];
for(const [name,ok] of tests){assert.ok(ok,`Fallo: ${name}`);console.log('OK',name);}
const urls=[...catalog.matchAll(/video360Url:\s*'([^']+)'/g)].map(m=>m[1]);
for(const url of urls){if(existsSync(resolve(root,'public'+url)))console.log('OK video local',url);else console.warn('ATENCIÓN: video no está en este paquete liviano, debe permanecer en tu proyecto:',url);}
console.log(`V12: ${tests.length} comprobaciones estáticas aprobadas. Faltan build y prueba real de navegador.`);
