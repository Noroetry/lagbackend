DEVELOPMENT GUIDE — LifeAsGame backend (lagbackend)

Última actualización: 2025-11-04
Propósito: documento para que cualquier desarrollador (tú) entienda la arquitectura, estructura de archivos, flujos principales, variables de entorno, cómo ejecutar, testear y desplegar la aplicación.

Índice
- Visión general
- Tecnologías y dependencias
- Estructura del proyecto (archivo por archivo)
- Configuración local (env, BD, seeds)
- Cómo ejecutar (dev / prod)
- Auth / JWT flow explicado
- Modelo Mensajes (Message) y flujo CRUD
 - Seeder `system`
- Tests y cómo ejecutarlos
- Despliegue en Render — checklist y variables
- Notas operativas y recomendaciones
- Cómo añadir la entidad `Quest` (guía rápida)


Visión general
---------------
Este es un backend Node.js/Express que usa Sequelize como ORM sobre PostgreSQL. Proporciona:
- Registro/login de usuarios (JWT)
- API de mensajes entre usuarios (modelo `Message`) con inbox/sent, marcar leído, cambiar estado, borrado suave
- Seeder/actor `system` encargado de enviar el mensaje de bienvenida
- Configuración pensada para funcionar con `DATABASE_URL` (Neon/Render) o con variables DB_* en local


Tecnologías y dependencias
-------------------------
- Node.js (JS)
- Express (v5)
- Sequelize (ORM) + `pg` y `pg-hstore`
- jsonwebtoken (JWT)
- bcryptjs (hash de contraseñas)
- dotenv (solo en dev)
- express-validator (validaciones)
- nodemon (dev)
- axios (tests ad-hoc)


Estructura del proyecto (archivo por archivo)
--------------------------------------------
Raíz:
- `package.json` — scripts y dependencias.
- `server.js` — punto de entrada. Autentica DB, sincroniza modelos, opcionalmente ejecuta seeder, y arranca Express.
 - `server.js` — punto de entrada. Autentica DB, sincroniza modelos y arranca Express. (Nota: ya no ejecuta seeds automáticamente en el arranque.)
- `.env` (NO subirlo) / `.env.example` — variables de entorno para dev.
- `DEVELOPMENT.md` — este documento.
- `CONFIG_RENDER.md` — notas específicas para Render (variables env, recomendaciones).

Carpeta `src/`:
- `app.js` — configura Express (body parsers, rutas, 404). Exporta `app` para tests y `server.js` lo usa para listen.

- `config/`:
  - `database.js` — inicializa Sequelize. Prefiere `DATABASE_URL` si está presente. Ajusta `dialectOptions.ssl` para providers que lo requieren (Neon). Carga modelos automáticamente desde `src/models`.

- `models/`:
  - `User.js` — modelo User (username, email, password, admin). Hook `beforeCreate` para hashear password y método `comparePassword`.
  - `Message.js` — modelo Message (title, description, source, destination, adjunts, read, dateRead, dateSent, state).
  - Si agregas `Quest.js`, pondrás el modelo aquí.

- `controllers/`:
  - `userController.js` — handlers HTTP para login, registro (`createUser`), obtener perfil (`getMe`), listar usuarios (`getAllUsers`) y obtener por id.
  - `messageController.js` — handlers para enviar mensajes, inbox/sent, ver/leer/cambiar estado, borrado suave.

- `services/`:
  - `userService.js` — lógica de negocio de usuarios (login, createUser, getUserById). Se encarga de interactuar con modelos.
  - `messageService.js` — lógica de negocio de mensajes (createMessage, getInbox, markRead, changeState, soft delete).

- `routes/`:
  - `userRoutes.js` — rutas `/api/users/*` y validadores aplicados.
  - `messageRoutes.js` — rutas `/api/messages/*`.

- `middlewares/`:
  - `authMiddleware.js` — verifica JWT, adjunta `req.user` o `req.userId` y controla errores 401.
  - `validators.js` — wrappers de `express-validator` con fallback cuando la dependencia no esté instalada (permite arranque). Define validadores por endpoint.

- `utils/`:
  - `logger.js` — logger centralizado simple con niveles `info`, `warn`, `error`, `debug` (debug visible solo en dev). Úsalo en lugar de `console.*`.

