# Valeria XV · Disco Aloha — Invitación digital

Invitación web (una sola página) con **lista automática de confirmaciones**.
Lista para desplegar en **Railway** desde **GitHub**.

```
valeria-invitacion/
├── public/
│   ├── index.html        ← la invitación (autocontenida)
│   ├── assets/           ← acuarelas (webp)
│   └── preview.jpg       ← portada para WhatsApp / redes
├── server.js             ← servidor Node + API de confirmaciones
├── package.json          ← npm start · dependencia: pg
└── railway.json
```

## 1) Configura tus datos
Abre `public/index.html`, busca `const EVENT = {` y edita:
- `whatsapp`: número con código de país, sin `+` ni espacios. Ej: `"584141234567"`.
- `mapsUrl`: enlace de Google Maps del lugar.
- `year`: confirma el año (por defecto `2026`).

## 2) Sube el proyecto a GitHub
Desde esta carpeta (ya viene con un commit inicial):
```bash
git remote add origin https://github.com/TU-USUARIO/valeria-invitacion.git
```
```bash
git push -u origin main
```
(Primero crea el repositorio vacío en https://github.com/new con el nombre `valeria-invitacion`.)

## 3) Despliega en Railway
1. En https://railway.app → **New Project → Deploy from GitHub repo** → elige `valeria-invitacion`.
   Railway detecta Node y ejecuta `npm start` automáticamente.
2. **Agrega la base de datos**: dentro del proyecto → **New → Database → PostgreSQL**.
   Railway inyecta `DATABASE_URL` en tu servicio automáticamente.
3. **Define la clave del panel**: en el servicio → **Variables** → agrega
   `ADMIN_KEY` con un valor secreto (ej. `valeria-2026-xyz`).
4. En **Settings → Networking → Generate Domain** para obtener la URL pública.

Redeploy si hace falta. Tu invitación quedará en algo como
`https://valeria-invitacion-production.up.railway.app`.

## 4) Ver las confirmaciones (lista automática)
Abre en tu navegador:
```
https://TU-DOMINIO.up.railway.app/panel?key=TU_ADMIN_KEY
```
Verás la lista en vivo (nombre, si asiste, mensaje, fecha) y los totales.
Guárdalo en favoritos. Nadie puede verlo sin la clave.

> Cómo funciona: al confirmar, la invitación guarda la respuesta vía
> `POST /api/rsvp` en Postgres **y** abre WhatsApp con el mensaje listo.
> Si aún no agregaste Postgres, el sitio funciona igual y el RSVP usa solo
> WhatsApp (no se pierde ninguna confirmación enviada por ese medio).

## 5) Vista previa en WhatsApp (opcional)
Para que al pegar el enlace salga la portada de la invitación, edita en
`public/index.html` las etiquetas `og:image` y `twitter:image` y reemplaza
`preview.jpg` por la URL completa, por ejemplo
`https://TU-DOMINIO.up.railway.app/preview.jpg`, y vuelve a desplegar.

## Probar localmente
```bash
npm install
```
```bash
npm start
```
Abre http://localhost:3000. (Sin `DATABASE_URL` el RSVP responde pero no guarda;
para probar con base, exporta `DATABASE_URL` y `ADMIN_KEY` antes de `npm start`.)
