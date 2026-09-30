# Registro de cambios

## 2026-09-30

### Puntería unificada

- Todas las habilidades leen una sola puntería, sin importar de dónde venga: el mouse, una palanca táctil, las flechas de Lugunica o, más adelante, un mando.
- En PC la puntería sigue al cursor en todo momento. Antes solo se recalculaba al mover el mouse: caminar con WASD sin moverlo dejaba el ángulo viejo y los disparos ya no iban al cursor.
- En celular, tocar el lado derecho libre de la pantalla hace aparecer una palanca de puntería bajo el pulgar. Solo apunta, nunca ataca. Al soltarla se conserva la última dirección, y moverse no la cambia.
- Arrastrar el botón de una habilidad sigue apuntándola, y Singularidad sigue yendo al punto del mapa que se toca.
- Cerca del borde de la arena, el punto de mira de una palanca queda sobre la dirección apuntada en vez de torcerse hacia el borde.

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
