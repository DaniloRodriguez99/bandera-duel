# Registro de cambios

## 2026-09-30

### Cargas que se ven y se oyen

- Mientras se carga una habilidad, su ícono brilla en el color del estado que alcanzó, y el aro del botón táctil también. Cada estado nuevo suena más agudo.

### Pruebas solo en desarrollo

- La franja **PRUEBAS** (límite de maná y recarga) ya no aparece en la versión publicada: queda para la práctica de las versiones de desarrollo y para los servidores que no corren en producción.

### Guerrero: técnicas

- **Nombres e íconos nuevos:** Mandoble del Titán (Barrido del Titán y Caída de Montaña), Creciente Escarlata, Represalia del Coloso, Embestida Sísmica y Cuerpo de Titán. Cada técnica tiene su ícono; el del Cuerpo de Titán ya no repite el del parry.
- **Represalia del Coloso se puede mantener.** Pulsada sigue siendo el parry justo a tiempo. Mantenida, la guardia sigue arriba mientras un mandala naranja endurece el cuerpo, y lo que devuelve vuelve más rápido, más fuerte y más grande cuanto más la sostuvo. Gasta maná mientras se sostiene, lo frena y no lo deja golpear; se suelta sola a los 2,2 s, y un golpe por la espalda la rompe.
- **Qué puede devolver depende de cuánto la sostuvo.** Flechas y tajos livianos, a tiempo; orbes cargados, desde 0,4 s; el Corte Celestial, alrededor de 1,2 s; y una Singularidad del Mago, desde 1,5 s: vuelve hacia su mago como del Guerrero. Lo que todavía no alcanza a devolver lo frena. Cada ataque declara si se puede frenar, devolver o cortar, y con cuánta fuerza.
- **La Creciente Escarlata corta lo que le lanzan.** De un toque corta flechas; desde el segundo, orbes; completa, parte tajos y olas; la ola colosal lo parte todo. El salto al completarse se nota.
- **Su color sigue a su poder:** sangre y violeta, rojo, ardiente con brasas y al rojo blanco con borde violeta. El aura de la carga, los estados del panel y el sonido cambian a la vez.
- Fallar el parry cuesta de 3 a 5 s según cuánto se sostuvo; acertar lo deja listo en 0,6 s, como antes.

### Caballero: técnicas

- **Tajo Descendente.** El tercer corte ya no cae recto: la espada sube por encima del hombro y baja en diagonal sobre la línea de la puntería, y se la ve venir desde arriba. Cargado, su tajo es una grieta de energía angosta que corre a ras del suelo, más lejos y más fuerte que la media luna de los cortes horizontales.
- **La tarjeta del clic muestra el corte que sigue:** una espada horizontal hacia un lado, hacia el otro, o en diagonal hacia el suelo, teñida con el color de la carga. También en el botón táctil.
- **Corte Celestial (Q a fondo)** reemplaza al Juicio Carmesí: un tajo blanco y dorado, angosto y veloz, que cruza el mapa. De cerca quita media vida a un Guerrero; pierde fuerza con la distancia. Parte lo que cruza.
- **Cargar bajo ataque.** Un golpe leve ya no rompe las cargas del Caballero: el corte aguanta golpes de hasta 1,5, la Ráfaga hasta 2 y el Paso cualquiera. Morir o quedar aturdido sigue terminando todo.
- **Paso Relámpago a la vez que la espada.** Sale al instante aunque esté cortando o cargando: el corte sigue y su hoja viaja con él. Solo el Corte Celestial y el Despertar lo hacen esperar.
- **Despertar del Relámpago sin Furia.** R se recarga en 60 s. Un mandala baja despacio de la cabeza a los pies y el relámpago violeta lo toma 20 s: cada técnica tiene su versión violeta, más fuerte y electrizante. La barra de Furia desaparece.
- Electrizado dura 1 s y cada carga nueva lo renueva.
- Una espada levantada sobre la cabeza ahora se dibuja de pie, también el martillazo del Guerrero.
- Íconos nuevos para la Ráfaga, el Paso y el Despertar. Sonidos propios para el descendente, el Corte Celestial y el Despertar, y un sonido cada vez más agudo al pasar de estado de carga, para todos los que cargan.
- Hordas: la mejora del Caballero alarga el Despertar en vez de llenar la Furia.

