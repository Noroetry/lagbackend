const axios = require('axios');

const API_URL = 'http://localhost:3000/api/users';
let testToken = '';
let testUserId = '';

const testUser = {
    username: 'testuser' + Date.now(),
    email: `test${Date.now()}@test.com`,
    password: 'Test123!'
};

async function runTests() {
    try {
        // 1. Test Registro
        console.log('\n--- Test de Registro ---');
        const registerRes = await axios.post(`${API_URL}/create`, testUser);
        console.log('✅ Registro exitoso');
        testToken = registerRes.data.token;
        testUserId = registerRes.data.user.id;

        // 2. Test Registro Duplicado
        try {
            await axios.post(`${API_URL}/create`, testUser);
            console.log('❌ Error: Permitió registro duplicado');
        } catch (error) {
            console.log('✅ Registro duplicado bloqueado correctamente');
        }

        // 3. Test Login
        console.log('\n--- Test de Login ---');
        const loginRes = await axios.post(`${API_URL}/login`, {
            usernameOrEmail: testUser.email,
            password: testUser.password
        });
        console.log('✅ Login exitoso');

        // 4. Test Login Inválido
        try {
            await axios.post(`${API_URL}/login`, {
                usernameOrEmail: testUser.email,
                password: 'wrongpassword'
            });
            console.log('❌ Error: Permitió login con contraseña incorrecta');
        } catch (error) {
            console.log('✅ Login inválido bloqueado correctamente');
        }

        // 5. Test Ruta Protegida
        console.log('\n--- Test de Ruta Protegida ---');
        const protectedRes = await axios.get(`${API_URL}/getById/${testUserId}`, {
            headers: { Authorization: `Bearer ${testToken}` }
        });
        console.log('✅ Acceso a ruta protegida exitoso');

        // 6. Test Ruta Protegida sin Token
        try {
            await axios.get(`${API_URL}/getById/${testUserId}`);
            console.log('❌ Error: Permitió acceso sin token');
        } catch (error) {
            console.log('✅ Acceso sin token bloqueado correctamente');
        }

        // 7. Test Token Inválido
        try {
            await axios.get(`${API_URL}/getById/${testUserId}`, {
                headers: { Authorization: 'Bearer invalidtoken' }
            });
            console.log('❌ Error: Permitió acceso con token inválido');
        } catch (error) {
            console.log('✅ Acceso con token inválido bloqueado correctamente');
        }

    } catch (error) {
        console.error('Error en las pruebas:', error.response?.data || error.message);
    }
}

runTests();