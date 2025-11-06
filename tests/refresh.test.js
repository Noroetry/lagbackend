const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3000/api/users';

function sep(title) {
  console.log('\n===== ' + title + ' =====');
}

function extractRefreshFromSetCookie(setCookie) {
  if (!setCookie) return null;
  // setCookie may be array
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    const m = c.match(/refreshToken=([^;]+);/);
    if (m) return m[1];
  }
  return null;
}

async function run() {
  try {
    sep('CREAR USUARIO PARA PRUEBAS');
    const unique = Date.now();
    const testUser = {
      username: `refreshTest${unique}`,
      email: `refresh${unique}@test.com`,
      password: 'Test123!'
    };

    const createRes = await axios.post(`${API_URL}/create`, testUser, { validateStatus: () => true });
  console.log('createRes.data:', createRes.data);
  if (createRes.status !== 201) {
      console.error('Fallo al crear usuario:', createRes.status, createRes.data);
      process.exit(1);
    }
    console.log('Usuario creado OK');

    const access1 = createRes.data.accessToken || createRes.data.token || null;
    if (!access1) {
      console.error('No se recibió accessToken en create');
      process.exit(1);
    }
    const setCookie1 = createRes.headers['set-cookie'];
    const refresh1 = extractRefreshFromSetCookie(setCookie1);
    if (!refresh1) {
      console.error('No se recibió cookie refreshToken en create');
      console.error('Set-Cookie headers:', setCookie1);
      process.exit(1);
    }
    console.log('Access token y refresh cookie recibidos');

    sep('USAR accessToken PARA /me (debe funcionar)');
    const meRes = await axios.get(`${API_URL}/me`, { headers: { Authorization: `Bearer ${access1}` } });
    if (meRes.status !== 200) throw new Error('GET /me falló con access token válido');
    console.log('GET /me OK');

  sep('REFRESH usando cookie (debe rotar)');
  console.log('Enviando refreshToken en Cookie header (trunc):', refresh1 ? refresh1.substring(0, 40) + '...' : refresh1);
  const refreshRes = await axios.post(`${API_URL}/refresh`, {}, { headers: { Cookie: `refreshToken=${refresh1}` }, validateStatus: () => true });
    console.log('Raw set-cookie from refresh:', refreshRes.headers['set-cookie']);
    if (refreshRes.status !== 200) {
      console.error('Refresh falló:', refreshRes.status, refreshRes.data);
      process.exit(1);
    }
    const access2 = refreshRes.data.accessToken;
    const setCookie2 = refreshRes.headers['set-cookie'];
    const refresh2 = extractRefreshFromSetCookie(setCookie2);
    console.log('refresh1 (trunc):', refresh1 ? refresh1.substring(0, 40) + '...' : refresh1);
    console.log('refresh2 (trunc):', refresh2 ? refresh2.substring(0, 40) + '...' : refresh2);
    if (!access2 || !refresh2) {
      console.error('Refresh no devolvió nuevo access o cookie refresh');
      process.exit(1);
    }
    if (access2 === access1) console.warn('Warning: el accessToken nuevo coincide exactamente con el anterior (esperado diferente)');
    if (refresh2 === refresh1) {
      console.warn('Warning: el refresh token reemitido coincide exactamente con el anterior (poco probable). Continuando con la comprobación de invalidación.');
    } else {
      console.log('Refresh OK y token rotado');
    }

    // small pause to ensure DB update is visible for subsequent request
    await new Promise(r => setTimeout(r, 200));

    sep('Intentar usar refresh antiguo (debe fallar)');
  const tryOld = await axios.post(`${API_URL}/refresh`, {}, { headers: { Cookie: `refreshToken=${refresh1}` }, validateStatus: () => true });
    console.log('tryOld status/data:', tryOld.status, tryOld.data);
    if (tryOld.status === 200) {
      console.error('ERROR: refresh antiguo fue aceptado (debería rechazarse)');
      process.exit(1);
    }
    console.log('Refresh antiguo rechazado, OK');

    sep('Rotación adicional: usar refresh2 para obtener refresh3');
  const r3 = await axios.post(`${API_URL}/refresh`, {}, { headers: { Cookie: `refreshToken=${refresh2}` }, validateStatus: () => true });
    if (r3.status !== 200) {
      console.error('Refresh con refresh2 falló:', r3.status, r3.data);
      process.exit(1);
    }
    const refresh3 = extractRefreshFromSetCookie(r3.headers['set-cookie']);
    console.log('Rotación a refresh3 OK');

    sep('Logout usando refresh3 (body)');
  const logoutRes = await axios.post(`${API_URL}/logout`, {}, { headers: { Cookie: `refreshToken=${refresh3}` }, validateStatus: () => true });
    if (logoutRes.status !== 200) {
      console.error('Logout falló:', logoutRes.status, logoutRes.data);
      process.exit(1);
    }
    console.log('Logout OK');

    sep('Intentar refresh con refresh3 (debe fallar tras logout)');
  const postLogoutTry = await axios.post(`${API_URL}/refresh`, {}, { headers: { Cookie: `refreshToken=${refresh3}` }, validateStatus: () => true });
  if (postLogoutTry.status === 200) {
      console.error('ERROR: refresh después de logout fue aceptado');
      process.exit(1);
    }
    console.log('Refresh rechazado tras logout, OK');

    sep('Pruebas de tokens inválidos / malformados');
    const malformed = await axios.post(`${API_URL}/refresh`, { refreshToken: 'bad.token' }, { validateStatus: () => true });
    if (malformed.status === 200) {
      console.error('ERROR: refresh con token malformado fue aceptado');
      process.exit(1);
    }
    console.log('Refresh con token malformado rechazado, OK');

    sep('Token firmado con otro secret (debe fallar)');
    // crear token válido en estructura pero firmado con otro secret
    const fake = jwt.sign({ id: meRes.data.id || meRes.data.user?.id || meRes.data._id || meRes.data }, 'wrong_secret', { expiresIn: '7d' });
  const fakeTry = await axios.post(`${API_URL}/refresh`, { refreshToken: fake }, { validateStatus: () => true });
    if (fakeTry.status === 200) {
      console.error('ERROR: refresh con token firmado con otro secret fue aceptado');
      process.exit(1);
    }
    console.log('Refresh con token firmado por otro secret rechazado, OK');

    sep('FIN - Resumen');
    console.log('Todas las comprobaciones de refresh token pasaron (rotación, invalidación, logout, negativos)');
    process.exit(0);

  } catch (err) {
    console.error('Fallo en tests de refresh:', err && err.stack ? err.stack : err);
    if (err.response) console.error('Response:', err.response.status, err.response.data);
    process.exit(1);
  }
}

run();
