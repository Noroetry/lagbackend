# Sistema de Recompensas Flexible - Guía Completa

## Resumen de Cambios

Se ha implementado un sistema flexible de procesamiento de recompensas que soporta tres tipos de objetos:
- **experience**: Otorga/quita experiencia al usuario
- **coin**: Otorga/quita monedas al usuario
- **quest**: Asigna una misión única al usuario (solo como recompensa)

## Cambios en Base de Datos

### Tabla `users`
- **NUEVO**: Campo `coins` (INTEGER, default: 0)

### Tabla `quests_objects`
- **NUEVO**: Campo `id_quest_header` (INTEGER, nullable)
  - Se usa cuando `type='R'` y el objeto es de tipo `quest`
  - Referencia al `quest_header.id` de la misión a asignar

### Tabla `messages_users`
- Campo `adjunts` (JSON) ahora contiene información completa de las recompensas con estructura detallada

## Tipos de Objetos Soportados

### 1. Experience (type: 'experience')
```json
{
  "objectName": "Experiencia",
  "shortName": "EXP",
  "description": "Puntos de experiencia",
  "type": "experience"
}
```

**Uso en quest_objects**:
- `type: 'R'` → Recompensa (+EXP al completar)
- `type: 'P'` → Penalización (-EXP al expirar)
- `quantity`: Cantidad de experiencia (siempre positiva)

### 2. Coin (type: 'coin')
```json
{
  "objectName": "Moneda",
  "shortName": "COIN",
  "description": "Monedas del juego",
  "type": "coin"
}
```

**Uso en quest_objects**:
- `type: 'R'` → Recompensa (+coins al completar)
- `type: 'P'` → Penalización (-coins al expirar)
- `quantity`: Cantidad de monedas (siempre positiva)

### 3. Quest (type: 'quest')
```json
{
  "objectName": "Misión",
  "shortName": "QUEST",
  "description": "Asigna una misión al usuario",
  "type": "quest"
}
```

**Uso en quest_objects**:
- `type: 'R'` → Asigna la misión al completar
- `type: 'P'` → **NO SOPORTADO** (no se quitan misiones)
- `quantity`: Siempre 1
- `id_quest_header`: **REQUERIDO** - ID de la misión a asignar

**Restricciones**:
- Solo se asignan quests con `period='U'` (únicas)
- No se asigna si el usuario ya tiene esa quest

## Estructura de Adjunts en Messages

Cuando se otorgan recompensas/penalizaciones, se crea un mensaje con `adjunts` que contiene información completa:

```json
{
  "title": "Recompensa de misión",
  "description": "La misión \"Ejercicio diario\" te ha otorgado las siguientes recompensas:",
  "questTitle": "Ejercicio diario",
  "type": "reward",
  "adjunts": [
    {
      "id": 1,
      "objectName": "Experiencia",
      "shortName": "EXP",
      "description": "Puntos de experiencia",
      "type": "experience",
      "quantity": 50
    },
    {
      "id": 2,
      "objectName": "Moneda",
      "shortName": "COIN",
      "description": "Monedas del juego",
      "type": "coin",
      "quantity": 100
    },
    {
      "id": 3,
      "objectName": "Misión",
      "shortName": "QUEST",
      "description": "Asigna una misión al usuario",
      "type": "quest",
      "quantity": 1,
      "questAssignedTitle": "Misión especial de fuerza",
      "idQuestAssigned": 15
    }
  ]
}
```

### Estructura Detallada de cada Adjunt

Cada objeto en el array `adjunts` tiene la siguiente estructura:

**Para Experience y Coin:**
| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | Integer | ID del ObjectItem | `1` |
| `objectName` | String | Nombre completo del objeto | `"Experiencia"` |
| `shortName` | String | Nombre corto para mostrar en UI | `"EXP"` |
| `description` | String | Descripción del objeto | `"Puntos de experiencia del jugador"` |
| `type` | String | Tipo: `"experience"` o `"coin"` | `"experience"` |
| `quantity` | Integer | Cantidad otorgada (+) o penalizada (-) | `50` o `-25` |

**Para Quest (misión asignada como recompensa):**
| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | Integer | ID del ObjectItem | `3` |
| `objectName` | String | Nombre completo del objeto | `"Misión"` |
| `shortName` | String | Nombre corto para mostrar en UI | `"QUEST"` |
| `description` | String | Descripción del objeto | `"Asigna una misión especial"` |
| `type` | String | Tipo: `"quest"` | `"quest"` |
| `quantity` | Integer | Siempre 1 | `1` |
| `questAssignedTitle` | String | Título de la quest asignada como premio | `"Desafío Especial"` |
| `idQuestAssigned` | Integer | ID de la quest asignada | `15` |