### El cuerpo mira hacia donde ataca

- En plena pelea el personaje mira hacia donde se apunta, aunque camine para otro lado: se puede correr en una dirección y atacar en la otra, retrocediendo de frente al rival. Cuenta como pelear golpear, cargar, preparar un golpe, recién disparar, tener la guardia arriba o mantener una tecla para apuntar una habilidad. Un momento después del último golpe vuelve a mirar hacia donde camina. Vale para todas las clases.

### Caballero: espadachín del relámpago

- El segundo corte ahora vuelve: la cadena es derecha a izquierda, izquierda a derecha y un remate que levanta la espada y la baja de un golpe sobre toda la franja, en lugar de una estocada. Cada golpe arranca donde el anterior dejó la hoja, y el remate tarda un poco más en prepararse.
- **Electrizado:** los golpes eléctricos dejan cargas en el rival que lo frenan; con tres descarga en un aturdimiento breve, y después no acumula por un momento.
- **Ráfaga de Acero pasa a Q.** El toque son tres golpes distintos que avanzan (corte ascendente, revés y estocada) y cada uno electriza. El clic derecho queda libre. Los perfiles guardados la mueven sola.
- **Paso Relámpago se carga:** va hacia donde se apunta, más lejos y más fuerte cuanto más se mantiene, y electriza a quien atraviesa. Cuesta maná y espera a que la hoja termine antes de salir.
- **Despertar del Relámpago:** el Despertar se vuelve eléctrico; despierto, cada golpe electriza.
- El brillo de la carga va del rayo al violeta y al rojo. Los tajos cargados, el aura y el mandala son de relámpago. Sonidos más agudos para la espada, el paso y la descarga.

### Guerrero: potencia reforzada

El Guerrero cambia su contraataque sostenido y su tajo de siempre por un kit propio. Su magia le refuerza el cuerpo: todo lo suyo es fuerza física, en rojo. Versión de prototipo: la jugabilidad está completa, los efectos visuales y de sonido son provisorios.

- **Mandoble Colosal (clic).** Dos golpes pesados que se alternan: un barrido ancho y un martillazo desde arriba que cae de una vez sobre la franja de adelante. Tardan en salir y en volver; el segundo arranca desde donde el primero dejó la hoja. Cargado pega hasta ×1,75, llega más lejos y manda una onda roja hacia adelante. Ya no corta proyectiles: eso es del Caballero.
- **Creciente Escarlata (Q).** El tajo que viaja ahora crece mientras se carga: completo a los 3 s y, si se sigue, se sobrecarga hasta una ola que cruza el mapa. Pega más cerca que lejos y los muros cubren. Cuesta maná por segundo de carga, y cargando el Guerrero es lento, visible en los arbustos e interrumpible; la movilidad lo cancela.
- **Revancha de Hierro (E).** Un parry de 0,3 s que cubre el frente sin frenarlo: devuelve proyectiles y tajos hacia quien los lanzó, más rápido, y frena los golpes cuerpo a cuerpo dejando tambaleando al atacante. Acertar devuelve parte de la ventana y la recarga es corta; fallar cuesta 3 s. Reemplaza al contraataque que se mantenía.
- **Avance Imparable (Espacio).** Carga las piernas y sale despedido hacia donde apunta, apartando a quien se cruce. Mantener lo alarga. No da invulnerabilidad. Los perfiles guardados cambian el esquive compartido por esta embestida.
- **Cuerpo de Hierro (R, nuevo).** Un mandala rojo sube por el cuerpo: 6 s de menos daño recibido, sin empujes, sin cargas rotas ni aturdimientos, y cada golpe del mandoble manda su onda. Los perfiles guardados lo reciben en R si estaba libre.
- Tarda un instante en alcanzar su velocidad y en frenar.
- Práctica: un rival nuevo lanza Crecientes Escarlata cargadas, para cortarlas o devolverlas.
- El Guerrero revivido por un Nigromante devuelve proyectiles hacia quien los lanzó y lanza la creciente de un toque.
- Lugunica no cambia: la maza conserva su golpe y la parada su regla.

