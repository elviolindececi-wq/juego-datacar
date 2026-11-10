# DATACAR ARENA V9.2 — Ingeniería de circuitos curvos

## Implementación realizada

**Base:** V9.1. Esta versión reemplaza la suposición de que la distancia de carrera es idéntica a la coordenada mundial Z para los seis circuitos urbanos. Las pruebas técnicas de comparación 0–100 km/h y 402 m conservan trazados rectos y distancias originales.

### 1. Ruta física compartida
- `src/utils/curvedRoadPath.ts` calcula trayectoria integrada por longitud de arco, tangente, curvatura y transformaciones Frenet ↔ coordenadas mundiales.
- Una misma ruta se usa en la física (`InteractiveRacePhysics`), el asfalto, la posición 3D de vehículos/obstáculos, los charcos, la cámara y el minimapa.
- Los seis circuitos ahora miden entre 1.600 y 2.300 metros y contienen curvas suaves de radio amplio. Son trazados ficticios inspirados en Asunción, NO trazados cartográficos oficiales.

### 2. Física y conducción
- El motor conserva velocidad longitudinal, velocidad lateral, yaw rate y fuerzas por eje.
- Posición relativa al centro de la vía: `s` (longitud recorrida), `x` (desplazamiento lateral) y `yaw` (respecto de la tangente).
- Cinemática curvilínea: `s_dot = (v_long*cos(yaw)-v_lat*sin(yaw)) / (1 - curvature*x)` y `x_dot = v_long*sin(yaw)+v_lat*cos(yaw)`.
- Orientación del auto relativa al camino: `yaw_dot_relative = yaw_rate_world - curvature*s_dot`.
- Los rivales utilizan la curvatura de la vía como feedforward más seguimiento del carril; siguen obligados por las limitaciones de sus propias fichas y no reciben aceleración artificial.
- Contactos entre autos y obstáculos se evalúan en coordenadas mundiales; la corrección de posición vuelve al sistema de referencia del camino.
- Los baches, reductores, agua y ABS existentes siguen usando el `s` y el desplazamiento lateral compartidos.
- El límite de seguridad de una carrera urbana se amplió a 420 segundos para evitar terminar automáticamente un recorrido largo antes de la meta.

### 3. Gráficos y cámaras
- `src/utils/curvedRoadVisuals3D.ts` produce asfalto curvo teselado y adapta fachadas, calles transversales, señales, veredas, árboles, cables e instancias urbanas al mismo recorrido.
- Se mantienen los baches y la geometría con perforaciones de calzada. Las perforaciones se recalculan al cambiar el catálogo de obstáculos, no cada frame.
- Los GLB usan posición mundial derivada de `(s,x)` y heading absoluto = tangente de ruta + yaw relativo del vehículo.
- La cámara Arcade y la de tercera persona siguen el GLB mundial. Director TV transforma sus posiciones a la ruta, manteniendo la reproducción de la trayectoria real de la partida.
- El minimapa original está situado abajo a la izquierda y traza el segmento próximo de la **misma** ruta, junto con rivales y meta.
- El mapa de relieve de asfalto mejora el detalle próximo de agregados y grava; NO pretende sustituir un escaneo de pavimento fotogramétrico.

### 4. Conservar equipamiento real
- No se han alterado las especificaciones de ninguno de los siete vehículos.
- La física más avanzada de V8.9 (neumáticos por eje, motor, HEV, mild hybrid, ABS y ADAS verificados) se conserva sin modificar potencia o torque.
- No se atribuyen prestaciones OEM no verificadas.

### 5. Pruebas completadas
- `npm run test:v92`: prueba de los seis trazados, transformación de coordenadas, continuidad, curvas suaves, tres competidores automáticos en cada ruta, registro de telemetría, conexión de la malla y minimapa.
- Todo el conjunto de regresiones `npm run test:v91` pasó.
- 57 archivos TypeScript/TSX procesados con `transpileModule`, sin errores de sintaxis.

### 6. Límites / pendientes de validación
- No se pudo ejecutar `npm run build` en este entorno porque la instalación de dependencias de npm no terminó; la compilación en tu máquina es imprescindible.
- El resultado visual con WebGL debe verificarse en Chrome: alineación de intersecciones, fachadas, sombras, curvas y plano frontal de meta.
- El simulador usa un modelo dinámico simplificado con colisiones aproximadas; no es un gemelo digital certificado de los fabricantes.
- La extensión de circuitos urbanos no representa rutas reales de Asunción; para mapas reales se necesitarían datos GIS y trabajo de nivel adicional.

## Instalación

Recomendado: extraer el proyecto completo en una carpeta nueva, abrir la carpeta en VS Code y ejecutar:

```powershell
npm install
npm run test:v92
npm run build
npm run dev
```

Si hay un error en la compilación, conservar la salida completa de la terminal para corregirlo antes de continuar.
