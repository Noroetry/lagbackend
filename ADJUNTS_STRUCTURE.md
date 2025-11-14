# Estructura Completa de Mensajes de Recompensas - Frontend

## Descripción General

Cuando una quest se completa o expira, el sistema crea automáticamente un mensaje con toda la información de las recompensas o penalizaciones aplicadas. El **título de la quest** está en el mensaje principal, mientras que `adjunts` contiene solo la información de los objetos otorgados/penalizados.

## Estructura del Mensaje Completo

```typescript
interface RewardMessage {
  id: number;                    // ID del messages_users
  title: string;                  // "Recompensa de misión" o "Penalización de misión"
  description: string;            // "La misión \"[título]\" te ha otorgado/aplicado..."
  questTitle: string;             // Título de la quest (extraído de description)
  type: 'info' | 'reward' | 'penalty';    // Tipo de mensaje (para mostrar de forma diferente)
  adjunts: Adjunt[];             // Array con detalles de cada recompensa/penalización
  dateRead: Date | null;          // Fecha de lectura (null si no leído)
  isRead: boolean;                // true si dateRead !== null
  createdAt: Date;                // Fecha de creación
}
```

## Estructura de cada Adjunt

Cada elemento del array `adjunts` contiene **SOLO** información del objeto de recompensa:

```typescript
interface Adjunt {
  id: number;                     // ID del ObjectItem (tabla objects)
  objectName: string;             // Nombre completo: "Experiencia", "Moneda", "Misión"
  shortName: string;              // Nombre corto: "EXP", "COIN", "QUEST"
  description: string;            // Descripción del objeto
  type: 'experience' | 'coin' | 'quest';  // Tipo del objeto
  quantity: number;               // Cantidad (+positivo = ganado, -negativo = perdido)
  
  // Solo para type="quest" (cuando se asigna otra quest como recompensa)
  questAssignedTitle?: string;    // Título de la quest asignada
  idQuestAssigned?: number;       // ID de la quest asignada
}
```

### Campos Detallados

| Campo | Tipo | Obligatorio | Descripción | Valores posibles |
|-------|------|-------------|-------------|------------------|
| `id` | `number` | ✅ | ID del objeto en la tabla `objects` | Integer positivo |
| `objectName` | `string` | ✅ | Nombre descriptivo del objeto | "Experiencia", "Moneda", "Misión" |
| `shortName` | `string` | ✅ | Abreviatura para UI | "EXP", "COIN", "QUEST" |
| `description` | `string` | ✅ | Descripción detallada | Cualquier texto |
| `type` | `string` | ✅ | Tipo de objeto | `"experience"`, `"coin"`, `"quest"` |
| `quantity` | `number` | ✅ | Cantidad otorgada/penalizada | Positivo (ganancia) o negativo (pérdida) |
| `questAssignedTitle` | `string` | ⚠️ Solo si type="quest" | Título de quest asignada como premio | String |
| `idQuestAssigned` | `number` | ⚠️ Solo si type="quest" | ID de quest asignada como premio | Integer |

## Ejemplos por Tipo de Objeto

### 1. Experience (Experiencia)

**Recompensa (ganancia):**
```json
{
  "id": 1,
  "objectName": "Experiencia",
  "shortName": "EXP",
  "description": "Puntos de experiencia del jugador",
  "type": "experience",
  "quantity": 500
}
```

**Penalización (pérdida):**
```json
{
  "id": 1,
  "objectName": "Experiencia",
  "shortName": "EXP",
  "description": "Puntos de experiencia del jugador",
  "type": "experience",
  "quantity": -100
}
```

### 2. Coin (Moneda)

**Recompensa:**
```json
{
  "id": 2,
  "objectName": "Moneda",
  "shortName": "COIN",
  "description": "Monedas del juego",
  "type": "coin",
  "quantity": 1000
}
```

**Penalización:**
```json
{
  "id": 2,
  "objectName": "Moneda",
  "shortName": "COIN",
  "description": "Monedas del juego",
  "type": "coin",
  "quantity": -200
}
```

### 3. Quest (Misión Asignada)