### Maná en la arena

- El Caballero y el Guerrero traen 100 de maná a la arena. Se ve como una barra azul bajo la vida y vuelve solo a 14 por segundo, 0,8 s después del último gasto. Las demás clases todavía no tienen habilidades que lo gasten.
- Los costos son datos de cada habilidad: lo que gasta al salir, lo mínimo para empezar y lo que gasta por segundo mientras se carga. Cargar nunca se come lo que cuesta soltar: sin maná para seguir, la carga se queda donde está.
- La Ráfaga de Acero cuesta 20 al salir y 15 por segundo de carga.
- Morir en la arena devuelve el maná lleno. Lugunica no cambia: el maná sigue siendo el del personaje.
- Controles de prueba: una franja **PRUEBAS** muestra el maná y permite apagar el límite de maná (todos los pozos quedan llenos) o recargarlo al instante. Está en la práctica y en las salas de servidores que no corren en producción.

### Puntería unificada

- Todas las habilidades leen una sola puntería, sin importar de dónde venga: el mouse, una palanca táctil, las flechas de Lugunica o, más adelante, un mando.
- En PC la puntería sigue al cursor en todo momento. Antes solo se recalculaba al mover el mouse: caminar con WASD sin moverlo dejaba el ángulo viejo y los disparos ya no iban al cursor.
- En celular, tocar el lado derecho libre de la pantalla hace aparecer una palanca de puntería bajo el pulgar. Solo apunta, nunca ataca. Al soltarla se conserva la última dirección, y moverse no la cambia.
- Arrastrar el botón de una habilidad sigue apuntándola, y Singularidad sigue yendo al punto del mapa que se toca.
- Cerca del borde de la arena, el punto de mira de una palanca queda sobre la dirección apuntada en vez de torcerse hacia el borde.

### Caballero: espadachín veloz

El Caballero deja el escudo. Ahora es el más rápido de la arena y se defiende moviéndose y cortando lo que le tiran. Versión de prototipo: la jugabilidad está completa, los efectos visuales y de sonido son provisorios.

- **Tres Cortes (clic).** El ataque básico es una cadena fija: dos cortes horizontales de derecha a izquierda y un remate vertical que es crítico si conecta. Un clic dado durante un corte queda en cola.
- **El golpe sigue a la hoja.** Se acabó el semicírculo de 180°: los horizontales barren 120° al frente y golpean primero a quien está a la derecha; el remate es una franja angosta y más larga. Nada detrás del Caballero recibe el golpe, y cada corte pega una vez por rival.
- **Carga por estados.** Mantener el clic carga el corte que toca: baja, media, alta y 100 %. Cada estado pega más y lanza un tajo más largo que sale de la hoja. La cadena espera mientras se carga.
- **Corte de habilidades según la carga.** Un toque apenas debilita un proyectil; al 100 % lo parte en el aire. Antes cualquier golpe de espada destruía lo que cruzaba, sin carga. El Guerrero conserva ese corte por ahora.
- **Ráfaga de Acero (clic derecho)** reemplaza a la guardia. Según la carga son tres cortes veloces, dos potenciados o uno devastador cuyo tajo parte habilidades. Recarga de 5 s.
- **Paso Relámpago (Espacio)** es la embestida de antes con otro nombre. Puede cortar la recuperación de un corte.
- **Furia y Despertar (R).** La Furia es un recurso: se llena al golpear y al cortar, se ve bajo la vida y se enfría si no se pelea. Llena, R despierta la espada 8 s: cada corte lanza su tajo y el daño sube 20 %. Ya no es una recarga de 15 s.
- Se quitan la guardia y el golpe de escudo. Q, E y F quedan libres. Los perfiles guardados se reparan solos: la Ráfaga ocupa el lugar de la guardia y se conserva la skin.
- El Caballero revivido por un Nigromante corta la flecha que le llega en vez de levantar el escudo.
- Lugunica no cambia: la espada del mundo conserva su tajo de siempre.

