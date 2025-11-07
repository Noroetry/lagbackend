const axios = require('axios');
const db = require('../src/config/database');

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
    sep('SETUP: crear usuario de test para quests');
    const unique = Date.now();
    const user = { username: `questtester${unique}`, email: `questtester${unique}@test.com`, password: 'Pass123!' };

    await createUser(user);
    const loginRes = await login(user.username, user.password);
    const token = loginRes.accessToken || loginRes.token || loginRes.access_token || loginRes.token_access;
    if (!token) {
      console.error('Login did not return a token object, response:', loginRes);
      throw new Error('Token missing from login response');
    }
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    sep('CASE 1: primera llamada /api/quests/load — debe asignar quests disponibles');
    const res1 = await axios.post(`${API}/api/quests/load`, { userId: loginRes.user.id }, auth);
    console.log('res1 assigned:', res1.data.assigned, 'activeQuests:', (res1.data.activeQuests||[]).length);

    sep('CASE 2: llamada inmediata repetida — no debe asignar de nuevo');
    const res2 = await axios.post(`${API}/api/quests/load`, { userId: loginRes.user.id }, auth);
    console.log('res2 assigned:', res2.data.assigned);

    sep('CASE 3: comprobar que quest con levelRequired > user.level no fue asignada');
    const allActive = res2.data.activeQuests || [];
    const highLevelQuest = await db.QuestsHeader.findOne({ where: { levelRequired: { [db.Sequelize.Op.gt]: loginRes.user.level } } });
    if (highLevelQuest) {
      const found = allActive.find(q => q.idQuest === highLevelQuest.id);
      console.log('highLevelQuest exists:', highLevelQuest.title, 'assigned present in active:', !!found);
    } else {
      console.log('No high-level quest in DB to check');
    }

    sep('CASE 4: simular finalización con éxito (state C) y volver a llamar para procesar recompensas');
    // Tomar una quest asignada
    if ((allActive||[]).length === 0) {
      console.log('No active quests to complete — aborting this case');
    } else {
  const q = allActive[0];
  // marcar en DB como C — activeQuests items contain idQuest, not the internal QuestsUser.id
  await db.QuestsUser.update({ state: 'C' }, { where: { idUser: loginRes.user.id, idQuest: q.idQuest } });
      // leer totalExp antes
      const userBefore = await db.User.findByPk(loginRes.user.id);
      const beforeExp = BigInt(userBefore.totalExp || 0);

      const res3 = await axios.post(`${API}/api/quests/load`, { userId: loginRes.user.id }, auth);
      console.log('res3 questsRewarded length:', (res3.data.questsRewarded||[]).length);

      const userAfter = await db.User.findByPk(loginRes.user.id);
      const afterExp = BigInt(userAfter.totalExp || 0);
      console.log('Exp before:', beforeExp.toString(), 'after:', afterExp.toString(), 'delta:', (afterExp - beforeExp).toString());
    }

    sep('CASE 5: simular fallo (state E) y comprobar penalización');
    // asignar otra quest if exists
    const activeNow = (await axios.post(`${API}/api/quests/load`, { userId: loginRes.user.id }, auth)).data.activeQuests || [];
  const candidate = activeNow.find(a => a.state === 'N' || a.state === 'P');
    if (!candidate) {
      console.log('No candidate quest to mark as E — skipping');
    } else {
      const userBefore2 = await db.User.findByPk(loginRes.user.id);
      const beforeExp2 = BigInt(userBefore2.totalExp || 0);
  await db.QuestsUser.update({ state: 'E' }, { where: { idUser: loginRes.user.id, idQuest: candidate.idQuest } });
      const res4 = await axios.post(`${API}/api/quests/load`, { userId: loginRes.user.id }, auth);
      console.log('res4 questsRewarded (penalties) length:', (res4.data.questsRewarded||[]).length);
      const userAfter2 = await db.User.findByPk(loginRes.user.id);
      const afterExp2 = BigInt(userAfter2.totalExp || 0);
      console.log('Exp before:', beforeExp2.toString(), 'after:', afterExp2.toString(), 'delta:', (afterExp2 - beforeExp2).toString());
    }

    sep('CASE 6: concurrencia — lanzar 2 llamadas load en paralelo y comprobar que no asignan duplicadas');
    const p1 = axios.post(`${API}/api/quests/load`, { userId: loginRes.user.id }, auth);
    const p2 = axios.post(`${API}/api/quests/load`, { userId: loginRes.user.id }, auth);
    const [rA, rB] = await Promise.all([p1, p2]);
    console.log('parallel assigned flags:', rA.data.assigned, rB.data.assigned);

    sep('ALL CASES DONE');
    console.log('Test script finished');

  } catch (error) {
    console.error('Test failed:', error && error.stack ? error.stack : error);
    if (error.response) console.error('Response data:', error.response.data);
    process.exit(1);
  } finally {
    // Close DB connection
    try { await db.sequelize.close(); } catch (e) {}
  }
}

run();