**Solo en recompensas (nunca en penalizaciones):**
```json
{
  "id": 3,
  "objectName": "Misión",
  "shortName": "QUEST",
  "description": "Asigna una misión especial al usuario",
  "type": "quest",
  "quantity": 1,
  "questAssignedTitle": "Desafío de Resistencia Extrema",
  "idQuestAssigned": 15
}
```
```

## Ejemplo Completo: Mensaje con Múltiples Recompensas

```json
{
  "id": 456,
  "title": "Recompensa de misión",
  "description": "La misión \"Maestro del Entrenamiento\" te ha otorgado las siguientes recompensas:",
  "questTitle": "Maestro del Entrenamiento",
  "type": "reward",
  "adjunts": [
    {
      "id": 1,
      "objectName": "Experiencia",
      "shortName": "EXP",
      "description": "Puntos de experiencia del jugador",
      "type": "experience",
      "quantity": 500
    },
    {
      "id": 2,
      "objectName": "Moneda",
      "shortName": "COIN",
      "description": "Monedas del juego",
      "type": "coin",
      "quantity": 1000
    },
    {
      "id": 3,
      "objectName": "Misión",
      "shortName": "QUEST",
      "description": "Asigna una misión especial al usuario",
      "type": "quest",
      "quantity": 1,
      "questAssignedTitle": "Desafío de Resistencia Extrema",
      "idQuestAssigned": 25
    }
  ],
  "type": "reward",
  "dateRead": null,
  "isRead": false,
  "createdAt": "2025-11-14T10:30:00.000Z"
}
```

**Nota importante**: El `questTitle` ("Maestro del Entrenamiento") se refiere a la quest que SE COMPLETÓ. Mientras que `questAssignedTitle` dentro del adjunt de tipo quest ("Desafío de Resistencia Extrema") se refiere a la quest que SE ASIGNÓ como recompensa.
```

## Ejemplo: Mensaje de Penalización

```json
{
  "id": 457,
  "title": "Penalización de misión",
  "description": "La misión \"Entrenamiento Diario\" te ha aplicado las siguientes penalizaciones:",
  "questTitle": "Entrenamiento Diario",
  "type": "penalty",
  "adjunts": [
    {
      "id": 1,
      "objectName": "Experiencia",
      "shortName": "EXP",
      "description": "Puntos de experiencia del jugador",
      "type": "experience",
      "quantity": -50
    },
    {
      "id": 2,
      "objectName": "Moneda",
      "shortName": "COIN",
      "description": "Monedas del juego",
      "type": "coin",
      "quantity": -100
    }
  ],
  "type": "penalty",
  "dateRead": null,
  "isRead": false,
  "createdAt": "2025-11-14T10:35:00.000Z"
}
```
```

## Uso en Frontend

### TypeScript Interfaces

```typescript
// types/rewards.ts

export type ObjectType = 'experience' | 'coin' | 'quest';
export type MessageType = 'info' | 'reward' | 'penalty';

export interface Adjunt {
  id: number;
  objectName: string;
  shortName: string;
  description: string;
  type: ObjectType;
  quantity: number;
  // Solo para type="quest"
  questAssignedTitle?: string;
  idQuestAssigned?: number;
}

export interface RewardMessage {
  id: number;
  title: string;
  description: string;
  questTitle: string;           // Título de la quest completada/expirada
  type: MessageType;
  adjunts: Adjunt[];
  dateRead: Date | null;
  isRead: boolean;
  createdAt: Date;
}
```

### Ejemplo de Renderizado en React

```typescript
import { Adjunt } from './types/rewards';

