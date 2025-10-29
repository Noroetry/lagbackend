
const app = require('./src/app'); 
const db = require('./src/config/database'); 

const PORT = process.env.PORT || 3000; 

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Conexión a la base de datos PostgreSQL establecida exitosamente.');

    await db.sequelize.sync({ alter: true }); 
    console.log('✅ Tablas sincronizadas (Modelos cargados).');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor Express escuchando en http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor o la base de datos:', error);
    process.exit(1); 
  }
};

startServer();