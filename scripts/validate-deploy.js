require('dotenv').config();

// Validar variables de entorno requeridas
const requiredEnvVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'NODE_ENV'
];

function validateEnv() {
    const missing = requiredEnvVars.filter(env => !process.env[env]);
    if (missing.length > 0) {
        console.error('❌ Error: Faltan las siguientes variables de entorno:');
        missing.forEach(env => console.error(`   - ${env}`));
        return false;
    }
    return true;
}

// Validar conexión a la base de datos
async function validateDatabase() {
    try {
        const { sequelize } = require('../src/config/database');
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa');
        return true;
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error.message);
        return false;
    }
}

// Validar JWT_SECRET
function validateJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret === 'development_lag_token') {
        console.error('❌ Error: JWT_SECRET no debe usar el valor de desarrollo en producción');
        return false;
    }
    if (secret && secret.length < 32) {
        console.warn('⚠️ Advertencia: JWT_SECRET debería tener al menos 32 caracteres');
    }
    return true;
}

// Validar configuración SSL
function validateSslConfig() {
    if (process.env.NODE_ENV === 'production') {
        console.log('ℹ️ Validando conexión segura para Neon DB...');
        if (!process.env.DATABASE_URL.includes('sslmode=require')) {
            console.warn('⚠️ Recomendación: DATABASE_URL debería incluir sslmode=require para Neon');
        }
    }
    return true; // Neon maneja la configuración SSL automáticamente
}

async function runValidations() {
    console.log('🔍 Iniciando validaciones pre-deploy...\n');
    
    const results = {
        env: validateEnv(),
        jwt: validateJwtSecret(),
        ssl: validateSslConfig(),
        db: await validateDatabase()
    };

    console.log('\n📋 Resumen de validaciones:');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}`);
    });

    const allPassed = Object.values(results).every(r => r);
    console.log(`\n${allPassed ? '✅ Todo listo para deploy!' : '❌ Hay errores que necesitan ser corregidos.'}`);
    
    if (!allPassed) {
        process.exit(1);
    }
}

runValidations();