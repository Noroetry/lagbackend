# Deploy en Render - Instrucciones

## Variables de Entorno para Render

Configura estas variables en Render (Settings > Environment):

```env
NODE_ENV=production
JWT_SECRET=a0d5312d6d5ba80ee334d9b7f4ba6dde40f8b7f7e26bd3e58c8ee4f3d029d66f631ec42dbc0e5a6cdc4f84c10bcf1f501f415ebec48aa4046dd9ea5d7b08e84a
DATABASE_URL=tu_url_de_neon_db
```

## Configuración en Render

1. Build Command:
```bash
npm install
```

2. Start Command:
```bash
npm start
```

## Verificación Pre-Deploy

Antes de hacer push a main/deploy, ejecuta:
```bash
npm run validate
```

Este comando verificará:
- Variables de entorno requeridas
- Conexión a la base de datos
- Configuración SSL
- Seguridad del JWT_SECRET

## Notas de Seguridad

- No subir nunca el archivo `.env` al repositorio
- Mantener diferentes JWT_SECRET para desarrollo y producción
- La configuración SSL está habilitada y es estricta en producción
- La conexión a la base de datos usa un pool de conexiones optimizado

## Troubleshooting

Si encuentras errores en el deploy:

1. Verifica los logs en Render
2. Ejecuta `npm run validate` localmente
3. Comprueba que todas las variables de entorno estén configuradas en Render
4. Verifica la conexión a la base de datos de Neon
5. Revisa los logs de la aplicación en Render > Logs

## Monitoreo

- Usa los logs de Render para monitorear la aplicación
- Los errores de base de datos mostrarán mensajes detallados en los logs
- La aplicación registra información sobre autenticación y operaciones importantes

## Rollback

Si necesitas revertir un deploy:
1. Ve a Render > Manual Deploy
2. Selecciona el commit anterior que funcionaba
3. Click en "Deploy"