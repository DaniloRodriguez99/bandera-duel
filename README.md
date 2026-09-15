# Bandera Duel

Juego web de captura de bandera para **duelos 1v1, equipos 2v2 o todos contra todos de 3–4 jugadores**, con espada, arco, magia y dash. Partidas de tres minutos, salas públicas o privadas por link, cuatro mapas, controles para PC y celular y servidor autoritativo. No requiere cuentas ni base de datos.

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

El mago también lanza un proyectil de hielo con clic central (presionar la rueda, botón 3) o el botón táctil ❄. Inmoviliza al objetivo durante 1 segundo, sin daño adicional, y tiene 0,5 segundos de recarga independiente del fuego. Bloquea caminar y dash, pero permite apuntar y atacar. Los escudos y la invulnerabilidad bloquean el efecto.

La banda sonora es original y sintetizada: melodía medieval en el menú, ritmo de aventura durante el duelo, más intensidad en los últimos 30 segundos y un cierre musical al terminar. Comienza tras la primera interacción y se pausa al ocultar la pestaña. El control «Música» ajusta su volumen sin cambiar los efectos; el botón de sonido silencia todo. Ambas preferencias se guardan en el navegador.

| Acción  | PC             | Celular horizontal               |
| ------- | -------------- | -------------------------------- |
| Mover   | WASD o flechas | Palanca izquierda                |
| Apuntar | Mouse          | Palanca derecha                  |
| Espada  | Clic izquierdo | Botón ⚔                         |
| Distancia | Clic izquierdo | Apuntar y soltar palanca derecha |
| Acción secundaria | Clic derecho | Botón de daga, escudo o invocación |
| Dash    | Espacio        | Botón ➟                          |

El arquero dispara flechas y usa una daga. El mago lanza bolas de fuego con clic izquierdo y comienza con un escudo mágico que absorbe dos golpes desde cualquier dirección, sin perder vida ni soltar la bandera. Al romperse, hay que esperar 5 segundos y hacer un nuevo clic derecho (o tocar ⛨) para recuperarlo; no se repone automáticamente ni permite recargar una carga restante. Reaparecer o reiniciar la arena restaura las dos cargas. Ambos pueden usar dash. El nigromante lanza fuego (clic izquierdo o palanca derecha) e invoca dos zombies con espacio, clic derecho o el botón ☠ (recarga de 5 s). Cada invocación es una ejecución de 2 zombies y puede haber como máximo 2 ejecuciones activas a la vez (4 zombies); una tercera no se inicia hasta que terminen los 2 zombies de alguna. Los zombies emergen del suelo escalonados, son más lentos que cualquier clase, persiguen al rival más cercano al cursor del nigromante (o el más cercano a ellos), no hacen fila: los que van tras el mismo objetivo se reparten a su alrededor (en pinza de a dos o en círculo de a más), cada uno se acerca por su lado y recién desde su lugar se lanza al ataque; sin rival cerca del cursor ocupan puestos separados alrededor de esa zona, y toman caminos distintos alrededor de los muros; duran 20 s y cualquier ataque los destruye. Sus golpes cuentan como daño del nigromante: sueltan banderas y suman muertes. La espada usa la última dirección apuntada. El dash usa el movimiento actual o el apuntado si estás quieto. El botón de sonido está en la cabecera; su elección se conserva en el dispositivo. El audio comienza después de una interacción del usuario.