**Nota importante sobre questTitle**:
- `questTitle` en el mensaje = Quest que se completó/expiró
- `questAssignedTitle` en adjunt de tipo quest = Quest que se ASIGNÓ como recompensa
```

## Ejemplos de Uso

### Ejemplo 1: Quest con Experiencia y Monedas

```javascript
// 1. Crear objetos en la tabla objects (si no existen)
const expObject = await ObjectItem.findOrCreate({
  where: { type: 'experience' },
  defaults: {
    objectName: 'Experiencia',
    shortName: 'EXP',
    description: 'Puntos de experiencia',
    type: 'experience'
  }
});

const coinObject = await ObjectItem.findOrCreate({
  where: { type: 'coin' },
  defaults: {
    objectName: 'Moneda',
    shortName: 'COIN',
    description: 'Monedas del juego',
    type: 'coin'
  }
});

// 2. Crear quest_header
const quest = await QuestsHeader.create({
  title: 'Ejercicio diario',
  description: 'Completa 30 minutos de ejercicio',
  period: 'D',
  active: true,
  levelRequired: 1
});

// 3. Asignar recompensas (type 'R')
await QuestsObject.create({
  idQuest: quest.id,
  idObject: expObject.id,
  type: 'R',
  quantity: 50
});

await QuestsObject.create({
  idQuest: quest.id,
  idObject: coinObject.id,
  type: 'R',
  quantity: 100
});

// 4. Asignar penalizaciones (type 'P') si expira
await QuestsObject.create({
  idQuest: quest.id,
  idObject: expObject.id,
  type: 'P',
  quantity: 25  // Pierde 25 EXP
});
```

### Ejemplo 2: Quest que Otorga Otra Quest

```javascript
// 1. Crear objeto tipo quest
const questObject = await ObjectItem.findOrCreate({
  where: { type: 'quest' },
  defaults: {
    objectName: 'Misión',
    shortName: 'QUEST',
    description: 'Asigna una misión al usuario',
    type: 'quest'
  }
});

// 2. Crear la quest que será el premio (DEBE ser period='U')
const rewardQuest = await QuestsHeader.create({
  title: 'Desafío especial de fuerza',
  description: 'Una misión única desbloqueada',
  period: 'U',  // IMPORTANTE: Único
  active: true,
  levelRequired: 1
});

// 3. Crear la quest principal
const mainQuest = await QuestsHeader.create({
  title: 'Completa 10 entrenamientos',
  description: 'Completa 10 sesiones de entrenamiento para desbloquear desafío especial',
  period: 'U',
  active: true,
  levelRequired: 1
});

// 4. Asignar como recompensa
await QuestsObject.create({
  idQuest: mainQuest.id,
  idObject: questObject.id,
  type: 'R',
  quantity: 1,
  id_quest_header: rewardQuest.id  // Referencia a la quest premio
});
```

### Ejemplo 3: Quest Completa con Todos los Tipos

```javascript
// Quest que da EXP, coins y desbloquea otra quest
const expObject = await ObjectItem.findOne({ where: { type: 'experience' } });
const coinObject = await ObjectItem.findOne({ where: { type: 'coin' } });
const questObject = await ObjectItem.findOne({ where: { type: 'quest' } });

const bonusQuest = await QuestsHeader.create({
  title: 'Misión Bonus: Resistencia',
  period: 'U',
  active: true
});

const masterQuest = await QuestsHeader.create({
  title: 'Maestría Completa',
  description: 'Alcanza la maestría en todas las disciplinas',
  period: 'U',
  active: true
});

// Recompensas por completar
await QuestsObject.bulkCreate([
  { idQuest: masterQuest.id, idObject: expObject.id, type: 'R', quantity: 500 },
  { idQuest: masterQuest.id, idObject: coinObject.id, type: 'R', quantity: 1000 },
  { idQuest: masterQuest.id, idObject: questObject.id, type: 'R', quantity: 1, id_quest_header: bonusQuest.id }
]);

