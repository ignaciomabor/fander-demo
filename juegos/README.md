# Mesa de Juegos

Juegos de mesa para jugar en grupo, cada uno desde su móvil. El admin crea la sala y los demás entran escaneando un QR.

- **Palabras Espía** (4+ jugadores): dos equipos, 25 palabras y un jefe de espías que da pistas.
- **El Tirano Oculto** (5–10): leales contra conspiradores con un líder oculto.
- **Cronohits** (2–12): escucha la canción y colócala en tu línea temporal por año.

## Cómo se juega

1. El admin abre `https://ignaciomabor.github.io/fander-demo/juegos/` y pulsa **Crear sala**.
2. Los demás escanean el QR (o entran en la web y ponen el código de 5 letras).
3. El admin elige el juego y pulsa **Empezar**.

El móvil del admin dirige la partida: debe tener la web abierta. Si se bloquea o se recarga, todo sigue donde estaba al volver.
En Cronohits la música suena en el móvil del admin (mejor conectado a un altavoz).

## Arquitectura

- Web estática (HTML + JS sin compilar) publicada en GitHub Pages.
- Tiempo real con **4 servidores MQTT públicos a la vez** (si uno cae, siguen los demás).
- El móvil del admin es la autoridad: valida jugadas y manda a cada jugador solo lo que puede ver.
- Mensajes **cifrados** entre cada jugador y el admin (ECDH + AES-GCM): nadie ve los roles de otro.
- Estado guardado en el navegador: recargar no rompe nada. Un jugador que cambia de móvil recupera su sitio.
- Audio de Cronohits: fragmentos de 30 s de iTunes o Deezer.

## Pruebas

```
node --test juegos/tests/engines.test.mjs
```

## Créditos

- La mecánica de *El Tirano Oculto* adapta las reglas de *Secret Hitler* (Goat, Wolf & Cabbage), publicadas bajo licencia
  [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Este juego se comparte con la misma licencia y sin uso comercial.
- Librerías incluidas en `vendor/`: MQTT.js (MIT), qrcode-generator (MIT), Preact + htm (MIT / Apache-2.0).
