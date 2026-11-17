# DATACAR ARENA V8.9 — Física dinámica avanzada

Actualización acumulativa sobre V8.8. Incorpora fuerzas laterales por eje delantero/trasero, ángulos de deriva, inercia de guiñada, transferencia longitudinal de peso, elipse de fricción (freno/acelerador + giro), respuesta lateral por neumáticos, balanceo/cabeceo amortiguados, fuerza eléctrica HEV limitada por potencia combinada y corrección de colisiones proporcional a masa.

- `npm run test:v89` valida siete vehículos, maniobras dinámicas y las regresiones anteriores.
- `npm run build` debe ejecutarse en el equipo con las dependencias instaladas.
- Ver **`docs/AUDITORIA_FISICA_V8_9.md`** para fuentes, supuestos, pruebas, límites y qué falta para un modelo de máxima fidelidad.
- **NO** interpretar los tiempos simulados como prestaciones homologadas. La ficha exacta manda; lo ausente se estima y etiqueta.

---

# DATACAR ARENA V8.8

Catálogo ampliado a seis modelos de las fichas recibidas y Carens legado. Consultá `VERIFICACION_FICHAS_V8_8.md` y `INSTALAR_V8_8.txt`.

## V8.5 — Animación fluida y ovación de meta

- Interpolación de poses entre pasos físicos a 100 Hz, sin tocar colisiones ni los resultados.
- Resolución gráfica adaptable cuando bajan los FPS; los GLB siguen requiriendo optimización para equipos limitados.
- RPM de audio del motor físico, salida de sonido con fade, ovación provisional de 3,6 s en la meta.
- `npm run test:v85` valida la interpolación, los recursos de audio, y conserva tests V8.4.

## V7.8 — Asunción ambientada y lomos de burro

- Cruces transversales y pasos peatonales por circuito, con rotulación en estilo de cartelería urbana de Asunción.
- Anuncios DATACARPY.COM integrados a las fachadas, cables aéreos y postes.
- Lomos de burro 3D con desaceleración y respuesta visual de suspensión; rivales anticipan y reducen velocidad.
- Escenarios de ficción inspirados en zonas reales. **No** se puede girar aún hacia las calles transversales.
- Instalar sobre V7.7, ejecutar `npm run test:v78` y `npm run dev`.

# DATACAR ARENA V7.0 — Dos experiencias

Proyecto React + Vite + TypeScript + Three.js, organizado en pantallas independientes:

1. **Comparar**: elección de exactamente dos autos, simulación predeterminada sobre fichas técnicas y resultados.
2. **Modo Carrera**: filtro por dificultad, seis circuitos ficticios inspirados en Asunción, showroom 360°, confirmación, conducción con teclado, podio y repetición cinematográfica **solo después** de la carrera.

### Circuitos inspirados en Asunción

Avenida Avelino Martínez (9,5), Herrera y Caballero (8,0), José Félix López (7,5), Artigas y Mburicaó (8,5), Oliva y Piribebuy (6,5), Aviadores del Chaco (4,0).

Cada circuito dispone de un perfil diferenciado de densidad de obstáculos, adherencia y rugosidad. **Son niveles ficticios con tramos rectos estilizados**, no reconstrucciones viales auténticas ni reportes sobre el estado actual de las calles.

### Física de conducción

Paso de 100 Hz, aproximación de fuerzas F=ma, arrastre aerodinámico, adherencia limitada, dirección tipo bicicleta, deslizamiento, pérdida de velocidad por baches, choques auto-auto / auto-obstáculo y conducción automática de rivales. Es una simulación lúdica aproximada.

### Director TV de repetición

Las telemetrías de partida incluyen X lateral, Z longitudinal, ángulo del vehículo, ángulo de rueda, deslizamiento y suspensión. Al terminar la carrera, la repetición reproduce la trayectoria **real de esa partida**, con cámara Director TV y controles de reproducción. Durante la conducción, la cámara Director TV está oculta.

### Desarrollo y pruebas

```bash
npm install
npm run test:v7
npm run test:interactive
npm run test:interactive:extended
npm run test:steering
npm run test:director
npm run dev
```

Para compilar producción: `npm run build`.

**No se compiló visualmente en este entorno** porque la instalación de dependencias no estuvo disponible. Necesita validarse en VS Code/navegador. El GLB de las cinco piezas conserva su jerarquía, pero todavía se reutiliza el mismo modelo de Tracker para Kicks y Carens mientras no dispongamos de modelos propios.