// Penalizaciones por expirar
await QuestsObject.bulkCreate([
  { idQuest: masterQuest.id, idObject: expObject.id, type: 'P', quantity: 100 },
  { idQuest: masterQuest.id, idObject: coinObject.id, type: 'P', quantity: 200 }
]);
```

## Mensajes Generados

### Mensaje de Recompensa (state='C')
- **type**: `'reward'`
- **title**: `'Recompensa de misión'`
- **description**: `'La misión "[título]" te ha otorgado las siguientes recompensas:'`

### Mensaje de Penalización (state='E')
- **type**: `'penalty'`
- **title**: `'Penalización de misión'`
- **description**: `'La misión "[título]" te ha aplicado las siguientes penalizaciones:'`

## Flujo de Procesamiento

1. Usuario completa/expira una quest
2. Se determina el tipo de resultado (`'C'` completado → type='R', `'E'` expirado → type='P')
3. Se obtienen todos los `quest_objects` del tipo correspondiente
4. Para cada objeto:
   - Si es `experience`: actualiza `users.totalExp`
   - Si es `coin`: actualiza `users.coins`
   - Si es `quest` (solo en recompensas): asigna la misión referenciada en `id_quest_header`
5. Se crea un mensaje con toda la información detallada en `adjunts`
6. Se marca `rewardDelivered = true` en `quests_users`
7. Se verifica si el usuario subió de nivel (solo si ganó EXP)

## Scripts de Seed

### Crear Objetos Base
```javascript
// scripts/seed-reward-objects.js
const db = require('../src/config/database');
const ObjectItem = db.ObjectItem;

async function seedRewardObjects() {
  await ObjectItem.findOrCreate({
    where: { type: 'experience' },
    defaults: {
      objectName: 'Experiencia',
      shortName: 'EXP',
      description: 'Puntos de experiencia del jugador',
      type: 'experience'
    }
  });

  await ObjectItem.findOrCreate({
    where: { type: 'coin' },
    defaults: {
      objectName: 'Moneda',
      shortName: 'COIN',
      description: 'Monedas del juego',
      type: 'coin'
    }
  });

  await ObjectItem.findOrCreate({
    where: { type: 'quest' },
    defaults: {
      objectName: 'Misión',
      shortName: 'QUEST',
      description: 'Asigna una misión especial al usuario',
      type: 'quest'
    }
  });

  console.log('✓ Objetos de recompensa creados');
}

seedRewardObjects()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
```

## Migraciones

Las migraciones se ejecutan en orden:
1. `20251113140000-add-coins-to-users.js` - Añade campo `coins` a users
2. `20251113141000-add-quest-header-ref-to-quests-objects.js` - Añade `id_quest_header` a quest_objects

```bash
npx sequelize-cli db:migrate
```

## Verificación

```sql
-- Verificar campo coins en users
SELECT id, username, coins, totalExp FROM users LIMIT 5;

-- Verificar quest_objects con referencias
SELECT qo.*, o.objectName, o.type 
FROM quests_objects qo
LEFT JOIN objects o ON o.id = qo.idObject
WHERE qo.id_quest_header IS NOT NULL;

-- Verificar mensajes con adjunts
SELECT mu.id, mu.title, mu.adjunts 
FROM messages_users mu
WHERE mu.adjunts IS NOT NULL
LIMIT 5;
```

## Notas Importantes

1. **Nunca asignar quests como penalización**: Solo funciona con `type='R'`
2. **Quests únicas**: Solo se pueden asignar quests con `period='U'`
3. **Cantidades siempre positivas**: El sistema calcula el signo según sea recompensa o penalización
4. **id_quest_header requerido**: Para objetos tipo quest, este campo es obligatorio
5. **Mensaje automático**: Se crea automáticamente después de procesar recompensas
6. **Transacciones**: Todo el proceso es transaccional, garantiza consistencia

## API Response Example

Cuando se completa una quest, el usuario recibirá un mensaje que puede leer:

```json
{
  "id": 123,
  "messageId": 45,
  "title": "Recompensa de misión",
  "description": "La misión \"Ejercicio diario\" te ha otorgado las siguientes recompensas:",
  "adjunts": [
    {
      "id": 1,
      "objectName": "Experiencia",
      "shortName": "EXP",
      "type": "experience",
      "description": "Puntos de experiencia del jugador",
      "quantity": 50,
      "questTitle": null,
      "idQuestHeader": null
    },
    {
      "id": 2,
      "objectName": "Moneda",
      "shortName": "COIN",
      "type": "coin",
      "description": "Monedas del juego",
      "quantity": 100,
      "questTitle": null,
      "idQuestHeader": null
    }
  ],
  "type": "reward",
  "dateRead": null,
  "isRead": false,
  "createdAt": "2025-11-13T15:30:00.000Z"
}
```

### Response de /me y /profile

El usuario también recibe información de sus coins:

```json
{
  "id": 1,
  "username": "player1",
  "email": "player1@example.com",
  "level_number": 5,
  "totalExp": 1250,
  "coins": 500,
  "minExpRequired": 1000,
  "nextRequiredLevel": 1500,
  "admin": 0,
  "createdAt": "2025-11-01T10:00:00.000Z",
  "updatedAt": "2025-11-14T15:30:00.000Z"
}
```
```
