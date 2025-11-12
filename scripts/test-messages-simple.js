/**
 * Script simple para probar el sistema básico de mensajes
 * Uso: node scripts/test-messages-simple.js
 */

const db = require('../src/config/database');
const messageService = require('../src/services/messageService');
const Message = db.Message;
const MessageUser = db.MessageUser;
const User = db.User;

async function testSimpleMessages() {
  try {
    console.log('🧪 Probando sistema de mensajes básico...\n');

    // Obtener un usuario
    const user = await User.findOne();
    if (!user) {
      console.log('⚠️  No hay usuarios. Crea un usuario primero.');
      return;
    }

    console.log(`👤 Usuario: ${user.username} (ID: ${user.id})\n`);

    // Crear un mensaje de prueba
    console.log('📝 Creando mensaje...');
    const message = await Message.create({
      title: 'Bienvenido al sistema de mensajes',
      description: 'Este es un mensaje informativo básico. El servidor puede enviarte notificaciones, consejos y actualizaciones.',
      type: 'info',
      active: true
    });
    console.log(`✅ Mensaje creado (ID: ${message.id})\n`);

    // Enviarlo al usuario
    console.log('📤 Enviando mensaje al usuario...');
    await MessageUser.create({
      id_message: message.id,
      id_user: user.id
    });
    console.log('✅ Mensaje enviado\n');

    // Test 1: Cargar mensajes
    console.log('📋 Test 1: Cargar mensajes');
    console.log('─'.repeat(50));
    const messages = await messageService.loadMessagesForUser(user.id);
    console.log(`✅ Mensajes cargados: ${messages.length}\n`);

    if (messages.length > 0) {
      console.log('Primer mensaje:');
      const msg = messages[0];
      console.log(`  ID: ${msg.id}`);
      console.log(`  Título: ${msg.title}`);
      console.log(`  Descripción: ${msg.description}`);
      console.log(`  Tipo: ${msg.type}`);
      console.log(`  Leído: ${msg.isRead ? 'Sí' : 'No'}`);
      console.log(`  Fecha creación: ${msg.createdAt}\n`);
    }

    // Test 2: Marcar como leído
    if (messages.length > 0 && !messages[0].isRead) {
      console.log('✉️  Test 2: Marcar mensaje como leído');
      console.log('─'.repeat(50));
      const result = await messageService.markMessageAsRead(messages[0].id, user.id);
      console.log(`✅ Resultado:`, result);
      console.log(`   Ya estaba leído: ${result.alreadyRead ? 'Sí' : 'No'}\n`);
    }

    // Test 3: Verificar que se marcó como leído
    console.log('🔍 Test 3: Verificar estado actualizado');
    console.log('─'.repeat(50));
    const updatedMessages = await messageService.loadMessagesForUser(user.id);
    if (updatedMessages.length > 0) {
      console.log(`✅ Mensaje ahora está leído: ${updatedMessages[0].isRead ? 'Sí' : 'No'}`);
      console.log(`   Fecha de lectura: ${updatedMessages[0].dateRead}`);
    }

    console.log('\n✨ ¡Prueba completada con éxito!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testSimpleMessages();