- `scripts/`:
  - `seed-system.js` — seeder/asegurador del usuario `system`. Exporta una función async `ensureSystemUser()` que crea/actualiza `system` basándose en `SYSTEM_*` env vars.
  - `validate-deploy.js` — script para verificar variables antes de deploy (opcional).

- `tests/`:
  - `messages.test.js` — test de integración ad-hoc que usa `axios` para crear usuarios, logins y comprobar todo el flujo de mensajes.
  - Otros tests: `auth.test.js`, `authToken.test.js` (si existen en el repo).


Configuración local (env, DB, seeds)
-----------------------------------
Archivo `.env` (ejemplo en el repo): contiene variables para desarrollo.
Variables críticas:
- `DATABASE_URL` — si lo tienes, es preferible (Neon, Render). Formato: `postgresql://user:pass@host:5432/db?sslmode=require`
- `DB_*` — host, port, user, password, name (si no usas `DATABASE_URL`)
- `JWT_SECRET` — secreto para firmar tokens
- `NODE_ENV` — `development` o `production`
-- `SYSTEM_USERNAME`, `SYSTEM_EMAIL`, `SYSTEM_PASSWORD`, `SYSTEM_ADMIN` — controlan el usuario `system` (opcional)

Cómo inicializar localmente (rápido)
1) Instalar dependencias:
```powershell
npm install
```
2) Asegúrate de tener PostgreSQL accesible o `DATABASE_URL` apuntando a Neon/local.
3) Crear `.env` basándote en `.env.example`.
4) Ejecutar server en dev (con nodemon):
```powershell
npm run dev
```
o para arrancar normal:
```powershell
node server.js
```

Notas: por ahora el proyecto usa `sequelize.sync({ alter: true })` en `server.js` para sincronizar esquemas al inicio. Esto está bien en dev pero en producción se recomienda usar migraciones controladas.


Auth / JWT flow explicado
-------------------------
- Registro (`POST /api/users/create`): el `userController.createUser` llama a `userService.createUser` que crea el registro (password hasheado). Al finalizar se genera un token JWT y se devuelve `{ message, user, token }`.
- Login (`POST /api/users/login`): `userController.login` pide `userService.login` que compara password (bcrypt); si ok devuelve user y `login` genera un JWT (`jsonwebtoken`) con payload `{ id, username, email, admin }` y expiración `1h`.
- Rutas protegidas: `authMiddleware.protect` busca un header `Authorization: Bearer <token>`, lo verifica con `JWT_SECRET`. Si válido, adjunta `req.user` (contenido del token) y/o `req.userId` para su uso en handler.

Tokens y seguridad:
- `JWT_SECRET` debe ser fuerte (mínimo 32-64 bytes hex). En producción guardarlo en env vars del host (Render).
- El token expira en 1 hora: cliente debe refrescar/relogear según su lógica.


Modelo Mensajes (Message) y flujo CRUD
--------------------------------------
- Campos principales: `title`, `description`, `source`, `destination`, `adjunts`, `read` (N/S), `dateRead`, `dateSent`, `state` (A: active, R: archived, D: deleted)
- Envío (`POST /api/messages/send`): `messageController.sendMessage` valida que existe `destination`, crea mensaje con `source` = username del emisor (o id según diseño). Devuelve el registro creado.
- Inbox (`GET /api/messages/inbox`) y Sent (`GET /api/messages/sent`) filtran por `destination` y `source` respectivamente y respetan `state !== 'D'`.
- Mark read (`PATCH /api/messages/:id/read`): solo el destinatario puede marcar, se setea `read='S'` y `dateRead`.
- Change state (`PATCH /api/messages/:id/state`): permite `R` (archive) y otras transiciones, con permisos.
- Delete (`DELETE /api/messages/:id`): soft-delete — cambia `state` a `D` si quien solicita es emisor o destinatario según reglas.


Seeder `system`
-----------------------------------
- `scripts/seed-system.js` contiene `ensureSystemUser()` como herramienta opcional para crear o actualizar el usuario `system` si lo deseas ejecutar manualmente.
- El servidor ya no ejecuta el seeder automáticamente en el arranque. En su lugar, los mensajes de bienvenida se generan dinámicamente cuando un nuevo usuario se registra: el `userService.createUser` crea un `Message` cuyo campo `source` es la cadena literal `'system'` (firma del servidor).

Recomendación: si necesitas garantizar la existencia de una cuenta `system` en la BD por otros motivos, ejecuta el seeder manualmente como job one-off o desde CI en vez de automatizarlo en cada inicio del servidor.

