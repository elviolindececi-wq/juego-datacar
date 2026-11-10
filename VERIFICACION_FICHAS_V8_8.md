# DATACAR ARENA V8.8 — Fichas, asistencias y física

**Fuente de las características:** capturas de fichas de DATACAR aportadas en la conversación el 10/11/2026. Se conservaron seis capturas en `docs/fichas_datacar_usuario/`. Son referencias de la configuración exhibida; no sustituyen homologaciones o fichas comerciales vigentes para otros países o lotes.

| Vehículo | Potencia para el juego | Torque para el juego | Tren de fuerza / caja | Seguridad documentada | Advertencias |
|---|---:|---:|---|---|---|
| Chevrolet Tracker 1.2 Turbo | 139 CV ≈ 137,1 HP | 220 Nm | 1.2 Turbo FWD, AT6 | ABS/EBD, ESC/TCS, HAC; AEB baja velocidad, FCW, punto ciego | Reemplaza ficha antigua 1.0 Turbo. Año exacto no expreso en captura. |
| Toyota Corolla Cross SEG | 171 HP | 203 Nm | 2.0 aspirado FWD, CVT | ABS/EBD, VSC/TRC, HAC. Ficha: sin ADAS | Precio SEG del usuario USD 36.800; precio "desde" del catálogo no es precio SEG. |
| Nissan Kicks 1.2 6DCT | 120 HP | 220 Nm | 1.2 FWD 6DCT | ABS/EBD, VDC, HSA; AEB/FCW, LDW, RCTA, I-CC | Reemplaza antigua combinación 1.6 CVT. Despeje "0 mm" en ficha es dato ausente; se usa 180 mm solo en simulación. Ancho 2.090 mm como figura, puede incluir espejos. |
| Chery T4 Pro Luxury HEV | 195 HP **combinados** | 125 Nm nafta / 310 Nm **motor eléctrico**, no Nm combinados | HEV autorrecargable 1.5/DHT, batería 1,86 kWh, FWD | ABS/ESP/TCS/HAC; AEB, FCW, ACC, BSD, RCTA, TJA, LDW, LCA, IHC | SOC y asistencia eléctrica son modelos virtuales no homologados. |
| Suzuki Fronx | 102 HP naftero + ISG **3 HP de asistencia**, no sumar como 105 HP continuo | 137 Nm nafta / ISG 55 Nm | Mild Hybrid 12V FWD, AT6 | ABS/EBD, ESP, Hill Hold; sin ADAS | Mild Hybrid no funciona como vehículo eléctrico independiente. |
| Chery T2 Pro Max | **No declarada**: 105 HP estimados para simulación | **No declarado**: 140 Nm estimados para simulación | 1.5 atmosférico FWD, CVT18 | ABS/EBD, ESP/TCS, HAC/HDC; sin ADAS | Los 105 HP/140 Nm son únicamente calibraciones temporales del juego, NO especificaciones del fabricante. |
| Kia Carens EX (legado) | 115 HP | 250 Nm | 1.5 CRDi diésel FWD, AT6 | Equipamiento MY exacto pendiente | Se mantiene como séptimo auto para no perder trabajo anterior; no figura entre las seis nuevas capturas. |

## Motor físico V8.8

- Masa/carga, potencia, torque, caja, neumáticos, distancia entre ejes y tracción condicionan aceleración y dirección.
- El pedal responde progresivamente. Los motores con menor relación potencia/masa responden menos agresivamente al salir; NO se presenta como prueba oficial de 0–100 km/h.
- El turbo aplica retardo de respuesta solo cuando está expresamente declarado en la motorización.
- HEV autorrecargable: estado de carga virtual, asistencia eléctrica para la salida y recuperación de energía estimada durante frenada/retención. La potencia total se limita a la cifra combinada; no se suman torques de nafta + eléctrico.
- Mild Hybrid ISG 12V: una contribución breve y pequeña en salida, acotada por los 3 HP indicados. No se trata como un híbrido que circula solo con electricidad.
- ABS, ESC, TCS y AEB se integran al modelo simplificado únicamente si constan en la ficha de la versión. FCW y LDW se muestran como advertencias, no como actuadores.
- ACC, TJA, RCTA, BSD, LCA e IHC quedan registrados como equipamiento de ficha, **NO se simula su actuación OEM** en este prototipo. No existe cámara, radar o sensor real.
- Continúan dirección, choque, frenado, baches, suspensión, lomo de burro, lluvia, raudales, reversa y meta cinematográfica de versiones anteriores.

## Recursos gráficos y límites

- Modelos GLB propios: Toyota Corolla Cross y Chevrolet Tracker RS (la malla Tracker RS no reproduce exactamente la versión 1.2 Turbo de ficha).
- **NO se encontró un GLB propio de Kia Carens** en los archivos disponibles. Su vehículo 3D actual ya utiliza una malla temporal de Tracker RS. Para Fronx, Chery T2 Pro Max y Chery T4 Pro se usa **esa misma malla temporal utilizada por Carens**, con escala y física propias. No afirmar que su geometría es correcta.
- Nuevos autos con fotos de catálogo aportadas por el usuario. No se inventaron videos ni giros 360° para los tres modelos nuevos: el showroom muestra su foto hasta recibir un recurso real.
- Los sonidos de los tres modelos nuevos permanecen provisionales; no son grabaciones verificadas de sus motores.
- Los modelos de masa, Cx, velocidad máxima, 0–100, consumo y distancias de frenada que no aparezcan en la ficha siguen siendo calibraciones de simulador. Ver `estimatedFieldNames` de cada registro.
- Año-modelo de modelos sin año visible en la captura: usar provisionalmente 2026 para registro, verificar antes de publicaciones comerciales.

## Verificación

`npm run test:v88` ejecuta pruebas de 7 registros, diferencias HEV/mild/aspirado/turbo, frenado/ADAS, regresiones de V8.7 a V8.4.

**Pendiente:** ejecutar `npm install` y `npm run build` en el entorno del usuario y validar visualmente 3D, sonidos y FPS. No se certificó el empaquetado de Vite en este entorno por falta de dependencias locales.
