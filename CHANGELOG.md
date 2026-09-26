# Registro de cambios

## 2026-09-25

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
