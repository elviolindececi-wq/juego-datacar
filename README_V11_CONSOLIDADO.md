# DATACAR ARENA V11.0 — Mobile integral consolidado

## Alcance

El paquete reemplaza **el código del proyecto** de una vez, sin rehacer ni descargar los modelos y videos pesados de `public/`. La versión se ha ensamblado desde la versión completa V9.6 más los cambios V9.7/V9.8/V9.9/V10 y el rediseño V11. Conserva la experiencia desktop, el motor de física, los circuitos, las fichas y los assets existentes.

### Experiencia mobile

- Pantalla horizontal con intento de fullscreen a partir del gesto del usuario; algunos navegadores requieren giro manual.
- Carruseles por swipe para automóviles y circuitos.
- Showroom 360° arrastrable y video 360° cuando existe el recurso; los autos sin ese recurso usan imágenes. El material 360° es multimedia, no necesariamente un modelo 3D navegable.
- Fichas extensas con información del catálogo, estado de evidencia y advertencias sobre datos estimados.
- Pantalla de carga de imágenes al iniciar y progreso de carga de los GLB antes de la carrera. El 100% del preloading de GLB no garantiza inmediatamente 100% de GPU/escena: la pantalla START espera además el primer render de WebGL.
- START obligatorio después de precarga; tres tonos y GO a continuación.
- Velocímetro de alto contraste, tamaño mobile; el botón `DATOS +` muestra tacómetro, marcha, aceleración, asistentes documentados.
- Cámara lenta visual de ~4 segundos al cruzar la meta, sin alterar trayectoria física ni clasificación.
- Resultados completos consultables desde `TODOS LOS DATOS`: tiempos, velocidad, parciales, consumo, potencia/peso, gráficas de telemetría y Driving IQ.
- Controles táctiles separados de la telemetría para evitar superposiciones.
- Imágenes 360° cargadas solo al abrir el visor; se ha eliminado la precarga global de 360 frames.

### Limitaciones

- Los modelos GLB existentes son de aproximadamente 22–38 MB y la descarga inicial sigue dependiendo de la red del usuario. La carga previa a la carrera prioriza consistencia, no reduce el tamaño de los GLB.
- No ha sido posible ejecutar `npm install` y `npm run build` en el entorno de preparación. Sí se validó la sintaxis de los 64 archivos TS/TSX y un test de coherencia de archivos y recursos.
- Los navegadores no siempre permiten bloquear orientación ni fullscreen programáticamente; se solicita el gesto del usuario y se ofrece orientación manual.
- No se ha comprobado todavía el funcionamiento gráfico final en Android/iOS real.

## Instalación sobre el repositorio ya publicado

1. Hacé una copia de seguridad de tu proyecto antes de reemplazar archivos.
2. Extraé este paquete en la **raíz del repositorio existente** `juego-datacar-v97`, usando reemplazar. No borres la carpeta `public` que ya contiene los videos/GLB.
3. En PowerShell dentro de esa carpeta ejecutá:

```powershell
npm install
npm run test:v11
npm run build
npm run dev
```

4. Probar en un teléfono en horizontal: Home > Circuitos > Garage > 360° > Ficha > Briefing > Carga > START > Cuenta regresiva > Carrera > Meta > Resultados > DATOS.
5. Publicar solo si pasa `npm run build` y la prueba mobile:

```powershell
git add .
git commit -m "DATACAR ARENA V11.0 - mobile integral consolidado"
git push origin main
```

No reemplazar ni borrar datos, audio, videos ni modelos de `public/`.
