# DATACAR ARENA V8.7 — auditoría de datos y seguridad por versión

Fecha de revisión: 10 de noviembre de 2026.
Regla editorial: no confundir datos de una familia de modelos con la ficha exacta de un año, motorización y versión.
`unknown` significa **pendiente de verificación**, NO que el vehículo real no tenga el sistema.

| Vehículo dentro del juego | Datos técnicos usados | Seguridad habilitada en la física | Evidencia / pendiente |
|---|---|---|---|
| Toyota Corolla Cross SEG 2027 naftera 2.0 | 171 HP, 203 Nm, 215/60R17, FWD, dimensiones recibidas | ABS/EBD, VSC y TRC; HAC con retención temporal en pendiente | Ficha SEG 2027 adjuntada por el usuario, indica SIN ADAS; peso 1.420 kg y prestaciones de pista **estimados**. No trasladar Toyota Safety Sense de una Corolla Cross HEV a la SEG naftera. |
| Chevrolet Tracker Lite 1.0T AT **MY24 en el juego** | 115 HP, 180 Nm, 6AT; peso y agarre cargados sin cotejo del MY24 | Ninguno nuevo activado por suposición | Fabricante publica ABS/EBD, ESC y TCS en **Lite MY26**, pero falta confirmar la ficha MY24 exacta. Documento: https://www.chevrolet.com.py/content/dam/chevrolet/south-america/paraguay/espanol/index/visid/suvs/2026-tracker/pdfs/ft-tracker-my26-py.pdf |
| Kia Carens EX AT Full **MY24 en el juego** | 1.5 CRDi VGT, 250 Nm, 6AT (fuente anterior indica 113 HP, juego conserva 115) | Pendiente de validación para MY24 | Brochure oficial de Kia Paraguay 08/2022 incluye ABS para EX AT Full, pero no documenta MY24 exacto; PDF: https://kia.com.py/images/ficha_tecnica/ficha_tecnica_carens.pdf |
| Nissan Kicks Sense **MY27 en el juego** | Registro viejo 1.6 CVT, 118 HP, 149 Nm: **NO COINCIDE sin cotejo** con la nueva Sense DCT | ADAS y ABS pendientes; no se atribuye ProPILOT/FCW/AEB automáticamente | Catálogo DATACAR https://www.datacarpy.com/catalogo/nissan/all-new-kicks y Nissan Paraguay https://www.nissan.com.py/vehiculo/todos-los-vehiculos/kicks.html publican generación All-New/Sense DCT. Reemplazar registro sólo con ficha técnica exacta del auto representado. |

## Cómo se comporta la V8.7
- Peso en vacío + carga ⇒ masa en ecuación F = m a.
- Potencia, torque y régimen de transmisión (CVT/AT/DCT) ⇒ límites de fuerza motriz. La relación efectiva de caja es una aproximación; no se inventan relaciones OEM.
- Batalla, dimensiones y masa ⇒ ángulo máximo de dirección y velocidad de respuesta del volante; disminuye con velocidad.
- Tracción y adherencia ⇒ límite de aceleración; clima, baches y superficies se siguen calculando.
- ABS, ESC, TCS, AEB ⇒ sólo si `equipment.safetySystems.<feature> === 'present'`. `absent` exige evidencia de no equipamiento; `unknown` deja el sistema pendiente. Ninguna asistencia queda simulada como piloto automático.
- Se mantiene el modo comparar y los resultados existentes, el nuevo motor afecta la carrera interactiva.

## Agregar vehículos sin modificar la física
1. Obtener ficha oficial exacta (país, año, versión, potencia, torque, masa, neumáticos, transmisión, tracción y seguridad).
2. Crear un objeto `Vehicle` y sus recursos 3D / showroom en `src/data/presetVehicles.ts`.
3. Incorporar `equipment.safetySystems` con valores `present`/`absent`/`unknown`, y `specEvidence` con etiqueta y URL de fuente.
4. Validar con `validateNewVehicle` y `registerVehicleInCatalog` en `src/data/vehicleCatalog.ts`. No usar `unknown` como ausencia.
5. Ejecutar `npm run test:v87`, luego `npm run build` y probar en Chrome.

Limitaciones: simulación jugable simplificada sin curvas de dinamómetro ni ensayos de neumáticos; no sustituye una homologación de seguridad, ni garantía de equipamiento comercial.
