# Configuración para Deploy en Render — Variables de Entorno

Este archivo lista todas las variables de entorno que el servicio necesita para ejecutarse correctamente en Render (o en cualquier otro hosting). Incluye explicación, tipo/ejemplo y recomendaciones de seguridad.

IMPORTANTE: Nunca subas un `.env` con credenciales reales a un repositorio público. En Render debes configurar estas variables en la sección "Environment" del servicio.

## Variables obligatorias (producción)
- `DATABASE_URL` — URL de conexión a PostgreSQL (ejemplo: `postgresql://user:pass@host:5432/dbname?sslmode=require`).
  - Uso: conexión a la base de datos en producción (Neon, Heroku Postgres, etc.).
  - Ejemplo: `postgresql://neon_user:MYSECRET@ep-xxxx.neon.tech/dbname?sslmode=require`

- `JWT_SECRET` — Secreto largo para firmar JWT.
  - Uso: firmar/verificar tokens JWT.
  - Recomendación: generar al menos 32-64 bytes hex, por ejemplo: `openssl rand -hex 64`.
- `REFRESH_TOKEN_EXPIRES_IN` (opcional, ejemplo `7d`)
- `DB_SSL_REJECT_UNAUTHORIZED` = `0` o `1` según tu configuración de certificados
- `NODE_ENV` — `production` en Render.
  - Uso: activa comprobaciones de seguridad (e.g., requerir `SYSTEM_PASSWORD`).

Seguridad y cookies
-------------------
Cuando uses refresh tokens desde el servidor, recomendamos:

- Configurar `NODE_ENV=production` en Render — el servidor marcará la cookie `secure` cuando esté en producción.
- Asegurarse de que `JWT_SECRET` sea una cadena fuerte y única en producción.
- Si vas a servir el frontend desde otro dominio (cross-site), añade políticas CORS y considera CSRF para las rutas que dependen exclusivamente de cookies.

Datos de despliegue
- `SYSTEM_PASSWORD` — Contraseña del usuario `system` (obligatorio en producción).
  - Uso: permite al servidor asegurar/actualizar el usuario sistema sin exponer la contraseña en el código.
  - Recomendación: usar un valor fuerte y almacenarlo en las Environment variables del servicio Render.

## Variables recomendadas / opcionales
- `SYSTEM_USERNAME` — Nombre de usuario del actor sistema (por defecto `system`).
  - Útil si quieres otro nombre (ej. `lifasys`).

- `SYSTEM_EMAIL` — Email del usuario sistema (por defecto `system@lag.com`).

- `SYSTEM_ADMIN` — Nivel admin por defecto para el usuario sistema (por defecto `100`).

- `PORT` — Puerto en el que el servidor escucha (Render suele asignarlo automáticamente, pero la app lo respeta).

## Variables útiles para despliegue local (si no usas DATABASE_URL)
- `DB_DIALECT` — `postgres`.
- `DB_HOST` — host de la base de datos (ej: `localhost`).
- `DB_PORT` — puerto (ej: `5432`).
- `DB_USER` — usuario DB (ej: `postgres`).
- `DB_PASSWORD` — contraseña DB (ej: `root`).
- `DB_NAME` — nombre de la base de datos (ej: `lag`).

## Recomendaciones concretas para Render
1. En Render, crea un nuevo service (Web Service). En la pestaña Environment, añade estas variables (mínimo):
   - `DATABASE_URL` = (la URL que te proporciona Render o Neon)
   - `JWT_SECRET` = (generar un secreto fuerte)
   - `NODE_ENV` = production
   - `SYSTEM_PASSWORD` = (secreto fuerte, obligatorio)

2. Start Command: `npm start` (o `node server.js` si tu `package.json` no tiene `start`).

3. Build Command: si usas TypeScript o step de build, agrégalo; para este proyecto Node/Express normal no es necesario.

4. Seguridad: marca estas variables como "ENV var" (no secretos en código). Render encripta variables y las inyecta en runtime.

## Notas operativas
- En entornos de staging o CI puedes usar `NODE_ENV=development` para evitar requisitos estrictos (ej., `SYSTEM_PASSWORD` obligatorio).
- Si prefieres no usar una contraseña para el actor `system`, considera usar un secreto de tipo token o un servicio de identidad; puedo ayudarte a diseñar esa alternativa.

## Resumen de variables (tabla rápida)

| Variable | Obligatoria en prod | Tipo / Ejemplo |
|---|---:|---|
| DATABASE_URL | Sí | `postgresql://user:pass@host:5432/db?sslmode=require` |
| JWT_SECRET | Sí | `openssl rand -hex 64` |
| NODE_ENV | Sí | `production` |
| SYSTEM_PASSWORD | Sí (prod) | `muy-secreto-123!` |
| SYSTEM_USERNAME | No | `system` |
| SYSTEM_EMAIL | No | `system@lag.com` |
| SYSTEM_ADMIN | No | `100` |
| PORT | No | `3000` |
| DB_DIALECT, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME | No (si usas DATABASE_URL) | para desarrollo local |

Si quieres, genero además un archivo `render_setup.md` con capturas de los pasos en la UI de Render o una colección de comandos `render`/CLI.
