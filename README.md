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