Para actualizar tu V6.0, consultar `INSTRUCCIONES_V7_0.txt`. No hace falta instalar la V6.1 por separado.

## V7.5 — Toyota Corolla Cross SEG 2027

Se añadió un cuarto vehículo con GLB propio segmentado por Meshy, video 360°, 120 fotogramas de giro manual y ficha aportada por el usuario. En carrera participan tres autos (jugador y dos rivales). Para pruebas de integridad: `npm run test:corolla`.

**Aviso:** los parámetros de peso, frenado, consumo, aerodinámica y prestaciones no presentes en la ficha son aproximaciones internas para el motor físico, no datos homologados. Ver `LEEME_V7_5_COROLLA_CROSS.txt`.


## Cambios V7.6 — cierre comercial y pista

- **CTA final** con enlace a https://datacarpy.com en resultados de comparación, podio y repetición.
- **Etiquetas 3D** ocultas por defecto durante Modo Carrera, con botón `Nombres ON/OFF`. La telemetría no desaparece.
- **Entorno vial**: carriles, marcas de borde, veredas, cordones, farolas, arbolado y edificios estilizados en los seis circuitos ficticios de Asunción. Geometría con instancias para limitar draw calls.
- **Mejor visibilidad**: ambiente más claro y asfalto gris oscuro con textura granulada.
- Este paso **no** agrega calles reales ni curvas; conserva la física de V7.5.

