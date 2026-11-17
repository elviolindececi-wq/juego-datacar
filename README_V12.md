# DATACAR ARENA V12 — consolidación UI y simulación

Reemplaza el **código** de V11/V11.1/V11.2 en una sola operación. Mantiene los archivos grandes actuales en `public/` (GLB, MP4, fotogramas, audio, etc.). **No** instalar sobre V9.6: requiere que la carpeta de destino ya contenga los recursos de la versión publicada.

## Cambios
- Inicio mobile: «Los más buscados»; auto destacado con swipe/flechas, nombre, versión y acceso a 360/ficha.
- Comparación: el swipe cambia el auto en foco pero NO añade ni quita selecciones automáticamente; el botón de selección permite comparar dos modelos. Resultados y simulación 3D visibles.
- Visor 360°: video H.264 donde está disponible (Kicks, Carens, Corolla Cross y Tracker); modo de fotogramas accionable. Mensajes visibles cuando no hay video o falla.
- Garage y comparación mobile: acceso a video/visor y ficha completa del vehículo correcto.
- Carrera: precarga de modelos, grilla visible antes del botón START, pitidos y cuenta 3-2-1 separados por 1 segundo. El tiempo de preparación no se calcula como porcentaje del render WebGL; START solo se habilita cuando hay primer fotograma.
- Bache: si el vehículo permanece cerca de un bache a menos de 4 km/h durante unos seis segundos intentando moverse, se ofrece reiniciar o salir, tanto desktop como mobile.
- Transmisión y sonido: cajas escalonadas usan relaciones estimadas que permiten bajadas de RPM al cambiar; CVT continúa variando sin escalones. HUD y audio comparten RPM de la misma simulación. No son curvas homologadas.
- Meta en cámara lenta y acceso a resultados completos conservados de V11.

## Instalar y validar (PowerShell)

En la carpeta del repositorio, descomprimir con reemplazo, después:

```
npm install
npm run test:v12
npm run build
npm run dev
```

Luego validar en un Android y en un iPhone: elección de auto con swipe, video 360, comparación 3D, largada, multitouch, bache, caja CVT, caja escalonada, sonido y resultados. Verificar en Network del navegador que los MP4/GLB se entreguen con HTTP 200.

## Limitaciones
- Este paquete no crea videos nuevos para los tres vehículos que no tienen `video360Url` en el catálogo.
- Las 16 pruebas automáticas de flujo son estructurales; no reemplazan un test de navegador con WebGL/audio habilitados.
- La primera carga de GLB puede ser larga según el hardware y la red.
- El modo pantalla completa y landscape está sujeto a permisos y restricciones del navegador.
