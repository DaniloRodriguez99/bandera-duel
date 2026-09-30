# Bandera Duel en Android

## Instalar y jugar

La entrega de prueba es `artifacts/bandera-duel-debug.apk`. Copiala al teléfono,
abrila y autorizá la instalación desde esa aplicación cuando Android lo solicite.
También se puede instalar por USB con `adb install -r artifacts/bandera-duel-debug.apk`.
Requiere Android 7 o posterior y un Android System WebView actualizado.

La app contiene el cliente y sus recursos. El mundo y las partidas online requieren
un servidor; el modo práctica funciona sin conexión al servidor.

1. En la PC, usá Node 24 y ejecutá `npm ci` y `npm run dev`.
2. En `.env`, agregá **`https://localhost`** a `ALLOWED_ORIGINS`, conservando los
   orígenes web existentes. Reiniciá el servidor después del cambio. Este es el
   origen del cliente Android, no la dirección del servidor.
3. Consultá la IPv4 de la PC con `ipconfig`. Con ambos dispositivos en la misma
   Wi-Fi, abrí **Servidor** en la app e ingresá `http://IP-DE-LA-PC:2567`.
4. Tocá **Comprobar y guardar**. Permití Node en el firewall de la red privada si
   fuera necesario. `localhost` en el teléfono apunta al propio teléfono.
5. Para jugar por Internet, ingresá la URL HTTPS del backend público. El backend
   también necesita permitir el origen exacto `https://localhost`.

La dirección queda guardada en el dispositivo. El engranaje dentro del juego
permite acceder a servidor y efectos; cambiar servidor exige salir de la partida.
La APK de prueba admite HTTP/WS. La distribución exige HTTPS/WSS.

Las invitaciones Android muestran un código, que se pega en **Ingresar código**.
También se aceptan enlaces web con `?sala=...`. Configurar `VITE_PUBLIC_WEB_URL`
durante la compilación permite compartir enlaces web en lugar de códigos.
Los enlaces no abren automáticamente la app: esta entrega usa ingreso manual.

## Compilar

Requisitos: Node 24, JDK 21, Android SDK 36 y conexión para descargar dependencias
de Gradle. Configurar `ANDROID_HOME` y `JAVA_HOME` si no están en las ubicaciones
habituales de Windows. El Gradle Wrapper está incluido.

```powershell
npm ci
npm run android:sync   # Compila cliente y sincroniza el proyecto nativo
npm run android:apk    # Además compila y entrega artifacts/bandera-duel-debug.apk
```

En este equipo se preparó un Node 24 local, sin cambiar el global:
`./.tools/node_modules/node/bin/node.exe scripts/android.mjs apk`.
Ese directorio es una herramienta local ignorada por Git; otros equipos deben
instalar Node 24 por su cuenta.

`VITE_SERVER_URL` es el servidor inicial opcional; la elección guardada por el
usuario tiene prioridad en Android. Web conserva su configuración habitual.
La URL debe ser la raíz del backend, sin rutas, credenciales ni parámetros.

## Distribución

Identificador inicial: `com.banderaduel.app`. Nombre: **Bandera Duel**.
La APK debug se firma automáticamente para pruebas; no es la firma de publicación.
Para producir el AAB, establecer mediante el entorno seguro de compilación:

- `ANDROID_KEYSTORE`: ruta absoluta del keystore del propietario.
- `ANDROID_KEYSTORE_PASSWORD`: contraseña del almacén.
- `ANDROID_KEY_ALIAS`: alias de la clave.
- `ANDROID_KEY_PASSWORD`: contraseña de la clave.

Ejecutar `npm run android:bundle`. El script exige las cuatro variables, recompila
el cliente sin permitir conexiones inseguras y entrega
`artifacts/bandera-duel-release.aab`. No guarda secretos en archivos del repositorio.
Conservar la clave para futuras actualizaciones e incrementar `versionCode` antes
de cada publicación. No se creó una clave de producción ni se publicó en tiendas.

## Animaciones y opciones

Jugadores: ocho direcciones, seis cuadros de caminar y dos de reposo. Los atlas
se crean una vez por apariencia utilizada. La distancia recorrida gobierna la
animación; las armas siguen apuntando independientemente del movimiento.
Skins y apariencias por arma conservan sus colores. Criaturas conservan su arte.

**Pantalla y efectos** permite elegir Normal/Baja y desactivar las sacudidas.
Baja reduce a la mitad las partículas del nuevo sistema, con un máximo de 96
frente a 192 en Normal. Las señales de habilidades y los efectos previos permanecen
visibles. Se respeta la preferencia de reducción de movimiento del dispositivo.

## Verificación

Resultados y límites de la validación de esta entrega en `MOBILE-VALIDATION.md`.
Para repetir la lógica: `npm test`. Para navegador:
`npx playwright test tests/browser/mobile-visuals.spec.ts tests/browser/practice.spec.ts tests/browser/classes.spec.ts tests/browser/world-keyboard.spec.ts`.