### Práctica

- El rival de práctica se elige en la barra: inmóvil, dispara flechas, lanza orbes cargados o ataca con espada. Sirve para probar cortes y, más adelante, el parry.

### Base de combate

Sistemas compartidos para el rediseño del Caballero y el Guerrero. Todavía no cambian cómo se juega ninguna clase.

- Tajos que viajan: un frente en forma de medialuna que sale de la hoja, puede ensancharse al avanzar, pierde daño con la distancia según una curva y golpea una vez a cada rival. Los muros le hacen sombra: quien se cubre detrás no lo recibe.
- Habilidad contra habilidad: cada ataque declara si se puede cortar, parar o devolver y cuánto resiste. Un corte con potencia suficiente lo parte; con menos, le quita esa parte del daño; con muy poca, solo saca chispas. Un tajo cortado queda con un hueco por donde pasó la hoja.
- El corte de proyectiles de la espada usa estas reglas y se comporta igual que antes.
- Recursos: las habilidades pueden declarar un costo y una ganancia de Furia o de maná. La Furia vive en la simulación, tiene tope y se enfría tras unos segundos sin pelear.
- Los golpes pueden traer su propio empuje y marcarse como críticos.
- Geometría de golpes cuerpo a cuerpo: barridos en arco y franjas, para que el área que golpea sea la que recorre la hoja.

### Correcciones

- La simulación local y los inputs que se envían al servidor avanzan en tiempo real a cualquier tasa de cuadros. Por debajo de 60 fps, el juego corría en cámara lenta durante sus primeros segundos y siempre que la página no tuviera el foco: las cargas tardaban de más y la predicción se atrasaba respecto del servidor.

## 2026-09-26

### Controles universales

- Todas las clases usan el mismo lenguaje de controles: WASD mueve, el mouse apunta, clic izquierdo es el ataque básico, clic derecho el secundario, Espacio la movilidad, Q y E las habilidades de uso frecuente, F la poderosa y R la definitiva.
- Cambios de tecla por clase:
  - Arquero: la salva triple pasa a Q y el cepo a E.
  - Mago: la saeta glacial pasa a Q, el escudo a E y Singularidad a F.
  - Nigromante: la invocación pasa a F y Espacio queda libre, porque no tiene movilidad propia. Mando queda en E y Marcar es clic derecho sobre un zombie; se acabó Ctrl+E.
  - Caballero: la Furia pasa a R.
- El panel de habilidades muestra siempre las siete posiciones (clic izq., clic der., Q, E, F, R y Espacio debajo) con la tecla real de cada una. Las posiciones vacías aparecen bloqueadas con «—».
- Debajo de la arena, una guía explica cómo se usa cada habilidad con las teclas del jugador.
- Las habilidades declaran qué dejan ocupado mientras cargan. La movilidad nunca se bloquea: el Mago puede parpadear mientras carga Singularidad y seguir cargándola. Cargar Singularidad ocupa los clics, pero deja libres Q y E. Las lentitudes de dos cargas no se suman.
- El Mago puede mantener el clic cargado, parpadear y soltarlo al aparecer. Los instantes de invulnerabilidad del Parpadeo ya no borran la carga, y disparar los termina.
- En celular, los botones que se apuntan arrastrando se lanzan al soltar, después de apuntar.
- Los perfiles guardados se migran solos a la nueva disposición: cada habilidad va a su posición nueva, los controles vuelven a las teclas universales y se conserva la skin.
- Todo queda preparado para el maná: una habilidad con costo lo muestra en su carta y aparece no disponible si no alcanza. Las arenas todavía no usan maná.
- Mando y Marcar ya funcionan aunque se esté manteniendo otra tecla (antes se perdían).

