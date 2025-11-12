/**
 * Script para crear mensajes desde un archivo JSON
 * Uso: node scripts/create-messages-from-json.js <archivo.json> [userId1,userId2,...]
 * 
 * Ejemplos:
 * - Crear mensajes del template para todos los usuarios:
 *   node scripts/create-messages-from-json.js scripts/messages-template.json all
 * 
 * - Crear mensajes para usuarios específicos:
 *   node scripts/create-messages-from-json.js scripts/messages-template.json 1,2,3
 * 
 * - Solo crear las plantillas sin enviar:
 *   node scripts/create-messages-from-json.js scripts/messages-template.json
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const Message = db.Message;
const MessageUser = db.MessageUser;
const User = db.User;

async function createMessagesFromJSON() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('❌ Error: Debes especificar un archivo JSON');
      console.log('\nUso:');
      console.log('  node scripts/create-messages-from-json.js <archivo.json> [userIds|all]');
      console.log('\nEjemplos:');
      console.log('  node scripts/create-messages-from-json.js scripts/messages-template.json all');
      console.log('  node scripts/create-messages-from-json.js scripts/messages-template.json 1,2,3');
      console.log('  node scripts/create-messages-from-json.js scripts/messages-template.json (solo crear plantillas)');
      process.exit(1);
    }

    const jsonFile = args[0];
    const sendTo = args[1];

    // Leer el archivo JSON
    if (!fs.existsSync(jsonFile)) {
      console.log(`❌ Error: El archivo ${jsonFile} no existe`);
      process.exit(1);
    }

    console.log(`📖 Leyendo mensajes desde: ${jsonFile}\n`);
    const messagesData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

    if (!Array.isArray(messagesData)) {
      console.log('❌ Error: El archivo JSON debe contener un array de mensajes');
      process.exit(1);
    }

    console.log(`📝 Creando ${messagesData.length} plantilla(s) de mensaje...\n`);

    const createdMessages = [];
    for (const msgData of messagesData) {
      // Validar campos requeridos
      if (!msgData.title || !msgData.description) {
        console.log(`⚠️  Saltando mensaje sin título o descripción:`, msgData);
        continue;
      }

      // Asegurar valores por defecto
      const messageToCreate = {
        title: msgData.title,
        description: msgData.description,
        type: msgData.type || 'info',
        active: msgData.active !== undefined ? msgData.active : true
      };

      const message = await Message.create(messageToCreate);
      createdMessages.push(message);
      console.log(`✅ [${message.id}] ${message.title} (${message.type})`);
    }

    console.log(`\n📊 Resumen: ${createdMessages.length} plantilla(s) creada(s)`);

    // Si no se especificó destinatarios, terminar aquí
    if (!sendTo) {
      console.log('\n💡 Plantillas creadas. Para enviarlas a usuarios, ejecuta:');
      console.log(`   node scripts/create-messages-from-json.js ${jsonFile} all`);
      console.log(`   node scripts/create-messages-from-json.js ${jsonFile} 1,2,3`);
      process.exit(0);
    }

    // Determinar usuarios destinatarios
    let userIds = [];
    if (sendTo === 'all') {
      console.log('\n📤 Enviando mensajes a todos los usuarios...');
      const users = await User.findAll({ attributes: ['id'], raw: true });
      userIds = users.map(u => u.id);
    } else {
      userIds = sendTo.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    if (userIds.length === 0) {
      console.log('\n⚠️  No se encontraron usuarios destinatarios');
      process.exit(0);
    }

    console.log(`\n📨 Enviando ${createdMessages.length} mensaje(s) a ${userIds.length} usuario(s)...\n`);

    // Crear MessageUser para cada combinación mensaje-usuario
    const messageUsersToCreate = [];
    for (const message of createdMessages) {
      for (const userId of userIds) {
        messageUsersToCreate.push({
          id_message: message.id,
          id_user: userId
        });
      }
    }

    await MessageUser.bulkCreate(messageUsersToCreate);

    console.log(`✅ ${messageUsersToCreate.length} mensaje(s) enviado(s) exitosamente`);
    console.log(`   - ${createdMessages.length} plantilla(s)`);
    console.log(`   - ${userIds.length} usuario(s)`);
    console.log(`   - ${messageUsersToCreate.length} total de envíos`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createMessagesFromJSON();
