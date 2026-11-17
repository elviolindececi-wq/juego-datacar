# DATACAR ARENA V8.9 — Auditoría de ingeniería física

## Dictamen

**V8.8 no era un simulador vehicular de máxima fidelidad.** Su dirección resolvía una velocidad de guiñada cinemática limitada por un agarre escalar, sin fuerzas independientes por ejes, sin transferencia longitudinal de carga dentro del cálculo de viraje y sin inercia de giro explícita. **V8.9 mejora considerablemente esta base**, pero continúa siendo un modelo *game-oriented* 2D+visual de suspensión, **no** un gemelo digital ni un modelo OEM certificado.

### Principios innegociables

1. **Potencia, torque, motor, transmisión, tracción, dimensiones y seguridad proceden de la ficha de la versión exacta**, si el dato está presente.
2. **No equivale torque eléctrico a torque combinado de un híbrido** ni se suman permanentemente potencia térmica y asistencia ISG de 12 V.
3. **ABS/TCS/ESC/AEB solo se atribuyen a versiones con evidencia.** `unknown` no significa ausente.
4. Datos no publicados (**masa, centro de gravedad, relaciones de caja, neumáticos ensayados, curvas de potencia/torque y 100–0**) se representan como **estimaciones**. No deben convertirse en afirmaciones comerciales sobre vehículos reales.
5. La comparación predeterminada sigue siendo una experiencia separada. Esta auditoría se aplica a la **física interactiva de Modo Carrera**.

## Mejoras implementadas en V8.9

| Subsistema | Antes V8.8 | V8.9 |
|---|---|---|
| Giro | Modelo cinemático de bicicleta con saturación escalar | Modelo dinámico de bicicleta con velocidad lateral, fuerzas en eje delantero y trasero y momento de guiñada |
| Neumáticos | Límite único de adherencia | Fuerza lateral no lineal saturada por eje; ángulos de deriva; elipse de fricción combinada longitudinal/lateral |
| Frenar mientras se gira | La fuerza lateral podía competir mal con el freno | Frenada/propulsión consumen parte del presupuesto de agarre por eje |
| Transferencia de peso | No actuaba en fuerza de los ejes | Aceleración/frenada desplazan la carga entre tren delantero y trasero; depende de masa, batalla y altura CG aproximada |
| Dimensiones del neumático | Radio efectivo | Radio + respuesta de dirección aproximada según ancho y perfil (NO datos de ensayo) |
| Inercia de giro | Seguimiento al objetivo de yaw | Momento de guiñada / inercia de yaw calculada desde fuerzas de los ejes |
| Marcha atrás | Cinemática básica | Integración con rama cinemática estable a baja velocidad y reversa |
| Híbrido HEV | La asistencia eléctrica quedaba excesivamente limitada por el torque térmico | Camino de empuje eléctrico separado por fuerza en el eje, limitado por potencia combinada, SOC estimado y agarre; NO sumar Nm en ficha |
| Suspensión visual | Reacción a irregularidades del pavimento | Agrega cabeceo por aceleración/frenado y balanceo por aceleración lateral, filtrados |
| Colisión vehículo–vehículo | Cuerpos aproximados con separación simétrica | Separación proporcional a masas; dimensiones de cápsula adaptadas al largo/ancho del auto (sigue sin ser un rigid body completo) |
| Telemetría | Velocidad/ángulo/ABS/impactos | Aceleración lateral en G, utilización de adherencia, ángulo de deriva y carga normal de cada eje |
| CVT | Reducción efectiva inicialmente conservadora (7,2, estimada) | Reducción equivalente de salida recalibrada a 9,2 **estimada**, sin cambiar HP/Nm de la ficha |

### Modelo dinámico

- **100 Hz** de física: `dt = 0,01 s`, con render interpolado entre pasos.
- Eje +Z hacia adelante; eje +X hacia la izquierda del vehículo.
- `Fz delantera = m*g*b/L - m*ax*h/L`; `Fz trasera = mg-Fz delantera`, con `a` y `b` distancias estimadas al CG.
- Ángulos de deriva delantera y trasera calculados usando velocidad lateral, velocidad longitudinal y yaw rate.
- `Fy = Fy_max * tanh(C_alpha * ángulo_de_control / Fy_max)`; el límite `Fy_max` disminuye al destinar agarre a frenar o propulsar.
- `Izz * yawAcceleration = a*Fy_front*cos(steer) - b*Fy_rear`.
- `lateralAccel = (Fy_front*cos(steer)+Fy_rear)/m`.
- A menos de aproximadamente 2–6 m/s se mezcla progresivamente con dirección cinemática para evitar inestabilidad numérica.
- **No es Pacejka calibrado.** No hay coeficientes reales de Michelin, Bridgestone, Dunlop, etc. No se puede identificar una Magic Formula válida a partir de una ficha comercial.

## Vehículos y calidad de las fichas

