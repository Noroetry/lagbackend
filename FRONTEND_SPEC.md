# Especificación para Frontend (Flutter)

Este documento resume los endpoints, contratos, ejemplos y buenas prácticas para integrar el frontend con el backend `lagbackend`. Está en español y evita detalles de paginación (no implementada todavía).

## Resumen rápido
- Base URL (dev): http://localhost:3000
- Rutas base:
  - Autenticación/usuarios: `/api/users`
  - Mensajes: `/api/messages` (todas protegidas por JWT salvo registro y login)
- Autenticación: JWT (Bearer token). El backend devuelve `{ user, token }` en login/registro.
- Guardar token: usar `flutter_secure_storage` (clave: `jwt` o similar). Incluir en header `Authorization: Bearer <token>`.
- Tiempo de vida del token: 1 hora. No hay refresh token implementado por ahora.

---

## Estructura de usuario que devuelve el backend
Ejemplo (campo `user`):
```json
{
  "_id": "7",
  "username": "alice",
  "email": "alice@example.com",
  "admin": 0,
  "messages": [ /* lista de mensajes (inbox+sent) */ ]
}
```
 - `_id`: string (id numérico como string).
 - `admin`: entero (0..100). Valores más altos representan más privilegios administrativos. 100 = super-admin del sistema.
- `messages`: array opcional incluido en respuestas de login/registro; contiene mensajes relacionados (source o destination = username).

---

## Token handling (frontend)
- Al `login` o `register`:
  1. Guardar el `token` de la respuesta en `flutter_secure_storage`.
  2. Guardar datos mínimos del `user` en estado (ej. username, _id, email, admin).
- En cada petición protegida: añadir header `Authorization: Bearer <token>`.
- Cuando el servidor responde 401: borrar token local y redirigir a login.
- Nota: el token expira en 1h; por ahora la app debe pedir re-login cuando reciba 401.

---

## Modelo de Message (campos relevantes)
- `id`: entero.
- `title`: string.
- `description`: texto.
- `source`: username emisor.
- `destination`: username receptor.
- `adjunts`: texto (se permiten attachments codificados en base64, si se usa).
- `read`: 'S' o 'N' (S = leído, N = no leído).
- `dateRead`: fecha o null.
- `dateSent`: fecha.
- `state`: char: 'A' = Activo (por defecto), 'R' = Archivado, 'D' = Eliminado (soft-delete).

---

## Endpoints principales (contratos y ejemplos)
Nota: todas las rutas de mensajes requieren Authorization salvo indicado.

### Autenticación / Usuarios

1) Registro
- Método: POST
- URL: `/api/users`
- Auth: No
- Body JSON:
```json
{ "username": "alice", "email": "alice@example.com", "password": "secret" }
```
- Respuesta 201 (ejemplo):
```json
{
  "user": { "_id":"7", "username":"alice", "email":"alice@example.com", "admin":0, "messages":[] },
  "token": "<jwt>"
}
```
- Errores: 400 = missing/invalid fields, 409 = username/email exist

2) Login
- Método: POST
- URL: `/api/users/login`
- Auth: No
- Body JSON:
```json
{ "usernameOrEmail": "alice", "password": "secret" }
```
- Respuesta 200 (ejemplo):
```json
{
  "user": { "_id":"7", "username":"alice", "email":"alice@example.com", "admin":0, "messages":[] },
  "token": "<jwt>"
}
```
- Errores: 401 = credenciales inválidas

3) Obtener perfil propio
- Método: GET
- URL: `/api/users/me`
- Auth: Sí (Bearer token)
- Respuesta 200:
```json
{ "_id":"7", "username":"alice", "email":"alice@example.com", "admin":0 }
```

---

### Mensajes
Todas las rutas siguen la convención de usar `req.user.username` como `source` cuando corresponde. El `Authorization` debe incluir el token.

1) Enviar mensaje
- Método: POST
- URL: `/api/messages/send`
- Auth: Sí
- Body JSON (ejemplo):
```json
{
  "title": "Hola",
  "description": "Te escribo para...",
  "destination": "bob",
  "adjunts": "<opcional base64>"
}
```
- Respuesta 201 (ejemplo):
```json
{
  "id": 12,
  "title": "Hola",
  "description": "Te escribo para...",
  "source": "alice",
  "destination": "bob",
  "adjunts": null,
  "read": "N",
  "dateSent": "2025-10-28T12:34:56.000Z",
  "state": "A"
}
```
- Notas: el backend valida que `destination` exista. 400 = mal formato, 404 = destino no encontrado.

