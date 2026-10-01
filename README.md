# Bandera Duel

Android: instalación de la APK, servidor configurable y compilación en [MOBILE.md](MOBILE.md).

[Registro de cambios](CHANGELOG.md).

Juego web y Android de **Captura la bandera o Deathmatch** para duelos 1v1, equipos 2v2 o todos contra todos de 3–4 jugadores, con espada, arco, magia y dash. Salas públicas o privadas, cuatro mapas, controles para PC y celular y servidor autoritativo. No requiere cuentas ni base de datos para las salas PvP.

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

El mago también lanza un proyectil de hielo con Q o el botón táctil ❄. Inmoviliza al objetivo durante 1 segundo, sin daño adicional, y tiene 0,5 segundos de recarga independiente del fuego. Bloquea caminar y dash, pero permite apuntar y atacar. Los escudos y la invulnerabilidad bloquean el efecto.

La banda sonora es original y sintetizada: melodía medieval en el menú, ritmo de aventura durante el duelo, más intensidad en los últimos 30 segundos y un cierre musical al terminar. Comienza tras la primera interacción y se pausa al ocultar la pestaña. El control «Música» ajusta su volumen sin cambiar los efectos; el botón de sonido silencia todo. Ambas preferencias se guardan en el navegador.

Todas las clases hablan el mismo lenguaje de controles: cambia el personaje, no las teclas.

| Tecla          | Para qué                     | Arquero       | Mago          | Nigromante          | Caballero        | Guerrero       |
| -------------- | ---------------------------- | ------------- | ------------- | ------------------- | ---------------- | -------------- |
| WASD / flechas | Mover                        | ·             | ·             | ·                   | ·                | ·              |
| Mouse          | Apuntar                      | ·             | ·             | ·                   | ·                | ·              |
| Clic izquierdo | Ataque básico                | Flecha        | Orbe de fuego | Vínculo de Sangre   | Tres Cortes      | Mandoble del Titán |
| Clic derecho   | Secundario                   | Daga          | —             | Marcar (un zombie)  | —                | —              |
| Espacio        | Movilidad                    | Esquivar      | Parpadeo      | —                   | Paso Relámpago   | Embestida Sísmica |
| Q              | Básica, de uso frecuente     | Triple        | Saeta glacial | —                   | Ráfaga de Acero  | Creciente Escarlata |
| E              | Secundaria                   | Cepo          | Égida         | Mando               | —                | Parry          |
| F              | Poderosa                     | —             | Singularidad  | Invocar zombies     | —                | —              |
| R              | Definitiva                   | —             | —             | —                   | Despertar        | Cuerpo de Titán |

Tocar una tecla usa las habilidades instantáneas; mantenerla carga las que se cargan (la flecha, el orbe, Parpadeo, Singularidad, la invocación) y soltarla las lanza. Las habilidades se combinan: por ejemplo, el mago puede caminar, parpadear con Espacio y seguir cargando Singularidad con F. Cada una declara qué deja ocupado mientras carga: Singularidad deja las manos ocupadas para los clics, pero no para Q, E ni Espacio. El panel de habilidades muestra siempre las siete posiciones (las vacías, con «—») y, debajo de la arena, cómo se usa cada una con tus teclas. Los controles se pueden reasignar en Personalizar.

En celular: palanca izquierda para moverse; tocar el lado derecho libre hace aparecer una palanca de puntería bajo el pulgar; cada habilidad tiene su botón con ícono, carga y recarga, y arrastrarlo también apunta.

En el celular y la tableta, la partida se juega en horizontal y a pantalla completa, sin las barras del navegador: se activa sola al entrar (donde el navegador lo permite), la arena se ve entera y sin deformarse en cualquier proporción de pantalla, y botones y marcadores esquivan el notch y los bordes. En vertical, la arena pide girar el teléfono. En iPhone, Safari no deja a una página ocupar toda la pantalla: agregado a la pantalla de inicio, el juego se abre sin barras.

En plena pelea el cuerpo mira hacia donde se apunta, aunque camine para otro lado: se puede correr en una dirección y atacar en la otra. Cuenta como pelear golpear, cargar, preparar un golpe, recién disparar, tener la guardia arriba o, en tu personaje, mantener una tecla para apuntar una habilidad; un momento después del último golpe vuelve a mirar hacia donde camina. Vale para todas las clases.

La puntería es una sola para todas las habilidades, venga del mouse, de la palanca derecha, de arrastrar un botón o de las flechas en Lugunica. En PC sigue al cursor en todo momento, también mientras el personaje camina sin mover el mouse. En celular, soltar la palanca conserva la última dirección; moverse nunca la cambia. Tocar y soltar un botón usa esa dirección. Arrastrarlo permite apuntar como con una pequeña palanca; si el dedo vuelve al centro después de haber arrastrado, soltar cancela sin gastar la habilidad. Movimiento, carga y defensa admiten varios dedos simultáneos. La arena usa todo el viewport horizontal y, cuando su proporción no permite ver el mapa completo, la cámara sigue al jugador y muestra indicadores para las banderas fuera de pantalla.

