# Análisis de APIs de Quests - Respuestas al Frontend

Este documento detalla qué devuelve el backend al frontend en cada llamada relacionada con quests, especialmente después de implementar el sistema de misiones periódicas (fixed, weekdays y patrones).

---

## 📋 Resumen de Endpoints

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/api/quests/load` | POST | Cargar todas las quests del usuario |
| `/api/quests/activate` | POST | Activar una quest específica |
| `/api/quests/submit-params` | POST | Enviar parámetros de una quest |
| `/api/quests/check-detail-quest` | POST | Marcar/desmarcar un detalle de quest |

---

## 1. 🔄 POST `/api/quests/load`

### Entrada esperada:
```json
{
  "userId": 123
}
```

### Proceso interno:
1. **`updateQuestStates(userId)`**: Actualiza estados de quests (expiraciones, completadas, reactivaciones)
2. **`assignQuestToUser(userId)`**: Asigna nuevas quests disponibles según nivel
3. **`getUserQuests(userId)`**: Obtiene todas las quests activas del usuario

### Respuesta exitosa (200):
```json
{
  "questsRewarded": [
    {
      "idQuest": 5,
      "state": "C",
      "objects": [
        {
          "idObject": 2,
          "shortName": "exp",
          "name": "Experiencia",
          "quantity": 50,
          "type": "R"
        }
      ]
    }
  ],
  "quests": [
    {
      "idQuestUser": 42,
      "header": {
        "idQuestHeader": 5,
        "title": "Caminar 10,000 pasos",
        "description": "Completa tu objetivo diario de pasos",
        "welcomeMessage": "¡Es hora de moverse!",
        "period": "D",
        "duration": 1
      },
      "state": "N",
      "dateRead": null,
      "dateExpiration": null,
      "details": [
        {
          "idQuestUserDetail": 101,
          "idDetail": 10,
          "description": "Camina 10,000 pasos hoy",
          "needParam": false,
          "paramType": "string",
          "labelParam": null,
          "descriptionParam": null,
          "isEditable": false,
          "value": null,
          "checked": false
        }
      ]
    }
  ]
}
```

### Estados de quest incluidos:
- **'N'**: Nueva, no leída
- **'P'**: Pendiente de parámetros
- **'L'**: Live (activa)
- **'C'**: Completada (recién terminada, aún no procesada)

### ⚠️ Posibles problemas para el frontend:

#### A) Campo `questsRewarded`
- **Qué contiene**: Quests que acaban de ser procesadas (completadas o expiradas) y cuyos rewards se acaban de entregar
- **Problema**: El frontend podría estar esperando esto en un formato diferente o no saber cómo mostrar las recompensas
- **Estados en `questsRewarded`**: 'C' (completada) o 'E' (expirada)
- **Estas quests YA NO aparecen en el array `quests`** porque están finalizadas

#### B) Campo `period` en header
- **Valores posibles**:
  - `'U'`: Única (no se repite)
  - `'D'`: Diaria
  - `'W'`: Semanal
  - `'M'`: Mensual
  - `'R'`: Recurrente (custom)
- **Nuevo**: Ahora las quests pueden tener `periodType`:
  - `'fixed'`: Días fijos (ej: lunes, miércoles, viernes)
  - `'weekdays'`: Solo días laborables
  - `'pattern'`: Patrón personalizado (ej: cada 3 días)

#### C) Campo `dateExpiration`
- Para quests en estado **'N'** o **'P'**: será `null` (aún no activadas)
- Para quests en estado **'L'**: tendrá la fecha de expiración calculada según periodicidad
- **Importante**: Las expiraciones ahora se calculan con `periodUtils.computeFirstActivationExpiration()` considerando:
  - Tipo de periodicidad
  - Días válidos (weekdays, fixed days, patterns)
  - Siempre expiran a las **03:00 AM** del siguiente día válido

#### D) Campo `duration`
- Ahora es **ignorado** para el cálculo de expiración
- Todas las quests expiran a las 03:00 del siguiente día válido según su periodicidad
- El frontend NO debería usar este campo para calcular cuándo expira una quest

---

## 2. ✅ POST `/api/quests/activate`

### Entrada esperada:
```json
{
  "userId": 123,
  "idQuest": 42
}
```
**Nota**: `idQuest` aquí se refiere al `quests_users.id` (NOT `quests_headers.id`)

### Proceso interno:
1. Verifica que la quest esté en estado **'N'**
2. Calcula `dateExpiration` usando `periodUtils.computeFirstActivationExpiration()`
3. Cambia estado a **'L'** (Live)
4. Establece `dateRead` a la fecha actual

### Respuesta exitosa (200):
```json
{
  "quests": [
    {
      "idQuestUser": 42,
      "header": {
        "idQuestHeader": 5,
        "title": "Caminar 10,000 pasos",
        "description": "Completa tu objetivo diario de pasos",
        "welcomeMessage": "¡Es hora de moverse!",
        "period": "D",
        "duration": 1
      },
      "state": "L",
      "dateRead": "2025-11-12T14:30:00.000Z",
      "dateExpiration": "2025-11-13T03:00:00.000Z",
      "details": [
        {
          "idQuestUserDetail": 101,
          "idDetail": 10,
          "description": "Camina 10,000 pasos hoy",
          "needParam": false,
          "paramType": "string",
          "labelParam": null,
          "descriptionParam": null,
          "isEditable": false,
          "value": null,
          "checked": false
        }
      ]
    }
  ]
}
```

### Errores posibles:
- **400**: Quest no está en estado 'N' → `{ "error": "Quest must be in state N to activate" }`
- **404**: Quest no encontrada → `{ "error": "Quest not found or could not be activated" }`

### ⚠️ Posibles problemas para el frontend:

#### A) Cálculo de expiración
- El frontend NO debería calcular la expiración por su cuenta
- Debe confiar en el campo `dateExpiration` devuelto por el backend
- **Problema**: Si el frontend está usando `duration` para mostrar countdown, estará incorrecto para quests con periodicidad weekdays/fixed/pattern

#### B) Estado 'L'
- Quest activada = estado **'L'** (no 'A' ni 'ACTIVE')
- El frontend debe reconocer 'L' como "activa y jugable"

---

## 3. 📝 POST `/api/quests/submit-params`

### Entrada esperada (flexible):
```json
{
  "userId": 123,
  "idQuest": 42,
  "values": [
    {
      "idDetail": 10,
      "value": "5000"
    },
    {
      "idDetail": 11,
      "value": 30
    }
  ]
}
```

O formato alternativo:
```json
{
  "idUser": 123,
  "idQuest": 42,
  "values": [
    {
      "value": {
        "idDetail": 10,
        "value": "5000"
      },
      "idUser": 123,
      "idQuest": 42
    }
  ]
}
```

### Proceso interno:
1. Valida que los valores coincidan con el `paramType` de cada detalle
2. Guarda los valores en `quests_users_detail`
3. Cambia el estado de la quest de **'P'** a **'N'**
4. Devuelve la quest actualizada

### Respuesta exitosa (200):
```json
{
  "quests": [
    {
      "idQuestUser": 42,
      "header": {
        "idQuestHeader": 5,
        "title": "Ejercicio matutino",
        "description": "Registra tu rutina",
        "welcomeMessage": null,
        "period": "D",
        "duration": 1
      },
      "state": "N",
      "dateRead": null,
      "dateExpiration": null,
      "details": [
        {
          "idQuestUserDetail": 101,
          "idDetail": 10,
          "description": "Minutos de ejercicio",
          "needParam": true,
          "paramType": "number",
          "labelParam": "Minutos",
          "descriptionParam": "¿Cuántos minutos hiciste ejercicio?",
          "isEditable": true,
          "value": "30",
          "checked": false
        }
      ]
    }
  ]
}
```

### Errores posibles:
- **400**: Validación fallida → `{ "error": "Validation failed", "details": [...] }`
- **400**: Parámetros faltantes → `{ "error": "userId, idQuest and values are required" }`

### ⚠️ Posibles problemas para el frontend:

#### A) Campo `paramType`
- **Valores posibles**: `'string'`, `'number'`
- Si es `'number'`, el backend valida que sea un número válido
- **Problema**: El frontend debe validar esto ANTES de enviar para evitar errores

#### B) Campo `value` siempre es string
- Aunque el `paramType` sea `'number'`, el campo `value` se almacena como **string**
- El frontend debe convertir a número si lo necesita para mostrar

#### C) Estado post-submit
- Después de enviar parámetros, la quest vuelve a estado **'N'**
- NO se activa automáticamente, el usuario debe activarla con `/activate`

---

## 4. ☑️ POST `/api/quests/check-detail-quest`

### Entrada esperada:
```json
{
  "userId": 123,
  "idQuestUserDetail": 101,
  "checked": true
}
```

### Proceso interno:
1. Actualiza el campo `isChecked` del detalle
2. Verifica si TODOS los detalles de la quest están checked
3. Si todos están checked, cambia el estado de la quest a **'C'** (Completada)
4. Devuelve la quest actualizada

### Respuesta exitosa (200):
```json
{
  "quests": [
    {
      "idQuestUser": 42,
      "header": {
        "idQuestHeader": 5,
        "title": "Caminar 10,000 pasos",
        "description": "Completa tu objetivo diario de pasos",
        "welcomeMessage": "¡Es hora de moverse!",
        "period": "D",
        "duration": 1
      },
      "state": "C",
      "dateRead": "2025-11-12T14:30:00.000Z",
      "dateExpiration": "2025-11-13T03:00:00.000Z",
      "details": [
        {
          "idQuestUserDetail": 101,
          "idDetail": 10,
          "description": "Camina 10,000 pasos hoy",
          "needParam": false,
          "paramType": "string",
          "labelParam": null,
          "descriptionParam": null,
          "isEditable": false,
          "value": null,
          "checked": true
        }
      ]
    }
  ]
}
```

### Errores posibles:
- **400**: Parámetros faltantes → `{ "error": "userId, idQuestUserDetail and checked are required" }`
- **404**: Detalle no encontrado → `{ "error": "Detail not found or does not belong to user" }`

### ⚠️ Posibles problemas para el frontend:

#### A) Auto-completado
- Si el usuario marca el ÚLTIMO detalle, la quest cambia automáticamente a estado **'C'**
- **La quest NO aparecerá más en la lista de quests activas** en el siguiente `/load`
- En su lugar, aparecerá en `questsRewarded` con los objetos obtenidos

#### B) Rewards no inmediatos
- Cuando una quest pasa a 'C', los rewards **NO se procesan inmediatamente**
- Se procesan en el siguiente `/load` mediante `updateQuestStates()`
- **Problema**: El frontend podría esperar ver rewards inmediatamente después de completar

---

## 🔍 Estructura Detallada del Objeto Quest

```typescript
interface Quest {
  idQuestUser: number;           // PK de quests_users
  header: {
    idQuestHeader: number;        // PK de quests_headers (template)
    title: string;
    description: string;
    welcomeMessage: string | null;
    period: 'U' | 'D' | 'W' | 'M' | 'R';  // Tipo de periodicidad
    duration: number;             // ⚠️ YA NO SE USA para expiración
  };
  state: 'N' | 'P' | 'L' | 'C' | 'E' | 'F';
  dateRead: string | null;        // ISO timestamp
  dateExpiration: string | null;  // ISO timestamp, calculado por backend
  details: QuestDetail[];
}

