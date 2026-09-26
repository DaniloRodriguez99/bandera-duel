# Registro de cambios

## 2026-09-25

### Juego e interfaz

- Singularidad se carga manteniendo su tecla, hasta 2 s. La carga define el tamaño inicial del agujero (28 a 80 u), su explosión (55 a 110 u, 0,75 a 2,25 de daño) y su alcance (140 a 420 u). Ya no inmoviliza al Mago: mientras carga camina a media velocidad y no ataca.
- Mientras carga Singularidad, todos ven un mandala violeta bajo el Mago que crece con el agujero. Quien la lanza ve además un corredor de puntería, estilo arquero, con el alcance y el área de la explosión.
- Al soltar, el agujero viaja hacia el cursor latiendo, se contrae y se expande sin parar. Estalla al tocar un muro, al volver a pulsar la tecla o tras 2,5 s atrayendo en su destino. La recarga empieza al soltar.
- Parpadeo también se carga manteniendo su tecla. El alcance crece de 60 u a 260 u en 2 s, y ya no hay teletransporte ilimitado al cursor. Nunca sale antes de 0,5 s: un toque espera ese mínimo y salta unas 110 u.
- Mientras se carga Parpadeo, todos ven un sello rúnico bajo el Mago, y ambas cargas suenan al empezar. Un aturdimiento o soltar sin lanzar (arrastrar el botón táctil de vuelta al centro) cancela la carga sin gastar la recarga.
- Los agujeros de Singularidad de Lugunica también estallan al tocar un muro.
- La predicción local del jugador resuelve las teclas configuradas en cada cuadro, no solo al recibir el estado del servidor.

## 2026-09-24

### Juego e interfaz

- Singularidad en móvil conserva el punto del mapa elegido al arrastrar y soltar su botón. El objetivo ya no salta al borde de la arena.
- En duelo móvil, el reloj y los marcadores usan indicadores compactos. La barra superior deja de cubrir la arena y la vida queda debajo del reloj.
- Los espectadores ya no ven el selector de clase al terminar una partida.

### Pruebas

- Playwright usa servidores de prueba propios en los puertos 5174 y 2568, con el tiempo de inactividad configurado para la suite. No reutiliza la partida local abierta en 5173 y 2567.
- Se actualizaron las pruebas de navegador para los controles táctiles, el minimapa y las cinco habilidades del Mago. Una prueba nueva verifica el objetivo de Singularidad y el tamaño del reloj en móvil.
- Verificación de esta entrega: `npm run typecheck`, `npm run build`, `npm test` (450 pruebas) y `npm run test:browser` (37 pruebas), sin fallas.