## 2026-09-25

### Juego e interfaz

- Singularidad se carga manteniendo su tecla, hasta 2 s. La carga define el tamaño inicial del agujero (28 a 80 u), su explosión (55 a 110 u, 0,75 a 2,25 de daño) y su alcance (140 a 420 u). Ya no inmoviliza al Mago: mientras carga camina a media velocidad y no ataca.
- Mientras carga Singularidad, todos ven un mandala violeta bajo el Mago que crece con el agujero. Quien la lanza ve además un corredor de puntería, estilo arquero, con el alcance y el área de la explosión.
- Al soltar, el agujero viaja hacia el cursor latiendo, se contrae y se expande sin parar. Estalla al tocar un muro, al volver a pulsar la tecla o tras 2,5 s atrayendo en su destino. La recarga empieza al soltar.
- Mientras el agujero está en juego, la carta de Singularidad (y su botón táctil) sigue activable y dice «Detonar»: volver a pulsarla lo implosiona. La recarga corre en paralelo y se ve en la esquina de la carta.
- Parpadeo también se carga manteniendo su tecla. El alcance crece de 60 u a 260 u en 2 s, y ya no hay teletransporte ilimitado al cursor. Nunca sale antes de 0,5 s: un toque espera ese mínimo y salta unas 110 u.
- Mientras se carga Parpadeo, todos ven un sello rúnico bajo el Mago, y ambas cargas suenan al empezar. Un aturdimiento o soltar sin lanzar (arrastrar el botón táctil de vuelta al centro) cancela la carga sin gastar la recarga.
- En Lugunica, los agujeros de Singularidad también estallan al tocar un muro. El Parpadeo con bastón sigue siendo instantáneo.
- La predicción local del jugador resuelve las teclas configuradas en cada cuadro, no solo al recibir el estado del servidor.

### Lugunica

- Seis ranuras de habilidades, con desbloqueos progresivos y migración de personajes guardados.
- El Mago con bastón usa Parpadeo con Espacio sin ocupar una ranura.
- Lluvia de Brasas cae sobre el punto apuntado dentro de su alcance, en vez de exigir que el enemigo esté junto al personaje.
- Singularidad aparece correctamente en el sorteo de habilidades raras y sus grimorios solo se ofrecen a personajes que pueden usarlos.
- El aviso de inactividad del mundo espera cinco minutos de forma predeterminada.

### Combate

- Singularidad consume instantáneamente a los enemigos que alcanzan su núcleo, incluso si tienen escudo o invulnerabilidad temporal. Conserva el tirón, la explosión final y el efecto de desintegración.

## 2026-09-24

### Juego e interfaz

- Singularidad en móvil conserva el punto del mapa elegido al arrastrar y soltar su botón. El objetivo ya no salta al borde de la arena.
- En duelo móvil, el reloj y los marcadores usan indicadores compactos. La barra superior deja de cubrir la arena y la vida queda debajo del reloj.
- Los espectadores ya no ven el selector de clase al terminar una partida.

### Pruebas

- Playwright usa servidores de prueba propios en los puertos 5174 y 2568, con el tiempo de inactividad configurado para la suite. No reutiliza la partida local abierta en 5173 y 2567.
- Se actualizaron las pruebas de navegador para los controles táctiles, el minimapa y las cinco habilidades del Mago. Una prueba nueva verifica el objetivo de Singularidad y el tamaño del reloj en móvil.
- Verificación de esta entrega: `npm run typecheck`, `npm run build`, `npm test` (450 pruebas) y `npm run test:browser` (37 pruebas), sin fallas.