- Robá la bandera enemiga al tocarla y volvé al círculo de tu base. **Tu bandera debe estar en casa para anotar.**
- Llevarla reduce 15 % la velocidad normal; permite atacar y hacer dash.
- Recibir daño suelta la bandera. Quien la soltó no puede recogerla durante 0,7 s.
- Tocar tu bandera caída la devuelve inmediatamente; abandonada vuelve a los 10 s.
- El arquero, el mago y el caballero tienen tres puntos de vida; el guerrero tiene cinco. Espada, flecha y hechizo hacen daño según su clase.
- Reaparición a los 3 s, con 1 s de protección, cancelada al atacar o recoger bandera.
- En duelo las bases quedan a izquierda y derecha. En 2v2, los compañeros comparten base, bandera y marcador, tienen apariciones separadas y no pueden dañarse. En todos contra todos cada color (◆ Azul, ✚ Carmesí, ▲ Jade, ● Violeta) ocupa una esquina.
- Las reapariciones son ilimitadas; las muertes quedan como estadística. Si una facción pierde a todos sus participantes por abandono, su bandera sale del juego. La última facción restante gana.
- Cada captura reinicia la arena y pausa el reloj 2 s. Tres capturas ganan; a los 3 minutos gana el mayor marcador, o se declara empate.
- El formato exige el cupo completo y que todos estén listos. Todos deben aceptar la revancha. Una desconexión pausa y reserva el asiento 15 s; si no vuelve, abandona. En 2v2 su compañero puede continuar.

### Mapas y arbustos

- **Patio del Rey:** arena abierta, sin arbustos, adecuada para aprender y comparar clases.
- **Bosque de Emboscadas:** claro central y cuatro zonas de arbustos en las rutas laterales.
- **Ruinas del Bastión:** tres corredores conectados y dos zonas de arbustos interiores.
- **Encrucijada:** plaza abierta, obstáculos simétricos y arbustos pequeños en accesos diagonales.

Dentro de un arbusto, un enemigo no recibe la posición ni el estado espacial del personaje. Puede detectarlo si entra en el mismo grupo, se acerca a 90 unidades y tiene línea de visión. Los aliados comparten visión; llevar una bandera impide ocultarse. Atacar o recibir daño revela durante 1,5 s. Proyectiles siguen visibles y las trampas ocultas solo se envían a su dueño o a una facción que detecte esa zona.

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

### Límites de esta primera versión

