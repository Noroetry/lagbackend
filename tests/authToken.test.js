const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3000/api/users';

// Helper para imprimir separadores
function sep(title) {
  console.log('\n===== ' + title + ' =====');
}

async function run() {
  try {
    sep('CREAR USUARIO DE PRUEBA');
    const unique = Date.now();
    const testUser = {
      username: `tokenTest${unique}`,
      email: `tokenTest${unique}@test.com`,
      password: 'Test123!'
    };

    const registerRes = await axios.post(`${API_URL}/create`, testUser);
    console.log('create response status:', registerRes.status);
    console.log('create response data:', registerRes.data);

    const goodToken = registerRes.data.token;
    const user = registerRes.data.user;

    sep('TOKEN BUENO (desde registro)');
    console.log('token (trunc):', goodToken ? goodToken.substring(0, 40) + '...' : goodToken);

    sep('PRUEBA: petición con token válido');
    try {
      const r = await axios.get(`${API_URL}/me`, { headers: { Authorization: `Bearer ${goodToken}` } });
      console.log('status:', r.status);
      console.log('body:', r.data);
    } catch (err) {
      console.error('Error en petición con token válido:', err.response ? err.response.status : err.message);
      if (err.response) console.error(err.response.data);
    }

    sep('PRUEBA: petición sin token (esperado 401)');
    try {
      await axios.get(`${API_URL}/me`);
      console.error('ERROR: la petición SIN token devolvió 200 inesperadamente');
    } catch (err) {
      console.log('status:', err.response?.status);
      console.log('body:', err.response?.data);
    }

    sep('PRUEBA: token inválido (malformed)');
    const badToken = 'thisIsNotAValidToken';
    try {
      await axios.get(`${API_URL}/me`, { headers: { Authorization: `Bearer ${badToken}` } });
      console.error('ERROR: token inválido aceptado');
    } catch (err) {
      console.log('status:', err.response?.status);
      console.log('body:', err.response?.data || err.message);
    }

    sep('PRUEBA: token firmado con otro secret');
    const otherSecretToken = jwt.sign({ id: user.id, username: user.username }, 'some_other_secret', { expiresIn: '1h' });
    try {
      await axios.get(`${API_URL}/me`, { headers: { Authorization: `Bearer ${otherSecretToken}` } });
      console.error('ERROR: token con otro secret aceptado');
    } catch (err) {
      console.log('status:', err.response?.status);
      console.log('body:', err.response?.data || err.message);
    }

    sep('PRUEBA: token expirado (claim exp en pasado)');
    const expiredToken = jwt.sign({ id: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) - 3600 }, process.env.JWT_SECRET || 'development_lag_token');
    try {
      await axios.get(`${API_URL}/me`, { headers: { Authorization: `Bearer ${expiredToken}` } });
      console.error('ERROR: token expirado aceptado');
    } catch (err) {
      console.log('status:', err.response?.status);
      console.log('body:', err.response?.data || err.message);
    }

    sep('FIN - resumen');
    console.log('usuario creado:', user);
    console.log('goodToken (trunc):', goodToken ? goodToken.substring(0, 40) + '...' : goodToken);

  } catch (error) {
    console.error('Fallo en el flujo de pruebas:', error && error.stack ? error.stack : error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

run();
