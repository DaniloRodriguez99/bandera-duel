# Validación de Bandera Duel

Fecha: 14 de septiembre de 2026. Entorno: Windows, Node 24.19.0, Chromium de Playwright.

| Comprobación                              | Resultado                                  |
| ----------------------------------------- | ------------------------------------------ |
| Compilación de shared, servidor y cliente | Correcta                                   |
| TypeScript estricto en los tres paquetes  | Sin errores                                |
| Pruebas de reglas                         | 17 aprobadas                               |
| Integración con clientes Colyseus reales  | 6 aprobadas                                |
| Pruebas de navegador                      | 3 aprobadas                                |
| Auditoría de dependencias                 | Sin vulnerabilidades reportadas al validar |

## Casos comprobados

- Recogida, caída, devolución propia y automática, bloqueo de recogida y capturas con ambas banderas robadas.
- Victoria por tres capturas, resultado por tiempo, empate, pausa de captura y revancha por acuerdo.
- Normalización y validación de entradas, bloqueo de coordenadas y daño enviados por cliente, secuencias antiguas y limitación del movimiento ante ráfagas de mensajes.
- Espada con preparación y recarga, bloqueo combinado de ataques, flechas que impactan y desaparecen, paredes, dash, daño, protección y reaparición.
- Inicio real de dos clientes, salas llenas, apodos inválidos y rechazo de orígenes HTTP no permitidos.
- Resultado idéntico en ambos clientes, reserva y reconexión de sesión con 150 ms de latencia simulada, pausa del reloj, abandono inmediato y expiración de los 15 segundos de reserva.
- Dos navegadores recorren tres capturas por teclado, ven el resultado, aceptan revancha y recuperan una sesión tras recargar.
- Chromium móvil emulado a 844 × 390: dos toques simultáneos, apuntado y disparo al soltar, cancelación de movimiento, botones de espada/dash y aviso al cambiar a vertical.
- Capturas de inicio, sala, victoria y móvil revisadas visualmente. Sin errores JavaScript de página en las pruebas de navegador.

## Límites de la validación

- No se probó un teléfono físico, Safari/iOS ni una conexión real entre distintas redes de Internet.
- No se desplegó en Vercel o Render ni se conectaron cuentas; se entregan configuración e instrucciones.
- No se hizo prueba de carga masiva ni se garantiza capacidad concreta de partidas simultáneas en el plan gratuito.
- Vite advierte sobre el tamaño del motor Phaser: aproximadamente 1,21 MB minificado, 332 KB con gzip. Se entrega en un chunk independiente; no bloquea la compilación.
- Los valores de combate requieren pruebas de diversión y balance con personas. La latencia se simuló para comprobar consistencia y reconexión, no para certificar igualdad competitiva entre dispositivos.

## Repetir las comprobaciones

```powershell
npm run build
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
```

Usar Node 24 LTS. Las pruebas de integración utilizan el puerto 2568; las de navegador, 2567 y 5173. Los recursos de prueba se guardan en `test-results/`.