interface QuestDetail {
  idQuestUserDetail: number;      // PK de quests_users_detail
  idDetail: number;               // FK a quests_details (template)
  description: string;
  needParam: boolean;             // Si requiere entrada del usuario
  paramType: 'string' | 'number'; // Tipo de parámetro esperado
  labelParam: string | null;      // Label para el input
  descriptionParam: string | null; // Ayuda para el input
  isEditable: boolean;            // Si se puede editar después
  value: string | null;           // Valor ingresado (siempre string)
  checked: boolean;               // Si está marcado como completado
}

interface QuestReward {
  idQuest: number;                // quests_headers.id
  state: 'C' | 'E';               // C=Completada, E=Expirada
  objects: RewardObject[];
}

interface RewardObject {
  idObject: number;
  shortName: string;              // ej: "exp", "gold", "item_1"
  name: string;
  quantity: number;
  type: 'R' | 'P' | 'A';         // R=Reward, P=Penalty, A=Always
}
```

---

## 🚨 Principales Problemas Potenciales para el Frontend

### 1. **Periodicidad con tipos especiales**
- **Problema**: El frontend puede no estar manejando quests con `periodType` = 'weekdays', 'fixed', 'pattern'
- **Síntoma**: Quests que no deberían estar activas aparecen activas, o viceversa
- **Solución**: El backend maneja esto correctamente, pero el frontend no debería intentar calcular validez de días

### 2. **Campo `duration` obsoleto**
- **Problema**: Si el frontend usa `duration` para calcular expiración o mostrar countdown
- **Síntoma**: Tiempos de expiración incorrectos
- **Solución**: Usar SOLO `dateExpiration` del backend

### 3. **Rewards diferidos**
- **Problema**: Rewards no se procesan inmediatamente al completar
- **Síntoma**: Usuario completa quest pero no ve rewards hasta el siguiente `/load`
- **Solución**: Después de completar, hacer un `/load` para obtener `questsRewarded`

### 4. **Estados de quest**
- **Problema**: Frontend esperando estados diferentes ('ACTIVE' en vez de 'L')
- **Síntoma**: Quests no se muestran correctamente según su estado
- **Solución**: Mapear correctamente:
  - `'N'` → Nueva/Disponible para activar
  - `'P'` → Requiere parámetros
  - `'L'` → Activa (Live)
  - `'C'` → Completada (aparecerá en questsRewarded en próximo load)
  - `'E'` → Expirada (aparecerá en questsRewarded en próximo load)
  - `'F'` → Finalizada (no aparece más)

### 5. **Reactivación de quests periódicas**
- **Problema**: Frontend puede pensar que una quest 'C' está "terminada para siempre"
- **Síntoma**: Quests diarias no reaparecen al día siguiente
- **Solución**: El backend reactiva automáticamente en `updateQuestStates()`, el frontend solo debe hacer `/load` cada día

### 6. **Formato de `values` en submit-params**
- **Problema**: Backend acepta múltiples formatos, puede causar confusión
- **Síntoma**: Submit falla con errores de validación
- **Solución**: Usar formato estándar: `{ idDetail, value }`

### 7. **Campo `welcomeMessage` puede ser null**
- **Problema**: Frontend intentando mostrar `header.welcomeMessage` sin verificar null
- **Síntoma**: Errores de undefined/null en UI
- **Solución**: Verificar null y usar fallback o no mostrar

---

## 📊 Flujo Completo de una Quest Periódica

```
Día 1 - 08:00 AM:
┌─────────────────────────────────────────┐
│ /load                                    │
│ - assignQuestToUser crea quest 'N'      │
│ - Quest aparece en quests[]             │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ /activate (idQuest=42)                  │
│ - Quest pasa a estado 'L'               │
│ - dateExpiration = Día 2 03:00 AM       │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Usuario completa detalles...            │
│ /check-detail-quest (última tarea)      │
│ - Quest pasa a estado 'C'               │
└─────────────────────────────────────────┘