- Render Free se duerme tras 15 minutos sin tráfico, puede tardar alrededor de un minuto en despertar y puede reiniciarse. Las salas viven en memoria y se pierden al reiniciar. También aplica cuotas de uso y transferencia: gratis no significa ilimitado. Si querés evitar cobros por excedentes, revisá la configuración de pago y límites de la cuenta. [Render Free](https://render.com/docs/free).
- Vercel Hobby está orientado a uso personal no comercial. [Condiciones del plan](https://vercel.com/docs/plans/hobby).
- No hay cuentas, estadísticas persistentes, ranking, bots, chat ni matchmaking público. La protección inicial valida el juego y limita mensajes por conexión; no sustituye controles de abuso a escala pública.
- El arte y sonido del juego son originales. Las tipografías Barlow Condensed y DM Sans se cargan desde Google Fonts, con fuentes locales de respaldo si ese servicio no está disponible.
- Las pruebas de móvil son emuladas en Chromium. No se verificó un teléfono físico ni Safari/iOS; esa comprobación queda pendiente antes de considerar un lanzamiento público.

## Estado de entrega

Ver `VALIDATION.md` para los resultados comprobados y las limitaciones de validación. El repositorio se entrega inicializado, sin remoto ni publicación. Las dependencias quedan fijadas en `package-lock.json`.

## Espectadores
Al abrir una invitación, marcá **Entrar como espectador**, elegí una perspectiva e ingresá un apodo. Hay de 2 a 4 lugares de jugador según el formato y hasta 5 de espectador por sala. La perspectiva queda fija durante la ronda y usa la visión de esa facción; puede cambiarse en la sala o en resultados. Los espectadores no controlan personajes ni marcan listo, y su desconexión no pausa la partida.



## Salas públicas y privadas
Al crear una sala podés elegir título, mapa, formato, visibilidad pública o privada, contraseña opcional y permitir o desactivar espectadores. La lista pública se actualiza cada 2 segundos, muestra mapa, formato, cupo y partidas en curso. Las salas privadas solo se comparten por enlace. La contraseña se exige a jugadores y espectadores y nunca se incluye en el enlace ni en el listado. El contador muestra espectadores conectados en tiempo real. `GET /rooms` devuelve únicamente datos públicos.


## Práctica local
En la pantalla inicial, elegí una clase y uno de los cuatro mapas, y pulsá **Probar contra un rival inmóvil**. No requiere apodo, sala ni servidor. El rival recibe daño y reaparece, pero no se mueve ni ataca. Podés probar armas, movilidad, arbustos y banderas con las reglas habituales.


### Combates en vivo
Las salas públicas en cuenta regresiva, combate o pausa de captura aparecen en **Combates en vivo**, con nombres, marcador y tiempo restante. **Ver combate** prepara el acceso como espectador. Las privadas siguen accesibles solo por invitación; las contraseñas y el cupo de espectadores siguen vigentes.


## Habilidades del arquero
- Q / botón Q: coloca una trampa tras 0,5 s inmóvil. Durante la preparación no puede moverse, atacar ni hacer dash; recibir daño la cancela. La recarga de 8 s empieza al iniciar la preparación, incluso si se interrumpe.
- La trampa tiene un tono apagado, sutilmente visible, se arma en 0,5 s, dura 20 s y causa 0,5 de daño y aturde durante 1 s (sin movimiento ni habilidades). Máximo tres por arquero; colocar otra sustituye la más antigua. No afecta aliados, respeta la protección de daño y el dash; el escudo no bloquea una trampa del suelo.
- E / botón E: dispara tres flechas con apertura de -25°, 0° y +25°. Recarga independiente de 5 s y bloqueo breve compartido con otros ataques.
- Funcionan en práctica y online; capturar o reiniciar limpia las trampas.


### Flecha cargada del arquero
Mantener clic izquierdo durante 0,8 s carga el arco; soltar dispara. En móvil, mantener y soltar la palanca de apuntado. La carga completa vuelve naranja la flecha, aumenta daño a 1,3 y velocidad a 728 unidades/s (+30 %), conservando alcance máximo y recarga. Soltar antes dispara una flecha normal. La carga se valida en la simulación; perder foco cancela sin disparar. Dash, trampa, daga y triple descartan la carga.


### Sobrecarga
Mantener clic o Espacio carga la habilidad y soltar la ejecuta; un toque rápido conserva la habilidad normal. Un círculo rúnico bajo el personaje crece y gira más rápido mientras carga, y destella al llegar al máximo (1,5 s).
- Mago: gran bola de fuego (daño de 1 a 2,5, doble tamaño) que explota al impactar y quema a los cercanos con la mitad del daño.
- Nigromante (clic): fuego cargado de 1 a 2 de daño y casi el doble de tamaño. Caballero y guerrero: golpe cargado con más daño (×2 y ×1,75) y más alcance. Arquero y mago (Espacio): dash hasta 1,8 veces más largo. La flecha cargada del arquero mantiene su regla propia.
- Nigromante (Espacio): una carga corta invoca un solo **zombie con gorro** (máximo uno): tiene 5 de vida, se cura, cada 5 s invoca un zombie que no respeta el tope normal y lanza con los dos brazos un hechizo doble de fuego y hielo (0,5 de daño cada uno); el hielo congela 1,2 s al que golpea. Si se mantiene hasta llenar el aura (2,5 s, cambia a verde) con un rival muerto a menos de 200 px, lo **resucita como esclavo** con su clase y su nombre; el jugador reaparece normalmente y el nigromante puede volver a invocar a ese esclavo con el aura completa 20 s después de que muera.
### Panel de habilidades
Durante la partida, abajo a la izquierda del escenario aparece una tarjeta por habilidad con su ícono, su tecla (CLIC, ESPACIO y, según la clase, CLIC DER., Q o E) y un velo circular con los segundos de recarga restantes; la tarjeta se ilumina cuando está lista. En pantallas táctiles el panel se ubica arriba a la izquierda para no tapar la palanca de movimiento. En el nigromante, Espacio invoca zombies.
Sobre cada tarjeta crece su árbol: qué hace un toque, qué hace mantener y (en el nigromante) el aura llena, con el estado de cada rama (ejecuciones activas, zombie mago vivo, recarga del esclavo, porcentaje de carga). La rama que se dispararía al soltar se ilumina mientras se carga. En táctil el árbol se oculta para no tapar el escenario.

### Control de zombies (nigromante)
- Los **zombies normales** que invocás con Espacio (2 por invocación) te siguen dentro de un **círculo rojo** de 110 px que viaja con el nigromante. Solo atacan a quien entra en ese círculo; si el rival sale, vuelven a tu lado.
- El **zombie mago**, sus **lacayos** y el **esclavo** siguen el **mouse** (círculo violeta): van a esa zona repartiéndose alrededor y, si el mouse queda cerca de un rival, lo rodean y lo atacan.
- Cuando muere un rival queda su **tumba** durante 10 s. Con el aura llena aparece una circunferencia blanca que titila con el alcance (200 px); al soltar, se abre un **mandala bajo el mouse** dentro de ese alcance y ahí se levanta el caído de la tumba más cercana como lacayo hasta que lo maten, aunque el jugador ya haya reaparecido y aunque tenga otros zombies vivos (máximo 1 esclavo).
- **⌘E / Ctrl+E** pasa al zombie más cercano al cursor del círculo rojo al mouse, o al revés.
- Los zombies ya **no desaparecen con el tiempo**: duran hasta que los matan (o hasta que la arena se reinicia tras una captura). El zombie mago mantiene como máximo 3 lacayos vivos.
- **Zombie con espada:** si te matan un zombie del círculo rojo, el próximo Espacio lo trae de vuelta como zombie con espada (ocupa el mismo lugar, aunque las invocaciones estén llenas). Pega 1,5 y tiene 3 de vida. Cada vez que mata a alguien **sube de nivel** (hasta 3): nivel 2, +0,5 de daño, +1 de vida y ataca más rápido; nivel 3, otra mejora igual y además **golpea a todos** los rivales a su alcance.
- **E** activa o desactiva el modo **automático**: sin círculos, todos atacan solos al rival cercano y, si no hay ninguno, te acompañan.
- Invocar no espera ni bloquea al fuego: se puede lanzar fuego e invocar a la vez. Resucitar castea **0,5 s** con el nigromante quieto; recién entonces se abre el mandala y se levanta el esclavo.

### Caballero
- **Espacio:** dash, como el arquero y el mago (mantener para un dash más largo).
- **Q · contraataque:** mientras está activo, todo proyectil que lo alcance (flechas, fuego, hielo, bolas de fuego, flechas de viento) vuelve en sentido contrario y pasa a ser del caballero, con el mismo daño. Un toque lo deja activo 0,45 s; mantener Q lo sostiene hasta 2,5 s (moviéndose a mitad de velocidad y sin escudo). Si se mantiene **1 s o más**, lo que devuelve sale **al doble de velocidad y de daño**. Al terminar entra en recarga de 4 s y hay que soltar Q para volver a usarlo.

### Combos del arquero
- **Triple (E):** las 3 flechas salen casi en fila y se abren de a poco. Si una ya alcanzó a un rival, las otras siguen de largo hacia el próximo en línea.
- **Cargando el clic + E:** 3 flechas potenciadas al 33 % de la carga completa.
- **Salto cargado:** con Espacio al máximo, al soltarlo el arquero salta y, mientras está en el aire (y hasta 0,6 s después), lo que suelte (siempre hacia el mouse) se combina con el salto. Mantener el clic no se pierde durante ese salto. Un combo por salto:
  - **Tiro cargado al máximo:** **flecha de viento** penetrante que cruza la arena, atraviesa a cada rival una vez, rompe escudos (bloqueo del caballero y escudo mágico) y hace el doble que la flecha cargada.
  - **E:** triple (al 33 % si venía cargando el clic).
  - **Clic lleno + E:** 3 flechas de viento potenciadas y penetrantes que se abren de a poco. Pensado para saltar a la cara del rival: a quemarropa entran las 3 y suman el 120 % de la flecha de viento (40 % cada una); más lejos se reparten entre varios.

