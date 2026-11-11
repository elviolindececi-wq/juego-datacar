# DATACAR ARENA V13 — Estabilización, entrega consolidada de código

Basado **directamente** en `DATACAR_AUDITORIA_CODIGO.zip` del usuario, versión local V12.7. No incluye recursos `public` (GLB, imágenes, videos ni audios): **no borrar la carpeta public existente** al instalar.

## Cambios
1. Tanto desktop como mobile esperan primer frame Three.js y **todos los modelos instanciados** antes de 3-2-1 (no basta con descargar el GLB). Un fallo de carga impide largar y muestra reintento.
2. Contador de GLB por sesión, protección ante callbacks tardíos de escena desmontada.
3. Bloqueo de atasco usa tiempo real transcurrido por actualización de HUD, no +0.18 s fijo.
4. Se elimina totalmente el código de ovación de llegada, además de sus llamadas anteriores.
5. Visor 360 exclusivamente manual: en vez de iniciar 120 descargas al abrir un vehículo, solicita el ángulo y ±2 vecinos. Caché de hasta 3 vehículos.
6. Versionado a 13.0.0, pruebas V11/V12 actualizadas y nuevas pruebas V13.

## Validación
- `npm run test:v13`
- `npm run lint`
- `npm run build`
- Probar en navegador con assets `public` reales; comprobar secuencia antes de sonido, cambio de cámaras, atasco/reinicio, llegada silenciosa y visor 360.

## Instalación local (PowerShell)
Desde la carpeta del proyecto, descomprimir ZIP con `Expand-Archive -LiteralPath <ZIP> -DestinationPath (Get-Location).Path -Force`; conservar `public` existente. Antes conviene realizar respaldo y tener Git limpio. El ZIP contiene código consolidado y documentación, sin `node_modules`, `dist` ni `.git`.

## Pendientes explícitos / límites
- Sin `public` original no se puede validar GLB, texturas, fotogramas ni FPS.
- Falta comprobar TypeScript/Vite con `npm ci` en Windows; en el entorno de auditoría no se resolvieron dependencias offline.
- Esta versión comienza la estabilización, pero **no** reescribe el gran componente 3D ni garantiza todos los escenarios de navegador. Próximo trabajo: desacoplar cámara/inputs y E2E web.