El arquero dispara flechas y usa una daga. El mago lanza bolas de fuego con clic izquierdo y comienza con un escudo mágico que absorbe dos golpes desde cualquier dirección, sin perder vida ni soltar la bandera. Al romperse, hay que esperar 5 segundos y pulsar E de nuevo (o tocar ⛨) para recuperarlo; no se repone automáticamente ni permite recargar una carga restante. Reaparecer o reiniciar la arena restaura las dos cargas. Ambos pueden usar dash. El nigromante lanza su Vínculo de Sangre (clic izquierdo o botón principal táctil; ver abajo) e invoca dos zombies con F o el botón ☠ (recarga de 5 s); E alterna Mando y el clic derecho sobre un zombie lo Marca. Cada invocación es una ejecución de 2 zombies y puede haber como máximo 2 ejecuciones activas a la vez (4 zombies); una tercera no se inicia hasta que terminen los 2 zombies de alguna. Los zombies emergen del suelo escalonados, son más lentos que cualquier clase, persiguen al rival más cercano al cursor del nigromante (o el más cercano a ellos), no hacen fila: los que van tras el mismo objetivo se reparten a su alrededor (en pinza de a dos o en círculo de a más), cada uno se acerca por su lado y recién desde su lugar se lanza al ataque; sin rival cerca del cursor ocupan puestos separados alrededor de esa zona, y toman caminos distintos alrededor de los muros; duran 20 s y cualquier ataque los destruye. Sus golpes cuentan como daño del nigromante: sueltan banderas y suman muertes. La espada usa la última dirección apuntada. El dash usa el movimiento actual o el apuntado si estás quieto. El botón de sonido está en la cabecera; su elección se conserva en el dispositivo. El audio comienza después de una interacción del usuario.

- Robá la bandera enemiga al tocarla y volvé al círculo de tu base. **Tu bandera debe estar en casa para anotar.**
- Llevarla reduce 15 % la velocidad normal; permite atacar y hacer dash.
- Recibir daño suelta la bandera. Quien la soltó no puede recogerla durante 0,7 s.
- Tocar tu bandera caída la devuelve inmediatamente; abandonada vuelve a los 10 s.
- El arquero, el mago y el caballero tienen tres puntos de vida; el guerrero tiene cinco. Espada, flecha y hechizo hacen daño según su clase.
- Reaparición a los 3 s, con 1 s de protección, cancelada al atacar o recoger bandera.
- En duelo las bases quedan a izquierda y derecha. En 2v2, los compañeros comparten base, bandera y marcador, tienen apariciones separadas y no pueden dañarse. En todos contra todos cada color (◆ Azul, ✚ Carmesí, ▲ Jade, ● Violeta) ocupa una esquina.
- Las reapariciones son ilimitadas; las muertes quedan como estadística. Si una facción pierde a todos sus participantes por abandono, su bandera sale del juego. La última facción restante gana.
- Cada captura reinicia la arena y pausa el reloj 2 s. Tres capturas ganan; a los 3 minutos gana el mayor marcador, o se declara empate.
- En **Deathmatch** no hay banderas ni capturas. Cada muerte causada por un rival, su habilidad, trampa o invocación suma una baja para su lado; los abandonos no suman. En 2v2 se comparte el marcador del equipo; en 1v1 y todos contra todos es individual. Las reapariciones siguen siendo ilimitadas. El anfitrión elige primero a 3, 5 o 10 bajas sin reloj, o la mayor cantidad en 3, 5 o 10 minutos; un empate por tiempo termina en tablas.
- El formato exige el cupo completo y que todos estén listos. Todos deben aceptar la revancha. Una desconexión pausa y reserva el asiento 15 s; si no vuelve, abandona. En 2v2 su compañero puede continuar.

### Mapas y arbustos

- **Patio del Rey:** arena abierta, sin arbustos, adecuada para aprender y comparar clases.
- **Bosque de Emboscadas:** claro central y cuatro zonas de arbustos en las rutas laterales.
- **Ruinas del Bastión:** tres corredores conectados y dos zonas de arbustos interiores.
- **Encrucijada:** plaza abierta, obstáculos simétricos y arbustos pequeños en accesos diagonales.

Dentro de un arbusto, un enemigo no recibe la posición ni el estado espacial del personaje. Puede detectarlo si entra en el mismo grupo, se acerca a 90 unidades y tiene línea de visión. Los aliados comparten visión; llevar una bandera impide ocultarse. Atacar o recibir daño revela durante 1,5 s. Proyectiles siguen visibles y las trampas ocultas solo se envían a su dueño o a una facción que detecte esa zona.

## Hordas PvE