Actualizar sobre V7.5: descomprimir parche en la carpeta del proyecto **conservar estructura src/** y sobrescribir archivos existentes. Luego ejecutar `npm run test:v76` y `npm run dev`.

## V7.7 — Baches urbanos más realistas

Los círculos de asfalto oscuro se sustituyeron por decals procedimentales
con bordes orgánicos, grietas, grava, falsa profundidad y charcos según el
perfil del circuito. El trazado y la física de baches/choques se conservan.
Tres texturas reutilizables de 512 px evitan una carga por obstáculo.

Pruebas: `npm run test:v77`. Instalación: `INSTALAR_V7_7.txt`.

## V8.0 — Cámara arcade, lluvia/raudales, sonido y texturas urbanas

- **Modo Carrera**: selector de clima antes de largar y durante la carrera: Soleado, Nublado, Lluvia, Tormenta y Raudales.
- **Física aproximada**: adherencia reducida en lluvia, charcos por zonas, resistencia al avance y fuerza lateral limitada en raudales; la IA puede frenar/evitar agua según el camino disponible.
- **Cámara Arcade NFS**: perspectiva baja/trasera centrada en el auto propio con distancia y FOV graduados según velocidad; no incluye cámara de Director TV durante la conducción.
- **Audio WebAudio**: sonido de motor según RPM/acelerador, chirrido por frenadas/derrapes, impactos y lluvia; habilitado al interactuar con el juego, sin MP3 externos.
- **Ambientación**: asfalto con parches y fisuras, fachadas con ventanas y desgaste, anuncios integrados a las paredes, señales de nombres de calle más pequeñas. Edificios procedimentales, no fotogrametría.
- **Repetición**: memoriza el clima usado durante la carrera y lo muestra en Director TV.
- **Vite**: usa `import.meta.dirname` para evitar la advertencia `__dirname` del modo nativo.
- Validación: `npm run test:v80` (incluye suites anteriores). La compilación visual completa debe verificarse en VS Code tras `npm install`.

Instalación: `INSTALAR_V8_0.txt`. Esta actualización está hecha sobre el proyecto V7.9.


## V8.6 — ABS según ficha y frenada fuerte

- Asistente ABS modelado únicamente cuando figura expresamente en la ficha (`safetyFeatures` o `equipment.abs`).
- Frenadas al límite: modulación de presión, menor deslizamiento y conservación aproximada de dirección.
- Nueva capa de audio Web Audio de fricción en frenada brusca (no se activa en frenadas suaves).
- HUD de ABS para los vehículos con datos confirmados; telemetría grabada para replay.
- Ejecutar `npm run test:v86` y ver `LEEME_V8_6_ABS_Y_FRENADA.txt`.

## V8.7 — Física por ficha + asistencias por versión

- Dinámica modular: `src/utils/vehicleDynamicsProfile.ts` deriva parámetros de masa, potencia, torque, radio de neumático, batalla y transmisión.
- Seguridad: `src/utils/vehicleSafetySystems.ts`, tres estados por función. ABS, TCS, ESC y AEB sólo si confirmados; AEB preparado para nuevos modelos.
- `src/data/vehicleCatalog.ts`: validación y extensión con vehículos nuevos sin reescribir el motor de carreras.
- Fichas de showroom indican confirmado/pendiente/no equipado y fuente de cada modelo.
- **Pendiente**: cotejar Kicks Sense 2027 (DCT vs 1.6 CVT), Carens MY24 y Tracker Lite MY24; los datos de fichas de otro año no se convierten en equipamiento oficial.
- Pruebas: `npm run test:v87`. Leé `VERIFICACION_FICHAS_V8_7.md`.


## V9.0
- HUD arcade con velocímetro y tacómetro inspirados en juegos de calle.
- Eliminado overlay central de llegada en la meta.
- Alertas críticas movidas a la esquina superior derecha durante la carrera.

## V9.1 — Los más buscados de DATACAR + baches legibles

Nueva pantalla de portada con selección entre siete vehículos. Los más buscados es un nombre editorial, no estadísticas reales. La vista de conducción incluye nueva textura de aproximación a baches, pequeñas piedras y cámara que ajusta el ángulo (sin zoom) ante pozos próximos en el propio carril. Se conserva la física V8.9 y el HUD V9.0. Instalar desde cero con `npm install`, `npm run test:v91`, `npm run build` y `npm run dev`. Más detalles en `LEEME_V9_1.txt`.

## Actualización V9.2 — Circuitos curvos y minimapa

Esta versión incorpora carreteras curvas físicamente transitables en los seis circuitos urbanos, nuevas longitudes (1.600–2.300 m), IA con seguimiento de trayectoria, geometría urbana y de asfalto adaptada, minimapa de la ruta real y microdetalle de asfalto próximo. Se mantienen el catálogo de siete vehículos, el HUD V9.0, los baches, el clima, ABS/ADAS y Director TV.

**Validación:** `npm run test:v92` (regresiones incluidas). Se requiere `npm run build` en un entorno con dependencias instaladas. Ver `docs/IMPLEMENTACION_V9_2.md`.

## V9.3 — Llegada cinematográfica y viaductos DATACAR
- Cámara de llegada frontal/3-4 calculada desde la posición y dirección global real del automóvil, incluso en carreteras curvas.
- La toma final no muestra el HUD sobre el coche; los resultados comienzan con una imagen grande del vehículo conducido por el jugador.
- Viaductos ficticios elevados en los seis circuitos urbanos; publicidad datacarpy.com aplicada a las barandas de concreto y postes fuera de la calzada.
- Nuevo comando de validación: `npm run test:v93`.
- Proyecto de entretenimiento; los pasos elevados y posiciones no representan obras reales de Asunción.

## V9.5 — Driving IQ y escala provisional de Carens

- Nueva clasificación de **primero en llegar** versus **mejor conducción**.
- 100 puntos por tiempo relativo (35), conducción sin impactos (30), obstáculos (20) y control (15).
- Diagnóstico automatizado vinculado a telemetría observada. No sustituye pruebas reales de seguridad ni ensayos técnicos.
- IA con mayor anticipación y maniobra de recuperación física tras atascos; no es inmune a los choques.
- Escala longitudinal del modelo sustituto de Carens actualizada a 4,54 m según la ficha interna. La silueta todavía es una Tracker RS provisional: no puede confundirse con una Carens 3D auténtica.
- Pruebas: `npm run test:v95`.


## V9.6 — Salida sonora y datos durante la carrera
- Cuenta regresiva Web Audio: tres pitidos cortos y un cuarto sostenido, sincronizado con la salida física (2,1 s).
- Desbloqueo del audio desde el botón «¡EMPEZAR CARRERA!» para cumplir las políticas de reproducción de Chrome.
- Cápsulas «DATACAR · DATO EN CARRERA» cada 5,2 segundos, basadas en fichas verificadas y telemetría de la partida.
- Mensajes de frenado, adherencia, colisiones, baches, transmisiones, híbridos y turbo, sin atribuir «salida lenta» únicamente al torque.
- Potencia/torque estimados o faltantes (p. ej. Chery T2) nunca se exhiben como especificaciones de fábrica.
- `npm run test:v96` prueba la lógica de mensajes y ejecuta todas las pruebas de regresión V9.5.