2) Bandeja (inbox)
- Método: GET
- URL: `/api/messages/inbox`
- Auth: Sí
- Query params soportados actualmente: ninguno obligatorio (si más adelante agregamos `unreadOnly=true`, se documentará).
- Respuesta 200 (ejemplo):
```json
[
  { "id":12, "title":"Hola", "source":"alice", "destination":"bob", "read":"N", "dateSent":"...", "state":"A" }
]
```

3) Enviados (sent)
- Método: GET
- URL: `/api/messages/sent`
- Auth: Sí
- Respuesta 200: lista de mensajes enviados por el usuario.

4) Obtener mensaje por id
- Método: GET
- URL: `/api/messages/:id`
- Auth: Sí
- Respuesta 200 (ejemplo): objeto completo del mensaje.
- Errores: 403 si el usuario no es ni `source` ni `destination`, 404 si no existe.

5) Marcar como leído
- Método: PATCH
- URL: `/api/messages/:id/read`
- Auth: Sí
- Body: opcional
- Respuesta 200: mensaje actualizado con `read: 'S'` y `dateRead` seteada.
- Notas: sólo `destination` puede marcar como leído.

6) Cambiar estado (ej. archivar)
- Método: PATCH
- URL: `/api/messages/:id/state`
- Auth: Sí
- Body JSON:
```json
{ "state": "R" }
```
- Respuesta 200: mensaje actualizado con nuevo state (`A`,`R`,`D`).
- Notas: sólo `source` o `destination` pueden cambiar el estado del mensaje.

7) Soft-delete (eliminar)
- Método: DELETE
- URL: `/api/messages/:id`
- Auth: Sí
- Comportamiento: se marca `state: 'D'` (soft delete).
- Respuesta 200: confirma `state` cambiado.

---

## Códigos de estado importantes
- 200: OK
- 201: Creado
- 400: Bad Request (validación)
- 401: Unauthorized (token faltante/expirado/mal)
- 403: Forbidden (operación no permitida sobre recurso ajeno)
- 404: Not Found
- 500: Error interno

---

## Buenas prácticas en frontend (Flutter)
- Guardar token en `flutter_secure_storage` y no en almacenamiento inseguro.
- Mantener `currentUser` en memoria (Provider/Bloc/riverpod), usar `user.username` como id lógico para mensajes.
- En peticiones protegidas, incluir Authorization header. Si recibes 401:
  - Borrar token local.
  - Redirigir al usuario a login.
- Para badge de mensajes nuevos: consultar `/api/messages/inbox` y contar `read: 'N'`. Si necesitas optimización, podemos agregar endpoint `/api/messages/unread/count` más adelante.
- Para attachments: si usas `adjunts` base64, limita tamaño (recomendado: < 2-3MB); mejor alternativa: subir a storage y enviar URL.
- Manejo UI:
  - Al enviar mensaje: mostrar feedback inmediato (optimistic update) y refrescar la bandeja.
  - Al marcar leído: actualizar localmente `read` y `dateRead` tras confirmación del servidor.
  - Respetar permisos: si el backend devuelve 403, mostrar mensaje "No tienes permisos".

---

## Ejemplo de flujo mínimo en la app
1. Login -> guarda token + user
2. Llamada GET `/api/messages/inbox` -> listar mensajes
3. Usuario abre mensaje -> GET `/api/messages/:id` (si no se hace, usar la data de la lista), si es `destination` llamar PATCH `/api/messages/:id/read`
4. Usuario responde -> POST `/api/messages/send`

---

## Errores comunes y recomendaciones
- 401 por reloj desincronizado improbable; normalmente es token expirado/invalid. Detectar y forzar re-login.
- Validación de campos en frontend: siempre validar `destination` (no vacío), `title` y `description` antes de enviar.
- Para pruebas locales: asegúrate de usar el server corriendo en `http://localhost:3000` y de usar usuarios existentes.

---

Si quieres que guarde esto también en `docs/` o que genere una versión en inglés, lo hago ahora. ¿Quieres que además genere ejemplos listos para pegar en Postman (collection) o prefieres la hoja CSV que voy a añadir al repo? 