El formato **Hordas PvE** admite de **1 a 4 jugadores**. El anfitrión puede comenzar sin llenar los cuatro lugares cuando todos los jugadores que sí están presentes hayan marcado listo. Una vez iniciada la expedición, las entradas nuevas quedan limitadas a espectadores.

La expedición tiene diez oleadas y un Guardián de la cripta como jefe final. Zombies, lobos, esqueletos y brutos escalan según la oleada y la cantidad inicial de jugadores, con un máximo de 24 enemigos activos. Si el grupo vence al jefe, el anfitrión puede continuar en modo infinito conservando las mejoras.

Entre oleadas hay diez segundos para elegir una de tres mejoras privadas. Hay aumentos universales de daño, vida, recargas, movimiento, regeneración y resistencia, además de cartas propias de cada clase, segunda oportunidad y resurrección de compañeros. Un jugador caído no reaparece ni recibe cartas salvo que se consuma una resurrección.

El HUD muestra oleada, enemigos restantes, aliados vivos y la vida del jefe. Las salas públicas publican también la oleada en curso. El modo conserva espectadores, chat, contraseña y la reserva de reconexión de 15 segundos.

## Organización y red

- `packages/shared`: mapa, geometría, tipos, constantes `RULES`, movimiento determinista y clase `Duel`. Es la única fuente de reglas.
- `packages/server`: Colyseus, salas privadas de identificador aleatorio de 128 bits, validación de apodos, entradas y orígenes, reconexión y endpoint `GET /health`.
- `packages/client`: Phaser 3, menús HTML/CSS, pixel art original generado desde matrices, efectos y sonidos sintetizados con Web Audio.

El servidor simula a **30 Hz** y emite snapshots a **15 Hz**. Usa mensajes explícitos de Colyseus para sincronizar el pequeño estado completo del duelo, sin Schema ni almacenamiento. Cada cliente tiene una cola limitada: se procesa como máximo una entrada por tick; el tiempo y las coordenadas del cliente no gobiernan la simulación. Entradas antiguas, no finitas o fuera de rango se rechazan. Tras 250 ms sin inputs se detiene el movimiento residual.

Mensajes cliente → servidor: `input`, `ready`, `selectClass`, `selectTeam`, `perspective`, `sync` y `ping`. Mensajes servidor → cliente: `snapshot`, `roomInfo`, `selectionError` y `pong`. `Snapshot` contiene una lista pública de participantes separada de las entidades visibles; los enemigos ocultos se eliminan por cliente en el servidor.

El navegador predice su movimiento y lo reconcilia con el último `ack`; interpola al rival y suaviza las flechas. Golpes, vida y capturas siempre se resuelven en el servidor. Esta v1 no incorpora rollback ni compensación histórica de impactos: una latencia alta todavía afecta al combate.

`MapDefinition` y `layout()` del paquete compartido deciden paredes, arbustos, bases, banderas y apariciones según el mapa y formato. El cliente y el servidor usan la misma geometría.

## Verificación

```powershell
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` cubre reglas, habilidades, cuatro mapas, 2v2, todos contra todos y filtrado de sigilo, además de integración con clientes Colyseus reales, 150 ms de latencia simulada, reconexión y expiración de la reserva. Usa el puerto **2568**.

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

### Google Cloud Run: servidor en Latinoamérica

El servidor ya respeta `PORT`, escucha en `0.0.0.0` y expone `/health`, por lo que Cloud Run puede ejecutarlo con el `Dockerfile` de la raíz.

1. Elegí o creá un proyecto en Google Cloud y activá facturación. Cloud Run tiene capa gratuita, pero Google exige una cuenta con billing habilitado.
2. Instalá e iniciá sesión con Google Cloud CLI.
3. Desde la raíz del repo:

```powershell
gcloud auth login
gcloud config set project TU_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy bandera-duel-server `
  --source . `
  --region southamerica-east1 `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars NODE_ENV=production,ALLOWED_ORIGINS=https://TU-APP.vercel.app
```

Usá `southamerica-east1` para São Paulo. Si tus jugadores están más cerca de Chile, probá `southamerica-west1`.

Cuando termine, Cloud Run devuelve una URL `https://...run.app`. Verificá:

```powershell
curl https://TU-SERVICIO.run.app/health
```

Después redeployá Vercel con:

```text
VITE_SERVER_URL=wss://TU-SERVICIO.run.app
```

Si usás previews de Vercel, agregá cada origen permitido a `ALLOWED_ORIGINS`, separado por comas y sin barra final.

### Límites de esta primera versión

