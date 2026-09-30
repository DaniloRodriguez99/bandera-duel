# Validación Android y animaciones

Fecha: 29 de septiembre de 2026.

## Verificado

- TypeScript del cliente y compilación Vite correctos; el servidor se compiló para
  las pruebas de integración y navegador.
- Suite Vitest: **36 archivos, 480 pruebas aprobadas**. Incluye seis pruebas nuevas
  de conexiones, invitaciones, direcciones, reposo, desplazamiento, inmovilización,
  teletransportes y generación de poses de todas las apariencias.
- Navegador: **10 pruebas aprobadas** entre `classes`, `practice`, `world-keyboard`
  y `mobile-visuals`. Cubren combate, selección de clases, controles con varios
  dedos, mundo, práctica, preferencias visuales y configuración nativa simulada.
- Revisión visual de las cinco clases, apariencias por arma y todas las skins en
  ocho direcciones, y pantalla de práctica a 844 × 390. Capturas de revisión en
  `test-results/mobile-visuals-*` (archivos temporales, no versionados).
- APK debug compilada, firmada con clave de pruebas e instalada mediante ADB.
- En la APK sobre emulador Android: arranque desde `https://localhost`, comprobación de
  `/health`, guardado de servidor HTTP de desarrollo y creación de sala con código.
- Partida compartida entre APK y Chromium de escritorio: ambos jugadores entraron,
  marcaron listo y comenzó la partida.
- Botón Atrás del sistema cerró el diálogo de ajustes. Tras enviar la app al inicio
  de Android y volver, el cliente mostró conexión activa.

## Entorno y medición

Emulador headless x86_64, imagen Android 37.2 beta3 instalada en este equipo,
2 núcleos virtuales, 2 GB de RAM y renderizado SwiftShader. No representa el
rendimiento de un teléfono ni es una certificación de Android estable.

Muestra de aproximadamente seis segundos en práctica: 172 intervalos de
`requestAnimationFrame`, promedio **34,86 ms** (aproximadamente **28,7 FPS**) y
percentil 95 **66,6 ms**. Es una medición breve del ciclo visual en emulación por
software, no una medición térmica ni una prueba de combate exigente. No se afirma
que el objetivo de 60 FPS esté alcanzado.

La conexión del emulador usó `adb reverse tcp:2569 tcp:2569` y un servidor aislado
en el puerto 2569, permitiendo `https://localhost`. No se probó una Wi-Fi física.

## Pendiente en dispositivos físicos

- Instalar en teléfonos Android estables de gama baja y media, con WebView actualizado.
- Medir partidas de 10–15 minutos, oleadas densas, memoria, batería y temperatura.
- Verificar recortes de pantalla, teclado del chat y multitáctil sobre hardware.
- Probar cambios Wi-Fi/datos móviles, pérdida de conexión mayor a la reserva de
  reconexión y cierre del proceso por el sistema.
- Firmar y comprobar el AAB con la clave del propietario antes de publicarlo.

No se generó una firma de producción ni se publicó en Google Play.

## Actualización: golpe de escudo y corte de proyectiles

- El golpe de escudo se verificó con 2 s de aturdimiento y con la guardia rival activa.
- Los ataques normales de espada del caballero y el guerrero cortan flechas, hechizos,
  tajos viajeros y proyectiles de criaturas del mundo y Hordas antes de sus impactos.
  Las pruebas incluyen arco frontal, diagonal, alcance, hostilidad, varios proyectiles,
  ausencia de daño, congelación y explosión, y prioridad frente al contraataque.
- TypeScript compartido, servidor y cliente correctos. Suite Vitest: **37 archivos,
  489 pruebas aprobadas**.
- Pruebas de navegador de combate: **13 casos aprobados** entre habilidades, clases,
  arquero, duelo y fragmentos. Dos casos fallaron de forma intermitente en la primera
  corrida mientras se compilaba Android; ambos pasaron al repetirse aislados.
- APK de desarrollo recompilada (versión previa al indicador de aturdimiento):
  `artifacts/bandera-duel-debug.apk`.
  SHA-256: `1A281A78ADAFA8AB2BAC75C2F3EAACDDC897A69917AA0B2A52E3CBA563D60133`.
  No había emulador ni teléfono conectado para reinstalar esta versión actualizada.

## Actualización: indicador de aturdimiento

- La insignia `✦ ATURDIDO ✦` se ve sobre el nombre mientras `stunLeft > 0`, sigue
  al personaje y se oculta al recuperarse o morir. Con reducción de movimiento
  queda fija.
- TypeScript y compilación web correctos; prueba de navegador del indicador aprobada
  con captura visual revisada.
- APK de desarrollo actual: `artifacts/bandera-duel-debug.apk`.
  SHA-256: `322801BE94E63AD3C721AE6078ECBCD7304FAC43437340381E563B066E56C9CA`.
  Sin emulador ni teléfono conectado para instalar esta versión.