Cómo ejecutar el seeder manual (opcional):
```powershell
node -e "require('./scripts/seed-system')().then(()=>console.log('Seed OK')).catch(e=>{console.error(e); process.exit(1)})"
```


Tests y cómo ejecutarlos
-----------------------
- Los tests actuales son scripts Node ad-hoc (no framework): por ejemplo `tests/messages.test.js`. Ejecutarlos:
```powershell
npm run test:messages
```
- Recomendación a medio plazo: migrar a Jest/Mocha y convertir estos scripts en tests automáticos con asserts y setup/teardown de DB.


Despliegue en Render — checklist y variables
-------------------------------------------
Variables obligatorias en Render (mínimas):
- `DATABASE_URL` = postgres url (ej: `postgresql://user:pass@host:5432/db?sslmode=require`)
- `JWT_SECRET` = secreto para JWT
- `NODE_ENV` = production

Variables opcionales pero recomendadas:
- `SYSTEM_PASSWORD` = contraseña del usuario `system` (si quieres usar el seeder manualmente o conservar la cuenta `system` en la BD)
- `SYSTEM_USERNAME`, `SYSTEM_EMAIL`, `SYSTEM_ADMIN`

Start command en Render: `npm start`
Build command: (vacío; no hay build step JS puro)

Pasos:
1. Conectar repo en Render y configurar Environment Variables listadas.
2. Deployar (Render hace pull y ejecuta `npm start`).
3. Verificar logs y endpoint raíz (`/`).


Notas operativas y recomendaciones
---------------------------------
- Reemplazar `sequelize.sync({ alter: true })` por migraciones (sequelize-cli) para producción.
- Sustituir todos los `console.*` restantes por `src/utils/logger.js` para consistencia.
- Configurar un runner de tests con Jest y CI (GitHub Actions) para validar PRs.
- Añadir rate-limiting y protección contra brute-force en endpoints de login si la app va a producción real.


Cómo añadir la entidad `Quest` (guía rápida)
--------------------------------------------
1. Crear modelo: `src/models/Quest.js` con campos necesarios (title, description, reward, status, assignedTo, progress, dates, etc.).
2. Asociaciones (si aplica) en `models/` y registrar en `src/config/database.js` (ya lee todos los modelos automáticamente).
3. Crear servicio `src/services/questService.js` con lógica CRUD y reglas de negocio.
4. Crear controller `src/controllers/questController.js` con endpoints REST.
5. Crear rutas `src/routes/questRoutes.js` y montarlas en `src/app.js` (ej: `app.use('/api/quests', questRoutes)`).
6. Añadir validaciones en `src/middlewares/validators.js` o nueva validación.
7. Añadir tests en `tests/` para el flujo de quests.


Troubleshooting común
---------------------
- Error `Cannot find module 'express-validator'`: ejecutar `npm install` (o revisar `node_modules`).
- Error de JWT `invalid signature`: comprobar `JWT_SECRET` coincide entre emisor/verificador.
- Error DB connection: revisar `DATABASE_URL` o `DB_*` en `.env`, y revisar que `dialectOptions.ssl` está correcto para tu proveedor.
- Error `logger is not defined` en controllers: asegurarse que `const logger = require('../utils/logger')` está presente en el archivo.


Siguientes pasos sugeridos (prioridad)
-------------------------------------
1. Migrar tests a Jest y añadir script `npm test`.
2. Reemplazar `sync({ alter: true })` por migraciones con `sequelize-cli`.
3. Sweep: sustituir `console.*` por `src/utils/logger.js` si quedan.
4. Añadir CI (GitHub Actions) para run tests/lint en PRs.
5. Plan y esquema para `Quest` (modelo de datos y endpoints) — puedo implementarlo si me das los campos.


Contacto y cómo continuar
-------------------------
-- Si quieres, genero un `render.yaml` para infra-as-code o hago los cambios: (A) crear `scripts/run-seed.js` para ejecutar el seeder manualmente, (B) ajustar `logging` de Sequelize a `false`, o (C) implementar el modelo `Quest` completo con tests.

---
Archivo generado automáticamente por el asistente para ayudarte a navegar y continuar con este proyecto. Si quieres que amplíe alguna sección (ej: diagramas, endpoints detallados con request/response, o tests unitarios), dime cuál y lo añado.