- Render Free se duerme tras 15 minutos sin tráfico, puede tardar alrededor de un minuto en despertar y puede reiniciarse. Las salas viven en memoria y se pierden al reiniciar. También aplica cuotas de uso y transferencia: gratis no significa ilimitado. Si querés evitar cobros por excedentes, revisá la configuración de pago y límites de la cuenta. [Render Free](https://render.com/docs/free).
- Vercel Hobby está orientado a uso personal no comercial. [Condiciones del plan](https://vercel.com/docs/plans/hobby).
- No hay cuentas, estadísticas persistentes, ranking, bots ni matchmaking público. El chat es temporal y vive únicamente en memoria mientras existe la sala. La protección inicial valida el juego y limita mensajes por conexión; no sustituye controles de abuso a escala pública.
- El arte y sonido del juego son originales. Las tipografías Barlow Condensed y DM Sans se cargan desde Google Fonts, con fuentes locales de respaldo si ese servicio no está disponible.
- Las pruebas de móvil son emuladas en Chromium. No se verificó un teléfono físico ni Safari/iOS; esa comprobación queda pendiente antes de considerar un lanzamiento público.

## Estado de entrega

Ver `VALIDATION.md` para los resultados comprobados y las limitaciones de validación. El repositorio se entrega inicializado, sin remoto ni publicación. Las dependencias quedan fijadas en `package-lock.json`.

## Espectadores

Al abrir una invitación, marcá **Entrar como espectador**, elegí una perspectiva e ingresá un apodo. Hay de 2 a 4 lugares de jugador según el formato y hasta 5 de espectador por sala. La perspectiva queda fija durante la ronda y usa la visión de esa facción; puede cambiarse en la sala o en resultados. Los espectadores no controlan personajes ni marcan listo, y su desconexión no pausa la partida.

## Salas públicas y privadas

Al crear una sala podés elegir título, mapa, formato, objetivo PvP, regla de Deathmatch, visibilidad pública o privada, contraseña opcional y permitir o desactivar espectadores. El anfitrión puede cambiar formato, objetivo y visibilidad en el lobby o después del resultado; el cambio desmarca a todos, limpia el marcador y, tras una partida, devuelve la sala al lobby. No se puede reducir el cupo por debajo de la ocupación actual. Los demás jugadores y espectadores ven los ajustes sin poder editarlos. Hordas sigue separado. La lista pública se actualiza cada 2 segundos y muestra objetivo, regla, mapa, formato, cupo y partidas en curso. Las salas privadas solo se comparten por invitación. La contraseña se exige a jugadores y espectadores y nunca se incluye en la invitación ni en el listado. El contador muestra espectadores conectados en tiempo real. `GET /rooms` devuelve únicamente datos públicos.

## Práctica local

En la pantalla inicial, elegí una clase y uno de los cuatro mapas, y pulsá **Probar contra un rival inmóvil**. No requiere apodo, sala ni servidor. El rival recibe daño y reaparece en su lugar. En la barra se elige qué hace: quedarse inmóvil, disparar flechas, lanzar orbes cargados, atacar con espada o lanzar Crecientes Escarlata cargadas; sirve para probar cortes y parrys. Podés probar armas, movilidad, arbustos y banderas con las reglas habituales.

### Maná y controles de prueba

El Caballero y el Guerrero traen 100 de maná a la arena; las otras clases todavía no tienen habilidades que lo gasten, así que no tienen barra. El maná se ve como una barra azul bajo la vida y vuelve solo a 14 por segundo, 0,8 s después del último gasto. Morir en la arena lo devuelve lleno; en Lugunica el maná sigue siendo el del personaje.

Cada habilidad declara su costo como datos: lo que gasta al salir, lo mínimo para empezar y lo que gasta por segundo mientras se carga. Cargar nunca se come lo que cuesta soltar: si el maná no alcanza para seguir, la carga se queda donde está. La Ráfaga de Acero cuesta 20 al salir y 15 por segundo de carga.

Para probar habilidades hay una franja **PRUEBAS** con el maná actual, **Límite de maná** (apagado, todos los pozos de la sala quedan llenos, aunque las recargas siguen corriendo) y **Recargar maná**, que llena el tuyo al instante. Aparece en la práctica de las versiones de desarrollo (`vite dev`, o un build hecho con `VITE_DEV_TOOLS=true`) y en las salas de un servidor que no corre en producción (`NODE_ENV` distinto de `production`). La versión publicada no la tiene: su práctica juega con las reglas normales.

### Combates en vivo

Las salas públicas en cuenta regresiva, combate o pausa de captura aparecen en **Combates en vivo**, con nombres, marcador y tiempo restante. **Ver combate** prepara el acceso como espectador. Las privadas siguen accesibles solo por invitación; las contraseñas y el cupo de espectadores siguen vigentes.

## Habilidades del arquero

- Q / botón Q: coloca una trampa tras 0,5 s inmóvil. Durante la preparación no puede moverse, atacar ni hacer dash; recibir daño la cancela. La recarga de 8 s empieza al iniciar la preparación, incluso si se interrumpe.
- La trampa tiene un tono apagado, sutilmente visible, se arma en 0,5 s, dura 20 s y causa 0,5 de daño y aturde durante 1 s (sin movimiento ni habilidades). Máximo tres por arquero; colocar otra sustituye la más antigua. No afecta aliados, respeta la protección de daño y el dash; el escudo no bloquea una trampa del suelo.
- E / botón E: dispara tres flechas con apertura de -25°, 0° y +25°. Recarga independiente de 5 s y bloqueo breve compartido con otros ataques.
- Funcionan en práctica y online; capturar o reiniciar limpia las trampas.

### Flecha cargada del arquero

Mantener clic izquierdo durante 0,8 s carga el arco; soltar dispara. En móvil, mantener el botón de flecha, arrastrarlo para orientar y soltarlo para disparar. Mientras carga, el arco muestra runas y ráfagas de viento cada vez más intensas. La carga completa aumenta el daño a 1,3 y la velocidad a 936 unidades/s (+30 %), conserva el alcance máximo y libera una flecha de viento penetrante. La flecha normal viaja a 720 unidades/s y su recarga es de 0,7 s. Soltar antes dispara una flecha normal. La carga se valida en la simulación; perder foco cancela sin disparar. El dash conserva la carga para poder disparar durante el desplazamiento; trampa, daga y triple la consumen.

### Sobrecarga

Mantener clic o Espacio carga la habilidad y soltar la ejecuta; un toque rápido conserva la habilidad normal. Un círculo rúnico bajo el personaje crece y gira más rápido mientras carga, y destella al llegar al máximo (1,5 s).

- Mago: gran bola de fuego (daño de 1 a 2,5, doble tamaño) que explota al impactar y quema a los cercanos con la mitad del daño.
- Nigromante (clic): el Vínculo de Sangre cargado pega 1 en vez de 0,5 y el vínculo dura 5 s en vez de 3. Caballero y guerrero: sus cargas tienen estados propios (ver sus secciones). Arquero y mago (Espacio): dash hasta 1,8 veces más largo. El Paso Relámpago del caballero y la embestida del guerrero se cargan a su manera y conservan la carga de la espada. La flecha cargada del arquero mantiene su regla propia.
- Nigromante (Espacio): una carga corta invoca un solo **zombie con gorro** (máximo uno): tiene 5 de vida, se cura, cada 5 s invoca un zombie que no respeta el tope normal y lanza con los dos brazos un hechizo doble de fuego y hielo (0,5 de daño cada uno); el hielo congela 1,2 s al que golpea. Si se mantiene hasta llenar el aura (2,5 s, cambia a verde) con un rival muerto a menos de 200 px, lo **resucita como esclavo** con su clase y su nombre; el jugador reaparece normalmente y el nigromante puede volver a invocar a ese esclavo con el aura completa 20 s después de que muera.

### Panel de habilidades

En PC, abajo a la izquierda aparece una tarjeta por habilidad con su ícono, tecla, carga y recarga. En celular esas tarjetas se sustituyen por los botones interactivos de cada clase: el ataque normal es el más grande y los botones muestran su recarga y porcentaje de carga sin duplicar paneles sobre la arena.

Mientras se mantiene o apunta una habilidad aparece una guía blueprint local: corredores para proyectiles y dashes, conos para ataques cuerpo a cuerpo, círculos para trampas y defensas y las tres trayectorias del disparo triple. La guía se recorta al encontrar paredes, se vuelve rojiza si el recorrido está bloqueado y nunca usa enemigos ocultos para anticipar impactos. Solo la ve quien apunta; el servidor sigue resolviendo el resultado definitivo.

### Vínculo de Sangre (nigromante)

- **Clic:** el nigromante arroja un hilo de sangre (0,5 de daño al impactar, 1 cargado 1,5 s; viaja hasta 360 u). Lo que alcanza (un rival, un zombie o un monstruo de las hordas) queda **atado** a él por un cordón de sangre que se ve entre los dos.
- Mientras el vínculo dure (3 s, o 5 s cargado) y el atado siga a menos de 380 u, **cada segundo le roba 1 de vida** y se la da al nigromante (sin pasar su vida máxima). El cordón se hincha antes de cada robo y una gota corre por él hasta el nigromante.
- Se **corta** si el atado se aleja más allá de su alcance, si alguno muere o cuando se agota; al cortarse, el cordón se parte y las gotas caen. Un vínculo a la vez: atar a otro corta el anterior, y acertarle otra vez al mismo lo renueva. Recarga de 1,1 s.
- Un rival escondido en un arbusto no queda delatado por el cordón: solo se dibuja cuando los dos extremos están a la vista.

### Control de zombies (nigromante)

- Los **zombies normales** que invocás con Espacio (2 por invocación) te siguen dentro de un **círculo rojo** de 110 px que viaja con el nigromante. Solo atacan a quien entra en ese círculo; si el rival sale, vuelven a tu lado.
- El **zombie mago**, sus **lacayos** y el **esclavo** siguen el **mouse** (círculo violeta): van a esa zona repartiéndose alrededor y, si el mouse queda cerca de un rival, lo rodean y lo atacan.
- Cuando muere un rival queda su **tumba** durante 10 s. Con el aura llena aparece una circunferencia blanca que titila con el alcance (200 px); al soltar, se abre un **mandala bajo el mouse** dentro de ese alcance y ahí se levanta el caído de la tumba más cercana como lacayo hasta que lo maten, aunque el jugador ya haya reaparecido y aunque tenga otros zombies vivos (máximo 1 esclavo).
- **⌘E / Ctrl+E** pasa al zombie más cercano al cursor del círculo rojo al mouse, o al revés.
- Los zombies ya **no desaparecen con el tiempo**: duran hasta que los matan (o hasta que la arena se reinicia tras una captura). El zombie mago mantiene como máximo 3 lacayos vivos.
- **Zombie con espada:** si te matan un zombie del círculo rojo, el próximo Espacio lo trae de vuelta como zombie con espada (ocupa el mismo lugar, aunque las invocaciones estén llenas). Pega 1,5 y tiene 3 de vida. Cada vez que mata a alguien **sube de nivel** (hasta 3): nivel 2, +0,5 de daño, +1 de vida y ataca más rápido; nivel 3, otra mejora igual y además **golpea a todos** los rivales a su alcance.
- **E** activa o desactiva el modo **automático**: sin círculos, todos atacan solos al rival cercano y, si no hay ninguno, te acompañan.
- Invocar no espera ni bloquea al vínculo: se puede lanzar el vínculo e invocar a la vez. Resucitar castea **0,5 s** con el nigromante quieto; recién entonces se abre el mandala y se levanta el esclavo.

### Caballero

Espadachín del relámpago: el más rápido de la arena, sin escudo. Se defiende moviéndose y cortando lo que le tiran, y su magia es el rayo: sus técnicas dejan electrizados a los rivales. El clic derecho, E y F quedan libres.

- **Clic · Tres Cortes:** cadena fija de tres golpes que se continúan: un corte de derecha a izquierda, el regreso de izquierda a derecha (1 de daño cada uno) y el **Tajo Descendente** (1,5, crítico cuando conecta): la espada sube por encima del hombro y baja en diagonal, 40° fuera de la vertical, sobre la línea de la puntería. Cuando el hombro de la espada queda del lado de la cámara, baja por el otro, para que se vea venir desde arriba. Cada golpe arranca donde el anterior dejó la hoja, y el descendente tarda más en prepararse. La cadena vuelve a empezar 0,9 s después del último golpe. Un clic dado durante un corte queda en cola y sale al terminar.
- **La tarjeta del clic dibuja el corte que sigue:** una espada horizontal hacia un lado, hacia el otro, o en diagonal hacia el suelo, teñida con el color de la carga (violeta, despierto). El botón táctil hace lo mismo.
- **El golpe sigue a la hoja.** Los horizontales barren un arco de 120° al frente, con alcance 58. El descendente cae de una vez sobre una franja angosta de 88 hacia donde se apunta. Cada corte golpea una vez a cada rival, no atraviesa muros y nunca alcanza detrás.
- **Carga:** mantener el clic carga solo el corte que toca, en cinco estados (toque, baja a 0,22 s, media a 0,6 s, alta a 1 s y 100 % a 1,4 s). El brillo va del rayo al azul profundo y al rojo, y cada estado nuevo suena más agudo. Cargado pega hasta el doble y lanza un tajo que sale de la hoja, más largo y fuerte con cada estado. Los horizontales lanzan una media luna ancha (de 100 a 250 de alcance); el descendente, una grieta de energía angosta y honda que corre a ras del suelo por la línea del golpe, llega un 30 % más lejos y pega un 50 % más. Cargando camina al 70 % y no puede usar la Ráfaga. Un golpe de hasta 1,5 de daño no interrumpe la carga; uno más fuerte o un aturdimiento sí (hay que volver a pulsar). La cadena espera mientras se carga.
- **Corte de habilidades:** la hoja y sus tajos cortan las habilidades enemigas que cruzan, según la carga. Un toque apenas las debilita; al 100 % las parte en el aire. Una flecha común se corta del todo con menos carga que un orbe cargado. Un tajo enemigo cortado queda con un hueco por donde pasó la hoja. Hay que interceptar: solo se corta mientras la hoja pasa.
- **Electrizado:** cada golpe eléctrico deja una carga en el rival que lo frena un 10 %. Las cargas duran 1 s y cada carga nueva lo renueva. Con tres descarga: 0,45 s de aturdimiento y 1,2 s en los que no acumula más.
- **Q · Ráfaga de Acero:** la espada se electriza. Un toque, *Tres Relámpagos*: tres golpes distintos que avanzan (un corte ascendente, un revés que gira el cuerpo y una estocada), 0,5, 0,5 y 0,75 de daño; cada uno electriza, así que los tres juntos descargan. Media carga (0,45 s), *Cruz Gemela*: dos cortes de 1 que electrizan, cada uno con su tajo corto. Carga máxima (1,2 s), **Corte Celestial**: todo en un solo corte horizontal (2,5, crítico) y un tajo blanco y dorado, angosto y veloz (980 por segundo), que cruza el mapa (1100 de alcance). De cerca quita media vida a un Guerrero; a mitad de la arena, menos de la mitad de eso; en la otra punta, un sexto. Parte en el aire lo que cruza. Es más angosto y más veloz que la ola del Guerrero: precisión, no masa. La carga solo se interrumpe con un golpe de más de 2 de daño. Recarga de 5 s; cuesta 20 de maná más 15 por segundo de carga.
- **Espacio · Paso Relámpago:** el cuerpo se carga de relámpago y lo suelta de golpe hacia donde apunta: 170 unidades con un toque, hasta 300 manteniendo 0,7 s (mientras carga, un mandala eléctrico le recorre el cuerpo). Daña a quien atraviesa (1, o 1,5 cargado) y lo electriza (una carga, o dos). No da invulnerabilidad; recarga de 3 s; cuesta 10 de maná más 20 por segundo de carga. Sale al instante aunque esté cortando o cargando otra técnica: el corte en curso sigue y su hoja viaja con él, y la carga se conserva. Solo el Corte Celestial y el Despertar lo hacen esperar, porque en ellos va todo el cuerpo. Nada salvo un aturdimiento interrumpe su carga.
- **R · Despertar del Relámpago:** no hay barra que llenar. Un mandala baja despacio por el cuerpo, de la cabeza a los pies (0,9 s con la espada en alto, sin moverse de ahí), y el relámpago violeta lo toma durante 20 s. Despierto, cada técnica es su versión eléctrica: todo corte lanza un tajo violeta que electriza (el descendente, dos cargas), la Ráfaga suelta un rayo con cada golpe, el Corte Celestial se vuelve violeta y electriza, y el Paso llega un 20 % más lejos, pega más y electriza una carga más. El daño de la espada y de los tajos sube 25 %. Recarga de 60 s. Morir lo apaga. En Hordas, cada rango del Caballero lo alarga un 15 %.

### Guerrero

Una potencia reforzada: su magia no lanza nada, le endurece el cuerpo. Es el más lento (145) y el que más aguanta (5 de vida), y tarda 0,15 s en alcanzar su velocidad y en frenar. Planta los pies, aguanta y devuelve.

- **Clic · Mandoble del Titán:** dos golpes pesados que se alternan: el *Barrido del Titán*, ancho, de derecha a izquierda (2 de daño, alcance 82), y la *Caída de Montaña*, desde arriba (2,5), que cae de una vez sobre una franja de 100 hacia donde se apunta y empuja lejos. Tardan en salir (0,3 y 0,4 s) y en volver; la caída arranca desde donde el barrido dejó la hoja. La cadena vuelve a empezar 1,2 s después. **Cargado** (desde 0,22 s) ya no golpea: al soltar lanza **un solo tajo de fuerza** que crece con la carga, de 170 u y 2,25 de daño hasta media arena (480 u) y 3,5 a 1,5 s; también se hace más ancho, rápido y encendido (carmesí, rojo, ardiente). El del Barrido es la *Media Luna del Titán*, ancha; el de la Caída, la *Falla Sísmica*, una línea angosta que parte el suelo y pega un 20 % más. Atraviesa muros y pierde fuerza con la distancia (a carga completa conserva el 60 % al final). Cargando camina al 60 % y un golpe recibido la rompe. No corta proyectiles: para eso está la Creciente.
- **Q · Creciente Escarlata:** un tajo que viaja, atraviesa y corta lo que le lanzan. El toque es corto (unos 270 de alcance, 1,5 de daño). Mantenido crece: a los 3 s está completo (unos 520 de alcance, 3 de daño) y, si se sigue, se sobrecarga hasta los 7 s y se abre en abanico hasta cruzar el mapa (5 de daño). Su poder de corte sube con la carga, con un salto al completarse: de un toque corta flechas; desde el segundo, orbes cargados; completa, parte tajos y olas grandes (incluido el Corte Celestial del Caballero); la ola colosal parte hasta otra ola colosal. Su color sigue a ese poder: sangre y violeta al principio, rojo desde el segundo, ardiente y con brasas al completarse, y al rojo blanco con borde violeta como ola colosal; el aura de la carga y el sonido cambian a la vez. Pega más cerca que lejos, pero cuanto más se cargó menos pierde: de un toque conserva el 40 % al final y sobrecargada el 62 %. **Atraviesa muros**: la guía muestra siempre su alcance real. Al soltarla, el suelo cede bajo el Guerrero, saltan brasas y, en las cargas altas, tiembla la pantalla; suena más grave cuanto más se cargó. Cuesta 15 de maná más 12 por segundo de carga y la recarga va de 5 a 12 s según lo cargado. Cargando camina al 40 %, no puede usar el mandoble ni el parry, se lo ve en los arbustos, un golpe lo interrumpe y le cuesta media recarga, y la movilidad lo cancela sin gastar la recarga.
- **E · Parry:** nunca tuvo talento para la magia, así que entrenó lo único que tenía: parar. Es una guardia que cubre el frente (180° hacia donde apunta). Pulsada, se levanta 0,3 s sin frenarlo: a tiempo, un proyectil o un tajo que llega de frente vuelve un 25 % más rápido hacia quien lo lanzó (si se movió hasta 60° de su camino de vuelta; si no, por donde vino), y un golpe cuerpo a cuerpo se frena y deja al atacante tambaleando y empujado. **Mantenida**, la guardia sigue arriba mientras un mandala naranja endurece el cuerpo: camina al 55 %, no puede golpear ni lanzar la Creciente y gasta 12 de maná por segundo. Cuanto más la sostiene, más fuerte es: lo que devuelve vuelve más rápido, más fuerte (hasta ×2) y más grande, el tambaleo dura más, y puede devolver cosas más pesadas. A tiempo devuelve flechas, tajos livianos y la creciente corta; desde 0,4 s, orbes cargados; sostenida alrededor de 1,2 s, el Corte Celestial; y desde 1,5 s, una **Singularidad** del Mago, que vuelve hacia su mago como del Guerrero. Lo que todavía no alcanza a devolver lo frena, si es algo que se puede frenar; una Singularidad no se frena: o se devuelve, o se lo lleva. A los 2,2 s, o sin maná para sostenerla, la guardia se suelta sola. Un golpe por la espalda o el costado de más de 0,9 le rompe la guardia sostenida. Cada acierto le devuelve tiempo de ventana (una salva entera se puede devolver) y deja la recarga en 0,6 s; fallar cuesta de 3 a 5 s según cuánto la sostuvo. No para trampas ni ejecuciones, y un proyectil rebota tres veces como máximo. Corta la recuperación de sus propios golpes, nunca su preparación.
- **Espacio · Embestida Sísmica:** carga las piernas un instante, el suelo cede bajo el pie y sale despedido hacia donde apunta: 90 unidades con un toque, hasta 210 manteniendo 0,6 s. Aparta a quien se cruza (0,5 de daño y un empujón) y no da invulnerabilidad. Cuesta 10 de maná más 15 por segundo de carga; recarga de 2,5 s. Se puede usar mientras carga el mandoble sin perder esa carga.
- **R · Cuerpo de Titán:** un mandala rojo sube por el cuerpo y lo refuerza 6 s: recibe 40 % menos de daño, nada lo empuja, no le rompen las cargas ni lo aturden trampas o hielo, y cada golpe del mandoble manda su onda (un estado más fuerte que su carga). Cuesta 40 de maná; recarga de 16 s.

### Combos del arquero

- **Triple (E):** las 3 flechas salen casi en fila y se abren de a poco. Si una ya alcanzó a un rival, las otras siguen de largo hacia el próximo en línea.
- **Cargando el clic + E:** 3 flechas potenciadas al 33 % de la carga completa.
- **Salto cargado:** con Espacio al máximo, al soltarlo el arquero salta y, mientras está en el aire (y hasta 0,6 s después), lo que suelte (siempre hacia el mouse) se combina con el salto. Mantener el clic no se pierde durante ese salto. Un combo por salto:
  - **Tiro cargado al máximo:** **flecha de viento** penetrante que cruza la arena, atraviesa a cada rival una vez, atraviesa la guardia continua sin bajarla, rompe el escudo mágico y hace el doble que la flecha cargada.
  - **E:** triple (al 33 % si venía cargando el clic).
  - **Dash + E:** 3 flechas de viento potenciadas y penetrantes que se abren de a poco. Pensado para saltar a la cara del rival: a quemarropa entran las 3 y suman el 120 % de la flecha de viento (40 % cada una); más lejos se reparten entre varios.
### Chat y cierre de salas

El botón flotante abre el chat para jugadores y espectadores y marca los mensajes sin leer. Conserva hasta 50 mensajes durante la vida de la sala. Solo se puede escribir cuando hay al menos dos jugadores conectados; los espectadores no cuentan para habilitarlo ni mantienen viva la sala.

Una reserva de reconexión de jugador conserva la sala durante 15 segundos. Cuando el último jugador abandona definitivamente, la sala avisa a los espectadores y se cierra. También se cierra tras 2 minutos sin movimiento, apuntado, habilidades, cambios de sala o mensajes humanos. El chat queda visible en modo lectura durante el aviso de cierre.
