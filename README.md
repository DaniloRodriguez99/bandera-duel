# Bandera Duel

Juego web de captura de bandera **1v1**, con espada, arco, magia y dash. Partidas de tres minutos, salas privadas por link, controles para PC y celular y servidor autoritativo. Primera versión: un mapa, dos equipos de un jugador, sin cuentas ni base de datos.

## Requisitos e inicio

- **Node.js 24 LTS** y npm 11 o posterior. El Node 20.9 instalado originalmente en este equipo debe actualizarse o sustituirse con un gestor de versiones.
- Git, si querés versionar y publicar el repositorio.

```powershell
cd C:\Proyectos\GIT-REPOSITORIO\bandera-duel
npm ci
npm run dev
```

Abrí http://localhost:5173. Creá una sala, copiá el link y abrilo en **otro navegador o dispositivo**. Ambos deben marcar «Estoy listo». Las sesiones se guardan en `sessionStorage`: las pestañas duplicadas pueden heredar la sesión; para pruebas independientes usá otro contexto de navegador.

`npm run dev` compila primero el paquete compartido y deja activos sus cambios, el servidor en **2567** y Vite en **5173**. El proceso se detiene con Ctrl+C.

### Jugar desde el celular en la misma Wi-Fi

1. Iniciá el proyecto en la PC y consultá su IPv4 con `ipconfig`.
2. Abrí `http://IP-DE-LA-PC:5173` **también en la PC** para que el link compartido tenga una dirección accesible desde el teléfono.
3. Abrí ese link en el celular y giralo horizontalmente.
4. Si Windows solicita acceso de Node a la red, permití la red privada. No hace falta abrir puertos del router. Ambos puertos deben ser accesibles dentro de la LAN.

El cliente deduce el servidor desde el hostname de la página si `VITE_SERVER_URL` está sin definir. No configures `localhost` como servidor cuando vayas a compartir con otro dispositivo. Las redes privadas `192.168.*` y `10.*` están admitidas en desarrollo; para otra subred agregá su origen exacto a `ALLOWED_ORIGINS` en `.env`.

## Controles y reglas

La banda sonora es original y sintetizada: melodía medieval en el menú, ritmo de aventura durante el duelo, más intensidad en los últimos 30 segundos y un cierre musical al terminar. Comienza tras la primera interacción y se pausa al ocultar la pestaña. El control «Música» ajusta su volumen sin cambiar los efectos; el botón de sonido silencia todo. Ambas preferencias se guardan en el navegador.

| Acción  | PC             | Celular horizontal               |
| ------- | -------------- | -------------------------------- |
| Mover   | WASD o flechas | Palanca izquierda                |
| Apuntar | Mouse          | Palanca derecha                  |
| Espada  | Clic izquierdo | Botón ⚔                         |
| Distancia | Clic izquierdo | Apuntar y soltar palanca derecha |
| Golpe secundario | Clic derecho | Botón de daga o báculo |
| Dash    | Espacio        | Botón ➟                          |

El arquero dispara flechas y usa una daga; el mago lanza hechizos y golpea con el báculo. Ambos pueden usar dash. La espada usa la última dirección apuntada. El dash usa el movimiento actual o el apuntado si estás quieto. El botón de sonido está en la cabecera; su elección se conserva en el dispositivo. El audio comienza después de una interacción del usuario.

- Robá la bandera enemiga al tocarla y volvé al círculo de tu base. **Tu bandera debe estar en casa para anotar.**
- Llevarla reduce 15 % la velocidad normal; permite atacar y hacer dash.
- Recibir daño suelta la bandera. Quien la soltó no puede recogerla durante 0,7 s.
- Tocar tu bandera caída la devuelve inmediatamente; abandonada vuelve a los 10 s.
- El arquero, el mago y el caballero tienen tres puntos de vida; el guerrero tiene cinco. Espada, flecha y hechizo hacen daño según su clase.
- Reaparición a los 3 s, con 1 s de protección, cancelada al atacar o recoger bandera.
- Cada captura reinicia la arena y pausa el reloj 2 s. Tres capturas ganan; a los 3 minutos gana el mayor marcador, o se declara empate.
- Ambos deben aceptar la revancha. Una desconexión pausa y reserva el asiento 15 s; si no vuelve, pierde por abandono. Salir expresamente abandona inmediatamente.

## Organización y red

- `packages/shared`: mapa, geometría, tipos, constantes `RULES`, movimiento determinista y clase `Duel`. Es la única fuente de reglas.
- `packages/server`: Colyseus, salas privadas de identificador aleatorio de 128 bits, validación de apodos, entradas y orígenes, reconexión y endpoint `GET /health`.
- `packages/client`: Phaser 3, menús HTML/CSS, pixel art original generado desde matrices, efectos y sonidos sintetizados con Web Audio.

