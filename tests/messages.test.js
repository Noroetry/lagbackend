const axios = require('axios');

const API = 'http://localhost:3000';

function sep(title) { console.log('\n===== ' + title + ' ====='); }

async function createUser(user) {
  const res = await axios.post(`${API}/api/users/create`, user);
  return res.data;
}

async function login(usernameOrEmail, password) {
  const res = await axios.post(`${API}/api/users/login`, { usernameOrEmail, password });
  return res.data;
}

async function run() {
  try {
    sep('SETUP: crear dos usuarios (alice y bob)');
    const unique = Date.now();
    const alice = { username: `alice${unique}`, email: `alice${unique}@test.com`, password: 'Pass123!' };
    const bob = { username: `bob${unique}`, email: `bob${unique}@test.com`, password: 'Pass123!' };

    const aCreate = await createUser(alice);
    console.log('alice created:', aCreate.user);
    const bCreate = await createUser(bob);
    console.log('bob created:', bCreate.user);

    sep('LOGIN: obtener tokens');
    const aLogin = await login(alice.username, alice.password);
    const aToken = aLogin.token;
    const bLogin = await login(bob.email, bob.password);
    const bToken = bLogin.token;
    console.log('alice token:', aToken ? aToken.substring(0,40)+'...' : aToken);
    console.log('bob token:', bToken ? bToken.substring(0,40)+'...' : bToken);

    sep('TEST: alice envía un mensaje a bob');
    const msg1 = { title: 'Hola', description: 'Mensaje 1', destination: bob.username };
    const sendRes = await axios.post(`${API}/api/messages/send`, msg1, { headers: { Authorization: `Bearer ${aToken}` } });
    console.log('send status:', sendRes.status, 'data:', sendRes.data);

  sep('TEST: bob inbox (debe contener el mensaje enviado por alice entre otros posibles, e.g. welcome)');
  const inboxRes = await axios.get(`${API}/api/messages/inbox`, { headers: { Authorization: `Bearer ${bToken}` } });
  console.log('inbox count:', inboxRes.data.length);
  // Puede que haya mensajes iniciales (bienvenida). Buscamos específicamente el mensaje enviado por alice
  const messagesFromAlice = inboxRes.data.filter(m => m.source === alice.username);
  if (messagesFromAlice.length !== 1) throw new Error('Expected 1 message from alice in bob inbox');

    sep('TEST: bob get sent (debería 0)');
    const bobSent = await axios.get(`${API}/api/messages/sent`, { headers: { Authorization: `Bearer ${bToken}` } });
    console.log('bob sent count:', bobSent.data.length);

    sep('TEST: alice sent (debería tener 1)');
    const aliceSent = await axios.get(`${API}/api/messages/sent`, { headers: { Authorization: `Bearer ${aToken}` } });
    console.log('alice sent count:', aliceSent.data.length);

  const messageId = messagesFromAlice[0].id;

    sep('TEST: bob marca como leído');
    const mark = await axios.patch(`${API}/api/messages/${messageId}/read`, {}, { headers: { Authorization: `Bearer ${bToken}` } });
    console.log('mark read status:', mark.status, 'body:', mark.data);
    if (mark.data.read !== 'S') throw new Error('Message not marked as read');

    sep('TEST: intentar que alice marque como leído (debe fallar, no es destinatario)');
    try {
      await axios.patch(`${API}/api/messages/${messageId}/read`, {}, { headers: { Authorization: `Bearer ${aToken}` } });
      throw new Error('Alice should not be able to mark as read');
    } catch (err) {
      console.log('Expected error:', err.response?.status, err.response?.data);
    }

    sep('TEST: alice envía 2 mensajes más a bob');
    await axios.post(`${API}/api/messages/send`, { title: 'Hi2', description: '2', destination: bob.username }, { headers: { Authorization: `Bearer ${aToken}` } });
    await axios.post(`${API}/api/messages/send`, { title: 'Hi3', description: '3', destination: bob.username }, { headers: { Authorization: `Bearer ${aToken}` } });

    sep('TEST: bob inbox unreadOnly (debe mostrar solo no leídos)');
    const unread = await axios.get(`${API}/api/messages/inbox?unread=true`, { headers: { Authorization: `Bearer ${bToken}` } });
    console.log('unread count:', unread.data.length);

    sep('TEST: cambiar estado de mensaje (archive) por bob');
    const toArchiveId = unread.data[0].id;
    const archiveRes = await axios.patch(`${API}/api/messages/${toArchiveId}/state`, { state: 'R' }, { headers: { Authorization: `Bearer ${bToken}` } });
    console.log('archive result:', archiveRes.status, archiveRes.data);

    sep('TEST: eliminar mensaje (soft delete) por alice (como source)');
    const sentId = aliceSent.data[0].id;
    const deleteRes = await axios.delete(`${API}/api/messages/${sentId}`, { headers: { Authorization: `Bearer ${aToken}` } });
    console.log('deleteResult:', deleteRes.status, deleteRes.data);

    sep('TEST: permisos - user C (no participante) no puede ver mensaje');
    const c = { username: `charlie${unique}`, email: `charlie${unique}@test.com`, password: 'Pass123!' };
    await createUser(c);
    const cLogin = await login(c.username, c.password);
    try {
      await axios.get(`${API}/api/messages/${messageId}`, { headers: { Authorization: `Bearer ${cLogin.token}` } });
      throw new Error('Charlie should not access message');
    } catch (err) {
      console.log('Expected forbidden:', err.response?.status, err.response?.data);
    }

    sep('ALL OK - summary');
    console.log('Test finished successfully');

  } catch (error) {
    console.error('Test failed:', error && error.stack ? error.stack : error);
    if (error.response) console.error('Response data:', error.response.data);
    process.exit(1);
  }
}

run();
