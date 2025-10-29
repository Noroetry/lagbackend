# LAG Backend - Manual de Pruebas

Este documento describe cómo probar manualmente el sistema de autenticación del backend.

## Requisitos Previos

- Postman o similar para realizar peticiones HTTP
- El servidor backend debe estar en ejecución (`npm start`)
- Base de datos configurada y en funcionamiento

## Endpoints para Pruebas

### 1. Registro de Usuario
```http
POST http://localhost:3000/api/users/create
```
```json
{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!"
}
```
**Pruebas a realizar:**
- ✓ Registro exitoso (debe devolver token y datos de usuario)
- ✓ Intentar registro con email duplicado
- ✓ Intentar registro con username duplicado
- ✓ Intentar registro sin campos requeridos

### 2. Login de Usuario
```http
POST http://localhost:3000/api/users/login
```
```json
{
    "usernameOrEmail": "test@example.com",
    "password": "Test123!"
}
```
**Pruebas a realizar:**
- ✓ Login con email
- ✓ Login con username
- ✓ Login con credenciales incorrectas
- ✓ Login con usuario no existente

### 3. Obtener Usuario por ID (Ruta Protegida)
```http
GET http://localhost:3000/api/users/getById/{id}
Headers:
Authorization: Bearer {token}
```
**Pruebas a realizar:**
- ✓ Acceso con token válido
- ✓ Acceso con token expirado
- ✓ Acceso sin token
- ✓ Acceso con token inválido

## Verificación de Logs

Los logs del sistema están categorizados por componente:

- `[UserController]` - Logs de los controladores
- `[UserService]` - Logs de los servicios
- `[AuthMiddleware]` - Logs del middleware de autenticación

Para cada prueba, verifica que los logs correspondientes aparezcan en la consola del servidor.

## Pruebas de Integración con Flutter

### 1. Almacenamiento del Token
```dart
// En Flutter, verifica el almacenamiento correcto:
final storage = FlutterSecureStorage();
final token = await storage.read(key: 'auth_token');
print('Token almacenado: $token');
```

### 2. Validación de Sesión
1. Inicia sesión en la app
2. Cierra la app completamente
3. Vuelve a abrir la app
4. Verifica que la sesión se mantiene

### 3. Manejo de Errores
1. Espera a que el token expire (1 hora)
2. Intenta realizar una operación protegida
3. Verifica que la app maneja correctamente la expiración

## Monitoreo y Debugging

Para un monitoreo detallado durante las pruebas:

1. Inicia el servidor con logs detallados:
```bash
npm start
```

2. Observa la consola del servidor durante las pruebas
3. Verifica que cada operación genera los logs esperados
4. Busca patrones en los logs en caso de errores

## Resolución de Problemas

### Tokens Inválidos
Si recibes "token inválido" inesperadamente:
1. Verifica que el token está correctamente formateado con "Bearer "
2. Confirma que el token no ha expirado
3. Revisa los logs del servidor para más detalles

### Errores de Autenticación
Si las credenciales son rechazadas:
1. Verifica los logs de `[UserService]` para ver si el usuario existe
2. Confirma que la contraseña cumple con los requisitos
3. Revisa si hay errores en la base de datos

## Contacto

Si encuentras algún problema o tienes preguntas, por favor crea un issue en el repositorio.

## Despliegue en Render

Esta sección explica cómo desplegar este proyecto en Render usando un repositorio en GitHub.

1. Crea un repositorio en GitHub y sube tu código (ver sección "Crear remoto GitHub" abajo).
2. Entra a https://render.com y crea una cuenta si no tienes.
3. Haz clic en "New" -> "Web Service" -> conecta tu cuenta de GitHub y selecciona el repositorio.
4. En "Build Command" deja vacío (por defecto Render ejecuta `npm install`). En "Start Command" deja `npm start` (o `node server.js`).
5. Configura las Environment Variables en Render (Settings > Environment). Agrega al menos:
    - `DATABASE_URL` (o `DB_*` variables si prefieres)
    - `JWT_SECRET`
    - `NODE_ENV=production`
    - cualquier otra variable que use tu `src/config/config.js`
6. Si usas una base de datos externa (Neon, Heroku Postgres, etc.), pega la `DATABASE_URL` que te provea el servicio.
7. Desactiva el uso de `.env` en producción: Render leerá las variables desde su configuración. No subas tu `.env` al repo.

Notas específicas para este repo:
- `package.json` ya tiene `start: node server.js`, y `server.js` usa `process.env.PORT`, por lo que Render podrá arrancar la app con `npm start`.
- `src/config/database.js` usa `process.env.DATABASE_URL` y `require('dotenv').config()` para desarrollo local. En Render no es necesario `dotenv` si configuras las vars en el panel de Render.

## Crear remoto GitHub (escritorio remoto)

Si actualmente usas Git localmente y quieres crear un remoto en GitHub, sigue estos pasos desde PowerShell en Windows.

1) Crea el repositorio en GitHub desde la web. Copia la URL del repo (p. ej. `https://github.com/tuusuario/lagbackend.git`).

2) Añade el remoto y haz push:

```powershell
git remote add origin https://github.com/tuusuario/lagbackend.git
git branch -M main
git push -u origin main
```

Si tu repositorio local ya tiene commits y utilizas `master` en lugar de `main`, ajusta el nombre de la rama.

3) Si tu cuenta requiere autenticación con token (GitHub ya no acepta contraseñas), crea un Personal Access Token (PAT) en GitHub (Settings > Developer settings > Personal access tokens) con permisos `repo` y usa ese token como contraseña cuando Git te lo pida.

4) Opcional: configura SSH para evitar introducir el token cada vez. Sigue las instrucciones de GitHub para generar claves SSH y añadirlas a tu cuenta.

## Resumen de verificación rápida antes de desplegar

- `server.js` usa `process.env.PORT` ✅
- `package.json` tiene `start` script ✅
- `.gitignore` contiene `.env` y `node_modules` ✅
- Asegúrate de configurar las vars en Render (no dependas de `.env` en producción) ✅

Si quieres, puedo:

- Añadir un `Procfile` (opcional) con `web: npm start`.
- Mover `dotenv` a `dependencies` si prefieres que esté disponible en producción (no recomendado para secretos).
- Automáticamente crear un repo en GitHub vía API (necesitaré un token tuyo o tú puedes ejecutar los comandos que te doy).

Dime qué prefieres y lo hago en el siguiente paso.