El servidor simula a **30 Hz** y emite snapshots a **15 Hz**. Usa mensajes explícitos de Colyseus para sincronizar el pequeño estado completo del duelo, sin Schema ni almacenamiento. Cada cliente tiene una cola limitada: se procesa como máximo una entrada por tick; el tiempo y las coordenadas del cliente no gobiernan la simulación. Entradas antiguas, no finitas o fuera de rango se rechazan. Tras 250 ms sin inputs se detiene el movimiento residual.

Mensajes cliente → servidor: `input` (`seq`, `x`, `y`, `angle`, `sword`, `shot`, `dash`), `ready`, `sync` y `ping`. Mensajes servidor → cliente: `snapshot` y `pong`. `Snapshot`, `Input`, `Player`, `Flag` y las reglas son tipos exportados por el paquete compartido.

El navegador predice su movimiento y lo reconcilia con el último `ack`; interpola al rival y suaviza las flechas. Golpes, vida y capturas siempre se resuelven en el servidor. Esta v1 no incorpora rollback ni compensación histórica de impactos: una latencia alta todavía afecta al combate.

El mapa y las banderas pertenecen a equipos, no a un jugador fijo. Ampliar a 2v2 requerirá aumentar cupos, asignaciones, apariciones, interfaz y pruebas; no basta con cambiar `maxClients`.

## Verificación

```powershell
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` cubre reglas e integración con dos clientes Colyseus reales, incluyendo 150 ms de latencia simulada, reconexión y expiración de los 15 s de reserva. Usa el puerto **2568**.

`npm run test:browser` requiere el servidor compilado (`npm run build`) y levanta servidor y Vite si no están activos. Usa Chromium y verifica tres capturas por teclado, resultado en dos navegadores, revancha, recarga con reconexión, errores de sala y multitouch móvil mediante CDP. Capturas y trazas quedan en `test-results/` y no se versionan.

Para experimentar manualmente con latencia, copiá `.env.example` como `.env`, activá `COLYSEUS_LATENCY=150` y reiniciá `npm run dev`. El valor representa latencia total de ida y vuelta. No se expone ningún endpoint de depuración o modificación del juego en producción.

## Desplegar gratis para pruebas

El proyecto está preparado para desplegar, **no publicado**. No necesita claves de Firebase ni servicios de pago. Subí este repositorio a tu proveedor Git cuando quieras conectarlo a los hostings.

### Render: servidor

Creá un Web Service Node en plan **Free** desde la raíz del repo, o usá `render.yaml`:

- Build: `npm ci --include=dev && npm run build:server`
- Start: `npm start`
- Health check: `/health`
- Node: `24`; `NODE_ENV=production`.
- `ALLOWED_ORIGINS`: origen exacto de tu web, por ejemplo `https://bandera-duel.vercel.app`, sin barra final. Varios orígenes se separan por comas. No uses `*`.
- Render suministra `PORT`. Elegí una región cercana a tus jugadores al crear el servicio.

### Vercel: cliente

Importá la raíz del repo, seleccioná Node 24 y dejá que `vercel.json` establezca compilación y salida:

- Build: `npm run build:client`
- Output: `packages/client/dist`
- Variable `VITE_SERVER_URL=wss://TU-SERVIDOR.onrender.com`.

La dirección del servidor se incorpora **durante la compilación**: cambiarla requiere redeploy del cliente. Agregá el dominio final de Vercel a `ALLOWED_ORIGINS` en Render. Los previews con otros dominios requieren permitir sus orígenes explícitamente.

Después de publicar, comprobá `/health`, una invitación entre PC y móvil, una captura y una reconexión. El cliente muestra «Preparando servidor…» durante el arranque; la espera máxima es de unos 85 s antes de ofrecer reintentar.

### Límites de esta primera versión

- Render Free se duerme tras 15 minutos sin tráfico, puede tardar alrededor de un minuto en despertar y puede reiniciarse. Las salas viven en memoria y se pierden al reiniciar. También aplica cuotas de uso y transferencia: gratis no significa ilimitado. Si querés evitar cobros por excedentes, revisá la configuración de pago y límites de la cuenta. [Render Free](https://render.com/docs/free).
- Vercel Hobby está orientado a uso personal no comercial. [Condiciones del plan](https://vercel.com/docs/plans/hobby).
- No hay cuentas, estadísticas persistentes, ranking, bots, espectadores, chat ni matchmaking público. La protección inicial valida el juego y limita mensajes por conexión; no sustituye controles de abuso a escala pública.
- El arte y sonido del juego son originales. Las tipografías Barlow Condensed y DM Sans se cargan desde Google Fonts, con fuentes locales de respaldo si ese servicio no está disponible.
- Las pruebas de móvil son emuladas en Chromium. No se verificó un teléfono físico ni Safari/iOS; esa comprobación queda pendiente antes de considerar un lanzamiento público.

## Estado de entrega

Ver `VALIDATION.md` para los resultados comprobados y las limitaciones de validación. El repositorio se entrega inicializado, sin remoto ni publicación. Las dependencias quedan fijadas en `package-lock.json`.