Día 2 - 08:00 AM:
┌─────────────────────────────────────────┐
│ /load                                    │
│ - updateQuestStates procesa quest 'C'   │
│ - Entrega rewards (exp, items, etc)     │
│ - Quest pasa a 'F' (si period='U')      │
│   o se resetea a 'L' (si periódica)     │
│ - Rewards aparecen en questsRewarded[]  │
│ - Quest periódica reaparece en quests[] │
└─────────────────────────────────────────┘
```

---

## ✅ Recomendaciones para el Frontend

1. **NO calcular expiraciones**: Confiar en `dateExpiration` del backend
2. **NO usar `duration`**: Este campo es legacy y no se usa
3. **Hacer `/load` después de completar**: Para obtener rewards inmediatamente
4. **Mapear estados correctamente**: 'L' = activa, no 'ACTIVE'
5. **Verificar `null` en campos opcionales**: `welcomeMessage`, `labelParam`, etc.
6. **Validar `paramType` antes de enviar**: Para evitar errores en submit-params
7. **Mostrar `questsRewarded` separadamente**: No están en la lista de quests activas
8. **Hacer `/load` al inicio del día**: Para obtener quests periódicas reactivadas

---

## 🔄 Cambios Recientes que Afectan al Frontend

### Implementados recientemente:
1. **Sistema de periodicidad avanzado**: weekdays, fixed days, patterns
2. **Expiraciones a las 03:00 AM**: Todas las quests expiran a esta hora fija
3. **Campo `periodType` en headers**: Tipo de periodicidad (fixed/weekdays/pattern)
4. **Reactivación automática**: Quests periódicas se reactivan según su periodicidad
5. **Campo `rewardDelivered`**: Evita procesar rewards múltiples veces

### El frontend necesita actualizar:
- [ ] Lógica de cálculo de expiración (eliminarla, usar solo backend)
- [ ] Manejo de estados 'C' y 'E' como temporales
- [ ] Mostrar `questsRewarded` después de completar
- [ ] No asumir que quest 'C' está "terminada para siempre"
- [ ] UI para mostrar tipo de periodicidad (daily, weekdays only, etc.)

---

*Documento generado el 12 de noviembre de 2025*