const AdjuntItem: React.FC<{ adjunt: Adjunt }> = ({ adjunt }) => {
  const getIcon = () => {
    switch (adjunt.type) {
      case 'experience':
        return '⭐';
      case 'coin':
        return '💰';
      case 'quest':
        return '🎯';
      default:
        return '📦';
    }
  };

  const getQuantityColor = () => {
    return adjunt.quantity >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const getQuantityPrefix = () => {
    return adjunt.quantity >= 0 ? '+' : '';
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-100 rounded">
      <span className="text-2xl">{getIcon()}</span>
      <div className="flex-1">
        <div className="font-semibold">{adjunt.objectName}</div>
        {adjunt.type === 'quest' && adjunt.questTitle && (
          <div className="text-sm text-gray-600">"{adjunt.questTitle}"</div>
        )}
        <div className="text-sm text-gray-500">{adjunt.description}</div>
      </div>
      <div className={`font-bold ${getQuantityColor()}`}>
        {getQuantityPrefix()}{adjunt.quantity} {adjunt.shortName}
      </div>
    </div>
  );
};

const RewardMessageDisplay: React.FC<{ message: RewardMessage }> = ({ message }) => {
  // Usar el campo type para mostrar diferentes estilos
  const isReward = message.type === 'reward';
  const bgColor = isReward ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  
  return (
    <div className={`border rounded-lg p-4 ${bgColor}`}>
      <h3 className="text-xl font-bold mb-2">{message.title}</h3>
      <p className="text-gray-700 mb-1">{message.description}</p>
      <p className="text-sm text-gray-500 mb-4">Quest: {message.questTitle}</p>
      <div className="space-y-2">
        {message.adjunts.map((adjunt, index) => (
          <AdjuntItem key={`${adjunt.id}-${index}`} adjunt={adjunt} />
        ))}
      </div>
    </div>
  );
};
```

## Validación y Reglas

### ✅ Estructura clara y lógica

- **questTitle**: Está en el nivel del mensaje, indica QUÉ quest se completó/expiró
- **adjunts**: Solo contiene información de los objetos otorgados/penalizados
- **questAssignedTitle**: Solo aparece en adjunts de tipo quest, indica qué quest se ASIGNÓ como premio

### ✅ Campos según tipo de adjunt

**Para `type="experience"` y `type="coin"`**:
```typescript
{
  id: number,
  objectName: string,
  shortName: string,
  description: string,
  type: 'experience' | 'coin',
  quantity: number
  // No tiene questAssignedTitle ni idQuestAssigned
}
```

**Para `type="quest"`**:
```typescript
{
  id: number,
  objectName: string,
  shortName: string,
  description: string,
  type: 'quest',
  quantity: 1,
  questAssignedTitle: string,    // Título de la quest asignada
  idQuestAssigned: number         // ID de la quest asignada
}
```

### ✅ Cantidad positiva o negativa

- `quantity > 0`: Recompensa (ganancia)
- `quantity < 0`: Penalización (pérdida)
- `quantity = 0`: (raro, pero válido) Sin cambio

### ⚠️ Quest solo en recompensas

Las misiones **solo** se asignan como recompensas (`type='reward'`).
Nunca aparecerán en mensajes de penalización.

## Response de API

### GET /api/messages/load

```json
{
  "messages": [
    {
      "id": 456,
      "title": "Recompensa de misión",
      "description": "La misión \"Maestro del Entrenamiento\" te ha otorgado las siguientes recompensas:",
      "questTitle": "Maestro del Entrenamiento",
      "type": "reward",
      "adjunts": [
        {
          "id": 1,
          "objectName": "Experiencia",
          "shortName": "EXP",
          "type": "experience",
          "description": "Puntos de experiencia del jugador",
          "quantity": 500
        },
        {
          "id": 2,
          "objectName": "Moneda",
          "shortName": "COIN",
          "type": "coin",
          "description": "Monedas del juego",
          "quantity": 1000
        }
      ],
      "dateRead": null,
      "isRead": false,
      "createdAt": "2025-11-14T10:30:00.000Z"
    }
  ]
}
```

### GET /api/users/me

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

**Nota**: El campo `coins` ahora se incluye en el perfil del usuario junto con `totalExp`.

## Migración desde Versión Anterior

Ya no es necesaria ninguna migración, la estructura es más simple y no usa campos null innecesarios.

---

**Última actualización**: 14 de Noviembre de 2025  
**Versión del sistema**: 2.2 - Estructura optimizada (questTitle en mensaje, no en adjunts)