| Versión | HP / Nm de ficha | Aspectos sólidos de ficha | Datos modelados sin ensayo OEM |
|---|---|---|---|
| Tracker 1.2 Turbo AT | 139 CV ≈137,1 HP / 220 Nm | Turbo, AT6, FWD, seguridad de ficha aportada | Masa, curva de torque, reducciones, grip, suspensión |
| Corolla Cross SEG 2027 | 171 HP / 203 Nm | 2.0, CVT, FWD, ABS/EBD, VSC/TRC/HAC, ruedas 215/60 R17 | Masa, CVT efectiva, curva de par, neumáticos y frenadas |
| Nissan Kicks 1.2 6DCT | 120 HP / 220 Nm | 6DCT, FWD, equipamiento de ficha aportada | Masa, aceleración, ratios reales, grip |
| Chery T4 Pro Luxury HEV | 195 HP **combinados**; térmico 125 Nm / eléctrico 310 Nm | HEV DHT, batería 1,86 kWh, ADAS | Curva de potencia en función de SOC, gestión térmica, mezcla de par, transmisión |
| Suzuki Fronx Mild Hybrid | 102 HP térmicos + ISG 3 HP breves; 137 Nm térmicos | MHEV 12 V AT6, ABS/ESP, sin ADAS | Gestión ISG, masa, ratio, curvas de motor |
| Chery T2 Pro Max | **HP/Nm no informados en captura** | 1.5 atmosférico, CVT, FWD, equipamiento de ficha | **105 HP / 140 Nm SOLO PARA JUEGO**, más el resto de parámetros; no usar en comparaciones comerciales |
| Kia Carens legado | 115 HP / 250 Nm según registro previo | CRDi turbodiésel, AT6, FWD | La versión/año exactos requieren validar equipamiento y desempeño |

**Precaución:** la ficha aporta neumáticos y dimensiones para parte del catálogo, pero el Cx, el centro de gravedad, masa en orden de marcha, mapa de torque vs RPM y coeficiente de fricción bajo lluvia pueden no estar publicados. Son variables esenciales para un simulador validado.

## Prueba cuantitativa interna (NO prestaciones reales)

Prueba virtual de control: recta plana, asfalto seco, un vehículo, carga adicional 0 kg, sin obstáculos, 100 Hz, acelerador a fondo. Valores de salida V8.9, **no oficiales**:

| Auto | 0–100 km/h simulado (s) | 100–0 km/h virtual (m) |
|---|---:|---:|
| Nissan Kicks 1.2 DCT | 8,71 | 38,3 |
| Kia Carens EX legado | 11,42 | 37,9 |
| Toyota Corolla Cross SEG | 9,51 | 39,0 |
| Chevrolet Tracker 1.2 Turbo | 9,57 | 39,6 |
| Chery T4 Pro HEV | 6,65 | 39,8 |
| Suzuki Fronx MHEV | 11,48 | 40,5 |
| Chery T2 Pro Max **provisional** | 12,88 | 40,8 |

Estas cifras dependen de calibraciones estimadas; **no** sirven para decidir cuál vehículo real es más rápido o frena mejor. En particular, T2, Carens y la dinámica de batería del T4 requieren datos adicionales. El simulador no puede afirmar diferencias de décimas de segundo como reales.

## Pruebas automatizadas

Comando: `npm run test:v89`

- Fuerza lateral y signo de giro a izquierda/derecha.
- Frenada aumenta carga normal delantera; aceleración aumenta la trasera.
- Fricción limitada en mojado y elipse de fricción al frenar y girar.
- Marcha atrás invierte el sentido cinemático de dirección.
- Mayor masa reduce la aceleración con el mismo motor.
- HEV y MHEV mantienen comportamientos distintos y límites de potencia.
- Determinismo con paso fijo, siete registros, límites de velocidad del simulador.
- Estrés de 3 autos / 35 s con inundación, barreras, conducción variable y colisiones: sin NaN/infinito ni salida de la calle.
- Pruebas anteriores V8.8 → V8.4 conservadas.

## Lo que todavía NO está resuelto con fidelidad de simulador profesional

1. **Neumáticos completos por rueda:** no hay deslizamiento longitudinal individual, temperatura, desgaste, presión, deformación de carcasa ni parámetros Pacejka medidos.
2. **Dinámica 3D 6-DOF:** cabeceo/rolido de carrocería son aproximaciones, no un multicuerpo completo; no hay centro instantáneo de suspensión ni barras estabilizadoras según geometría OEM.
3. **Transmisión:** no hay relaciones de marcha/final drive, mapa de eficiencia, curvas de cambio DCT/AT ni gestión real de CVT publicadas.
4. **ABS/ESC/AEB:** reproducen principios generales, no algoritmos ni sensores originales del fabricante. No representan ensayos homologados de seguridad.
5. **Colisiones:** se usan cápsulas aproximadas en el plano, no rigid bodies 3D con múltiples contactos, choque con giro y deformación.
6. **Hidroplaneo:** pérdida de agarre e impulso lateral empíricos; no hay flujo hidrodinámico real de neumático/capa de agua.
7. **Trazado:** las vías siguen esencialmente rectas con intersecciones visuales; una red real de calles requiere splines, geometría vial navegable y colisiones con bordillos.
8. **GPU:** algunos GLB exceden 1 millón de triángulos; los FPS pueden limitar la sensación de realismo pese a 100 Hz de física.

## Siguiente escalón técnico para máxima fidelidad

Un **motor rígido 3D** (Rapier o PhysX Vehicle cuando el entorno lo permita), cuatro raycasts/suspensiones físicos independientes, curva de fuerza longitudinal/lateral con coeficientes de neumáticos medidos, caja/transmisión por relaciones, validación contra datos de aceleración/frenado de **cada versión exacta**, y pruebas reproducibles de maniobras. El sistema debe conservar el vínculo a la ficha y separar evidencia de calibración.

Referencias metodológicas: CommonRoad (Dynamic Bicycle Model), NVIDIA Omniverse PhysX Vehicles y SAE/estudios de identificación de parámetros de neumáticos. Estos trabajos orientan la arquitectura, pero no aportan coeficientes específicos de los siete vehículos.
