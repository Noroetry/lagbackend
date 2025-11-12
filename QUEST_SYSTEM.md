# Sistema de Quests - LifeAsGame

## Documentación Funcional

### 📋 Índice
1. [Conceptos Básicos](#conceptos-básicos)
2. [Estados de las Quests](#estados-de-las-quests)
3. [Tipos de Periodicidad](#tipos-de-periodicidad)
4. [Flujo de Vida de una Quest](#flujo-de-vida-de-una-quest)
5. [Sistema de Expiración](#sistema-de-expiración)
6. [Sistema de Recompensas](#sistema-de-recompensas)
7. [Tablas de la Base de Datos](#tablas-de-la-base-de-datos)
8. [API Endpoints](#api-endpoints)

---

## Conceptos Básicos

### ¿Qué es una Quest?
Una **quest** (misión) es una tarea que un usuario debe completar. Cada quest tiene:
- **Título y descripción**: Información visible al usuario
- **Detalles (details)**: Subtareas individuales que deben completarse
- **Nivel requerido**: Nivel mínimo del usuario para acceder a la quest
- **Periodicidad**: Define cuándo y cómo se repite la quest
- **Recompensas y penalizaciones**: XP u otros objetos que se otorgan/quitan

### Estructura de Datos Principal

```
QuestsHeader (plantilla de la quest)
  ├─ QuestsDetail (plantilla de subtareas)
  ├─ QuestsObject (recompensas/penalizaciones)
  └─ QuestsUser (instancia asignada a un usuario)
       └─ QuestsUserDetail (estado de cada subtarea del usuario)
```

---

## Estados de las Quests

Una quest asignada a un usuario (`QuestsUser`) puede estar en estos estados:

| Estado | Descripción | Visible al Usuario |
|--------|-------------|-------------------|
| **P** | **Pending Parameters** - Esperando que el usuario ingrese valores requeridos | ✅ Sí |
| **N** | **New** - Quest lista para activar (parámetros ya ingresados o no requeridos) | ✅ Sí |
| **L** | **Live** - Quest activa, en progreso | ✅ Sí |
| **C** | **Completed** - Completada exitosamente | ❌ No (hasta reactivación) |
| **E** | **Expired** - Expiró sin completarse | ❌ No (hasta reactivación) |
| **F** | **Finished** - Finalizada permanentemente (solo quests únicas) | ❌ No |

### Transiciones de Estado

```
assignQuestToUser crea la quest:
  ↓
¿Tiene details con needParam=true?
  ├─ SÍ → P (Pending Parameters)
  └─ NO → N (New, lista para activar)

P (Pending Parameters)
  → submitParams (usuario ingresa valores requeridos)
  → N (New, ahora lista para activar)

N (New)
  → activateQuest (usuario hace click en "Activar")
  → L (Live, en progreso)

L (Live)
  → C (Completed: todos los details marcados como checked)
  → E (Expired: dateExpiration < now)

C (Completed) / E (Expired)
  → Se procesan recompensas/penalizaciones
  → rewardDelivered = true, finished = true
  → Permanece en C/E hasta próximo ciclo
  → L (Reactivación automática en loadQuests si es periódica)
  → F (solo quests únicas con period='U')
```

---

## Tipos de Periodicidad

### 1. **FIXED** - Períodos Fijos
Quests que se repiten en intervalos regulares:
- **D** (Daily): Diaria - se reactiva cada día a las 03:00
- **W** (Weekly): Semanal - se reactiva cada 7 días a las 03:00
- **M** (Monthly): Mensual - se reactiva cada mes a las 03:00
- **U** (Unique): Única - NO se reactiva, va a estado 'F' al finalizar

### 2. **WEEKDAYS** - Días Específicos de la Semana
Quests que solo están activas ciertos días de la semana.

**Ejemplo**: Quest que se activa Lunes, Miércoles y Viernes
```json
{
  "periodType": "WEEKDAYS",
  "activeDays": "1,3,5",  // 0=Domingo, 1=Lunes, ..., 6=Sábado
  "period": "D"  // Requerido por compatibilidad
}
```

### 3. **PATTERN** - Patrón Cíclico Personalizado
Quests que siguen un patrón repetitivo de días activos/inactivos.

**Ejemplo**: Quest activa 2 días, descansa 1 día
```json
{
  "periodType": "PATTERN",
  "periodPattern": "1,1,0",  // 1=activo, 0=descanso
  "patternStartDate": "2025-11-01",
  "period": "D"
}
```

---

## Flujo de Vida de una Quest

### 1️⃣ **Asignación Inicial** (assignQuestToUser)
```
Usuario registrado → loadQuests → assignQuestToUser
  ↓
Busca quests activas con levelRequired <= user.level
  ↓
¿Tiene details con needParam=true?
  ├─ SÍ → Crea QuestsUser en estado 'P'
  └─ NO → Crea QuestsUser en estado 'N'
  ↓
Crea QuestsUserDetail por cada detail de la quest
```

### 1.5️⃣ **Ingreso de Parámetros** (submitParams) - Solo si estado 'P'
```
Quest en estado 'P' → Usuario ve formulario
  ↓
Usuario ingresa valores (ej: "Haz {value} flexiones" → value=30)
  ↓
submitParams guarda valores en QuestsUserDetail
  ↓
Estado 'P' → 'N' (ahora lista para activar)
```

### 2️⃣ **Activación** (activateQuest)
```
Usuario hace click en "Activar Quest" (solo si estado 'N')
  ↓
Estado 'N' → 'L'
  ↓
Se calcula dateExpiration (siempre a las 03:00 del día válido)
  ↓
- Si hoy es válido: expira a las 03:00 del siguiente día válido
- Si hoy NO es válido: expira a las 03:00 del próximo día válido
```

**Ejemplo**: Quest WEEKDAYS (L-M-V) activada el martes
```
Martes 18:00 → activate
  ↓
shouldBeActiveOnDate() = false (martes no es L-M-V)
  ↓
dateExpiration = Miércoles 03:00
```

### 3️⃣ **Progreso** (checkDetailQuest)
```
Usuario marca subtareas como completadas
  ↓
QuestsUserDetail.isChecked = true
  ↓
Si TODOS los details están checked → estado 'C'
```

### 4️⃣ **Finalización** (processQuestCompletion)
```
Estado 'C' o 'E' → procesar recompensas
  ↓
rewardService.processQuestRewards(questUser, transaction)
  ├─ Aplica recompensas (C) o penalizaciones (E)
  ├─ Actualiza user.totalExp
  └─ Marca rewardDelivered = true
  ↓
Si period = 'U' → estado 'F' (finalizada)
Si period != 'U' → permanece en 'C' o 'E'
  ↓
Calcula dateExpiration para próximo ciclo
```

### 5️⃣ **Reactivación** (updateQuestStates en loadQuests)
```
loadQuests → updateQuestStates
  ↓
PRIORIDAD 1: Procesar recompensas pendientes
  ├─ Busca quests en estado 'C' o 'E' con rewardDelivered=false
  └─ Llama a processQuestCompletion para entregar recompensas
  ↓
PRIORIDAD 2-3: Reactivar quests periódicas
  ├─ Busca quests en estado 'C' o 'E' con rewardDelivered=true
  └─ Si dateExpiration <= now Y hoy es día válido:
      ├─ Resetea todos los details a isChecked=false
      ├─ Estado → 'L'
      ├─ finished = false, rewardDelivered = false
      └─ Calcula nueva dateExpiration
  ↓
Si hoy NO es válido:
  └─ Reprograma dateExpiration al próximo día válido (sin reactivar)
```

---

## Sistema de Expiración

### ⏰ Hora Estándar: 03:00
**TODAS las quests expiran a las 03:00** del día válido correspondiente. No hay margen personalizado.

### Cálculo de Expiración

#### Primera Activación
```javascript
// Función: periodUtils.computeFirstActivationExpiration()

if (periodType === 'FIXED') {
  // Expira a las 03:00 del siguiente período (día/semana/mes)
  return computeNextExpiration(header, now);
}

if (periodType === 'WEEKDAYS' || periodType === 'PATTERN') {
  const isTodayValid = shouldBeActiveOnDate(header, now);
  
  if (!isTodayValid) {
    // Hoy NO es válido → próximo día válido a las 03:00
    return computeNextExpiration(header, now);
  }
  
  // Hoy SÍ es válido → siguiente día válido a las 03:00
  return computeNextExpiration(header, now);
}
```

#### Ejemplo Completo: Usuario Nuevo en Martes

**Quest**: WEEKDAYS (L-M-V) con `activeDays="1,3,5"`

| Momento | Acción | dateExpiration | Estado |
|---------|--------|----------------|--------|
| Martes 18:00 | Usuario registrado | - | N |
| Martes 18:05 | `activate` llamado | Miércoles 03:00 | Rechazado, espera día válido |
| Miércoles 08:00 | `loadQuests` | Miércoles 03:00 (ya pasó) | L |
| Miércoles 10:00 | Usuario completa | Viernes 03:00 | C (rewardDelivered=true) |
| Viernes 08:00 | `loadQuests` | Lunes 03:00 | L (reactivada) |

---

## Sistema de Recompensas

### Tipos de Objetos (QuestsObject.type)

| Tipo | Aplicación | Descripción |
|------|-----------|-------------|
| **R** | Reward | Solo si quest completada (C) |
| **P** | Penalty | Solo si quest expirada (E) |
| **A** | All | Tanto en C como en E |

### Procesamiento de Recompensas

**Servicio**: `rewardService.processQuestRewards(questUser, transaction)`

```javascript
// 1. Verificar que rewardDelivered = false
if (questUser.rewardDelivered) return;

// 2. Obtener objetos según estado
const type = (questUser.state === 'C') ? 'R' : 'P';
const objects = await QuestsObject.findAll({ 
  where: { idQuest: questUser.idQuest, type } 
});

// 3. Aplicar efectos al usuario
for (const obj of objects) {
  if (obj.type === 'experience') {
    // Recompensa: suma XP
    // Penalización: resta XP (nunca < 0)
    const delta = (type === 'P') ? -quantity : quantity;
    UPDATE users SET totalExp = GREATEST(0, totalExp + delta);
  }
  // Otros tipos de objetos: implementar aquí
}

// 4. Marcar como entregado
questUser.rewardDelivered = true;
await questUser.save();
```

### Sistema de Niveles

El nivel del usuario se calcula dinámicamente en función de `totalExp`:

```javascript
// levelService.js
function xpToLevelUp(n, B=150, L=50, C=1.0) {
  return Math.round(B + (n * L) + (n * n * C));
}

// Fórmula: XP(nivel) = XP(nivel-1) + B + (nivel * L) + (nivel² * C)
```

**Ejemplo**: 
- Nivel 1→2: 150 + (1×50) + (1²×1) = 201 XP
- Nivel 2→3: 201 + 150 + (2×50) + (4×1) = 455 XP total

---

## Tablas de la Base de Datos

### 1. quests_headers
Plantillas de quests (una por tipo de quest)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | PK |
| title | STRING | Título de la quest |
| description | TEXT | Descripción detallada |
| welcomeMessage | TEXT | Mensaje al activar |
| periodType | STRING | FIXED / WEEKDAYS / PATTERN |
| period | CHAR(1) | D/W/M/U |
| activeDays | STRING | "1,3,5" para WEEKDAYS |
| periodPattern | STRING | "1,1,0" para PATTERN |
| patternStartDate | DATE | Inicio del patrón |
| duration | INTEGER | ⚠️ DEPRECATED (no se usa) |
| levelRequired | INTEGER | Nivel mínimo |
| active | BOOLEAN | Si está disponible |

### 2. quests_details
Plantillas de subtareas de cada quest

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | PK |
| idQuest | INTEGER | FK → quests_headers |
| description | STRING | "Haz {value} flexiones" |
| needParam | BOOLEAN | Si requiere input del usuario |
| labelParam | STRING | Label del input |
| descriptionParam | STRING | Descripción del input |
| isEditable | BOOLEAN | Si se puede modificar |
| paramType | STRING | number / string / boolean |

### 3. quests_objects
Recompensas y penalizaciones

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | PK |
| idQuest | INTEGER | FK → quests_headers |
| idObject | INTEGER | FK → objects (experience, items, etc.) |
| quantity | INTEGER | Cantidad |
| type | CHAR(1) | R (reward) / P (penalty) / A (all) |

### 4. quests_users
Instancias de quests asignadas a usuarios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | PK |
| idUser | INTEGER | FK → users |
| idQuest | INTEGER | FK → quests_headers |
| state | CHAR(1) | N/P/L/C/E/F |
| finished | BOOLEAN | Si ha sido procesada |
| rewardDelivered | BOOLEAN | Si recompensa entregada |
| dateCreated | DATE | Fecha de asignación |
| dateRead | DATE | Fecha de activación |
| dateExpiration | DATE | Fecha de expiración |
| dateFinished | DATE | Fecha de finalización |

### 5. quests_users_detail
Estado de cada subtarea por usuario

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | PK |
| idUser | INTEGER | FK → users |
| idQuest | INTEGER | FK → quests_headers |
| idDetail | INTEGER | FK → quests_details |
| value | TEXT | Valor ingresado por usuario |
| isChecked | BOOLEAN | Si está completada |
| dateUpdated | DATE | Última actualización |

### 6. quests_user_logs
Historial de quests completadas/expiradas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | PK |
| idUser | INTEGER | FK → users |
| idQuest | INTEGER | FK → quests_headers |
| result | CHAR(1) | C (completed) / E (expired) |
| rewards | JSON | Recompensas aplicadas |
| dateFinished | DATE | Fecha de finalización |
| meta | JSON | Metadata adicional |

---

## API Endpoints

### POST /api/quests/load
Carga todas las quests del usuario (activas y nuevas)

**Request:**
```json
{
  "userId": 9
}
```

**Response:**
```json
{
  "questsRewarded": [
    {
      "idQuest": 5,
      "state": "C",
      "objects": [
        { "type": "experience", "quantity": 50 }
      ]
    }
  ],
  "quests": [
    {
      "idQuestUser": 18,
      "header": {
        "idQuestHeader": 5,
        "title": "Ejercicio Diario",
        "description": "Mantente activo",
        "welcomeMessage": "¡A moverse!",
        "period": "D",
        "duration": 1440
      },
      "state": "L",
      "dateExpiration": "2025-11-13T03:00:00.000Z",
      "details": [
        {
          "idQuestUserDetail": 45,
          "idDetail": 12,
          "description": "Haz 20 flexiones",
          "checked": false
        }
      ]
    }
  ]
}
```

**Proceso:**
1. `updateQuestStates()`: Procesa C/E, reactiva periódicas
2. `assignQuestToUser()`: Asigna nuevas quests según nivel
3. `getUserQuests()`: Retorna quests en estados N/P/L/C

### POST /api/quests/activate
Activa una quest (N → L)

**Request:**
```json
{
  "userId": 9,
  "idQuest": 18  // idQuestUser (quests_users.id)
}
```

**Response:**
```json
[{
  "idQuestUser": 18,
  "header": { ... },
  "state": "L",
  "dateExpiration": "2025-11-13T03:00:00.000Z",
  "details": [...]
}]
```

### POST /api/quests/submit-params
Ingresa parámetros para quests con needParam=true

**Request:**
```json
{
  "userId": 9,
  "idQuest": 18,
  "values": [
    { "idDetail": 12, "value": "30" }
  ]
}
```

**Response:**
```json
[{
  "idQuestUser": 18,
  "state": "N",  // P → N después de ingresar params
  "details": [
    {
      "idQuestUserDetail": 45,
      "value": "30",
      "checked": false
    }
  ]
}]
```

### POST /api/quests/check-detail
Marca una subtarea como completada/no completada

**Request:**
```json
{
  "userId": 9,
  "idQuestUserDetail": 45,
  "checked": true
}
```

**Response:**
```json
[{
  "idQuestUser": 18,
  "state": "L",  // Si todos checked=true → "C"
  "details": [
    {
      "idQuestUserDetail": 45,
      "checked": true
    }
  ]
}]
```

---

## Casos de Uso Comunes

### 📌 Caso 1: Usuario Nuevo con Quest que Requiere Parámetros
```
1. Usuario se registra → nivel 1
2. loadQuests → assignQuestToUser
   - Asigna quest "Ejercicio Diario" con levelRequired=1
   - Quest tiene detail: "Haz {value} flexiones" (needParam=true)
   - Estado: 'P' (Pending Parameters)
3. Usuario ve quest con formulario para ingresar valor
4. Usuario ingresa "30" en el campo flexiones
5. submitParams → guarda value=30
   - Estado: 'P' → 'N'
6. Usuario ve quest lista para activar
7. Usuario activa quest → activate
   - Estado: 'N' → 'L'
   - dateExpiration = mañana 03:00
8. Usuario completa las 30 flexiones y marca como checked
   - Estado: 'L' → 'C'
   - processQuestCompletion entrega recompensa (+50 XP)
```

### 📌 Caso 2: Quest WEEKDAYS en Día No Válido
```
1. Usuario se registra → nivel 1
2. loadQuests → assignQuestToUser
   - Asigna todas las quests con levelRequired <= 1
   - Estado: 'N' (sin activar)
3. Usuario ve lista de quests disponibles
4. Usuario activa una quest → activate
   - Estado: 'N' → 'L'
   - dateExpiration = mañana 03:00
```

### 📌 Caso 2: Quest WEEKDAYS en Día No Válido
```
Quest: L-M-V (activeDays="1,3,5")
Usuario activa el martes (día 2)

1. Quest asignada en estado 'N' (sin parámetros)
2. activate → shouldBeActiveOnDate() = false
3. dateExpiration = miércoles 03:00 (próximo día válido)
4. Martes 23:00: quest aún en 'N', esperando día válido
5. Miércoles 08:00: loadQuests
   - updateQuestStates verifica: hoy ES válido
   - dateExpiration aún no ha llegado
   - Quest sigue en 'N', usuario debe activar manualmente
```

### 📌 Caso 3: Quest Completada y Reactivación
```
Lunes 10:00: Usuario completa quest diaria
  ↓
Estado: 'L' → 'C'
processQuestCompletion:
  - Aplica recompensa (+50 XP)
  - rewardDelivered = true
  - dateExpiration = martes 03:00
  ↓
Martes 08:00: loadQuests → updateQuestStates
  ↓
dateExpiration <= now → reactiva
  - Estado: 'C' → 'L'
  - Resetea todos los details a isChecked=false
  - rewardDelivered = false
  - dateExpiration = miércoles 03:00
```

### 📌 Caso 4: Quest Expirada
```
Usuario activa quest pero no la completa
  ↓
dateExpiration llega → updateQuestStates
  ↓
Estado: 'L' → 'E'
processQuestCompletion:
  - Aplica penalización (-30 XP)
  - rewardDelivered = true
  - dateExpiration = siguiente día válido 03:00
  ↓
Siguiente ciclo: loadQuests → reactiva igual que 'C'
```

---

## 🔧 Funciones Clave

### questService.js

| Función | Propósito |
|---------|-----------|
| `assignQuestToUser(userId)` | Asigna quests nuevas según nivel |
| `activateQuest(userId, questUserId)` | Activa quest: N → L |
| `updateQuestStates(userId)` | Procesa C/E, reactiva periódicas |
| `processQuestCompletion(userId, questUser)` | Aplica recompensas/penalizaciones |
| `getUserQuests(userId)` | Retorna quests visibles (N/P/L/C) |
| `saveQuestParams(userId, idQuest, values)` | Guarda parámetros |
| `setQuestUserDetailChecked(userId, {...})` | Marca detail como checked |

### periodUtils.js

| Función | Propósito |
|---------|-----------|
| `computeNextExpiration(header, fromDate)` | Calcula próxima expiración a las 03:00 |
| `computeFirstActivationExpiration(header, date)` | Calcula expiración en primera activación |
| `shouldBeActiveOnDate(header, date)` | ¿Hoy es día válido para esta quest? |
| `validatePeriodConfig(header)` | Valida configuración de periodicidad |

### rewardService.js

| Función | Propósito |
|---------|-----------|
| `processQuestRewards(questUser, transaction)` | Aplica recompensas/penalizaciones |
| `checkObjectExperience(transaction)` | Asegura que existe objeto de experiencia |

---

## 🎯 Reglas de Negocio Importantes

1. **Quests con needParam=true empiezan en estado 'P'**, no 'N'
2. **Solo quests en estado 'N' pueden ser activadas** (no 'P')
3. **Una quest solo puede estar en un estado a la vez**
4. **Las recompensas se aplican UNA SOLA VEZ** (rewardDelivered=true)
5. **updateQuestStates SIEMPRE procesa recompensas pendientes ANTES de reactivar**
6. **Todas las quests expiran a las 03:00** (sin excepciones)
7. **Solo las quests con period='U' van a estado 'F'** (finalizadas permanentemente)
8. **Las quests periódicas se reactivan automáticamente** en el próximo ciclo válido
9. **Al reactivar, TODOS los details se resetean** (isChecked=false)
10. **La experiencia nunca puede ser negativa** (GREATEST(0, totalExp + delta))
11. **Las transacciones garantizan atomicidad** (todo o nada)

---

## 📊 Diagrama de Estados Simplificado

```
┌─────────────────────────────────────────────────────────┐
│                    QUEST LIFECYCLE                       │
└─────────────────────────────────────────────────────────┘

   assignQuestToUser
         ↓
    ¿needParam=true?
      ├─ SÍ ──→ ┌────────┐
      │         │   P    │  Pending (esperando parámetros)
      │         │ (Pend) │
      │         └───┬────┘
      │             │ submitParams
      │             ↓
      └─ NO ───→ ┌────────┐
                 │   N    │  New (lista para activar)
                 │ (New)  │
                 └───┬────┘
                     │ activate
                     ↓
                 ┌────────┐
                 │   L    │  Live (activa)
                 │ (Live) │
                 └───┬────┘
                     │
                     ├─→ Todos checked ──→ ┌────────┐
                     │                     │   C    │  Completed
                     │                     │ (Done) │
                     │                     └───┬────┘
                     │                         │
                     └─→ dateExpiration ──→ ┌────────┐
                                             │   E    │  Expired
                                             │ (Fail) │
                                             └───┬────┘
                                                 │
             ┌───────────────────────────────────┴─────────────────┐
             │                                                     │
             │ period = 'U'                       period != 'U'    │
             ↓                                                     ↓
         ┌────────┐                              ┌─────────────────┐
         │   F    │  Finished                    │ 1. Procesa      │
         │ (End)  │  (permanente)                │    recompensas  │
         └────────┘                              │ 2. Espera ciclo │
                                                 │ 3. REACTIVA     │
                                                 └──────┬──────────┘
                                                        │
                                                        └──→ L
```

---

## 🚀 Resumen de Mejoras Recientes

1. ✅ **Flujo de estados corregido**: P (params) → N (new) → L (live)
2. ✅ **Procesamiento de recompensas prioritario**: updateQuestStates procesa recompensas ANTES de reactivar
3. ✅ **Eliminado margen de duration personalizado**: Todas expiran a las 03:00
4. ✅ **Estados correctos para periódicas**: C/E con rewardDelivered, no 'F'
5. ✅ **Reactivación automática**: En loadQuests cuando llega dateExpiration
6. ✅ **Reset de details**: Al reactivar, todos isChecked=false
7. ✅ **Integración con rewardService**: Eliminada lógica duplicada
8. ✅ **Periodicidad personalizada**: WEEKDAYS y PATTERN soportados

---

## 📞 Contacto y Soporte

Para dudas sobre el sistema de quests, revisar:
- `src/services/questService.js` - Lógica principal
- `src/utils/periodUtils.js` - Cálculo de periodicidad
- `src/services/rewardService.js` - Sistema de recompensas
- `tests/quests.test.js` - Tests unitarios

---

**Última actualización**: Noviembre 12, 2025
