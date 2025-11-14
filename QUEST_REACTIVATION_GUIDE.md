# Guía de Reactivación de Misiones - Flutter/Dart

## Resumen

Este documento explica cómo funcionan las reactivaciones de misiones periódicas en el backend y cómo el frontend en Flutter/Dart debe interpretar la información recibida para implementar contadores y temporizadores.

---

## Estados de las Misiones

Las misiones pueden tener los siguientes estados (campo `state`):

| Estado | Código | Descripción |
|--------|--------|-------------|
| **Nueva** | `N` | Misión asignada pero no activada por el usuario |
| **Pendiente de Parámetros** | `P` | Requiere que el usuario proporcione parámetros antes de activarse |
| **Activa (Live)** | `L` | Misión en curso, puede ser completada |
| **Completada** | `C` | Completada con éxito, recompensas entregadas |
| **Expirada** | `E` | Tiempo agotado sin completar, penalizaciones aplicadas |
| **Finalizada** | `F` | Misión terminada permanentemente (no periódica o inactiva) |

---

## Tipos de Periodicidad

Las misiones pueden tener diferentes tipos de periodicidad configurados en el backend:

### 1. **FIXED** - Períodos Fijos
- **Diaria (D)**: Se reactiva cada día
- **Semanal (W)**: Se reactiva cada semana
- **Mensual (M)**: Se reactiva cada mes
- **Única (U)**: Solo se completa una vez, no se reactiva

### 2. **WEEKDAYS** - Días Específicos de la Semana
- Se reactiva solo en días específicos (ej: lunes, miércoles, viernes)
- Configurado mediante el campo `activeDays` (ej: "1,3,5" para L-M-V)
- Los días se representan como: 0=Domingo, 1=Lunes, 2=Martes... 6=Sábado

### 3. **PATTERN** - Patrón Cíclico Personalizado
- Sigue un patrón de días activos/inactivos (ej: 2 días activo, 1 día descanso)
- Configurado mediante `periodPattern` (ej: "1,1,0" = activo, activo, descanso)
- Requiere `patternStartDate` como fecha de inicio del ciclo

---

## Información Clave para el Frontend

### Campo `dateExpiration`

**El campo más importante para implementar contadores** es `dateExpiration`, que indica cuándo expira la misión actual.

#### Comportamiento del campo:

1. **Para misiones en estado `L` (Activas)**:
   - `dateExpiration` indica cuándo expira la misión si no se completa
   - El frontend debe mostrar un contador descendente hasta esta fecha
   - **Formato**: ISO 8601 timestamp (ej: `"2025-11-15T03:00:00.000Z"`)
   - **Todas las misiones expiran a las 03:00 AM**

2. **Para misiones en estado `C` (Completadas) o `E` (Expiradas)**:
   - `dateExpiration` indica cuándo se reactivará la misión
   - El frontend puede mostrar "Próxima disponibilidad en X tiempo"
   - Una vez que `dateExpiration` se alcanza, la misión pasa a estado `L` automáticamente en el próximo `loadQuests`

3. **Para misiones en estado `F` (Finalizadas)**:
   - Si la misión es periódica pero está inactiva, `dateExpiration` puede indicar una fecha futura
   - Si la misión es única (`period: 'U'`), no se reactivará

### Campos Adicionales en el Header

Aunque `dateExpiration` es suficiente para la mayoría de casos, estos campos proporcionan contexto:

```json
{
  "header": {
    "period": "D",           // Tipo de período (D/W/M/U)
    "duration": 1440,        // ⚠️ DEPRECADO - No usar
    "periodType": "FIXED",   // Tipo de periodicidad (FIXED/WEEKDAYS/PATTERN)
    "activeDays": "1,3,5",   // Solo para WEEKDAYS
    "periodPattern": "1,1,0", // Solo para PATTERN
    "patternStartDate": "2025-11-01T00:00:00.000Z" // Solo para PATTERN
  }
}
```

**⚠️ IMPORTANTE**: El campo `duration` está deprecado y no debe usarse. Todas las misiones expiran a las **03:00 AM** del día correspondiente según su periodicidad.

---

## Implementación de Contadores en Flutter/Dart

### Modelos de Datos

Primero, define las clases para las misiones:

```dart
class Quest {
  final int idQuestUser;
  final String state; // 'N', 'P', 'L', 'C', 'E', 'F'
  final DateTime? dateRead;
  final DateTime? dateExpiration;
  final QuestHeader header;
  final List<QuestDetail> details;

  Quest({
    required this.idQuestUser,
    required this.state,
    this.dateRead,
    this.dateExpiration,
    required this.header,
    required this.details,
  });

  factory Quest.fromJson(Map<String, dynamic> json) {
    return Quest(
      idQuestUser: json['idQuestUser'],
      state: json['state'],
      dateRead: json['dateRead'] != null 
          ? DateTime.parse(json['dateRead']) 
          : null,
      dateExpiration: json['dateExpiration'] != null 
          ? DateTime.parse(json['dateExpiration']) 
          : null,
      header: QuestHeader.fromJson(json['header']),
      details: (json['details'] as List)
          .map((d) => QuestDetail.fromJson(d))
          .toList(),
    );
  }
}

class QuestHeader {
  final int idQuestHeader;
  final String title;
  final String description;
  final String? welcomeMessage;
  final String period; // 'D', 'W', 'M', 'U'
  final String? periodType; // 'FIXED', 'WEEKDAYS', 'PATTERN'
  final String? activeDays;
  final String? periodPattern;
  final DateTime? patternStartDate;

  QuestHeader({
    required this.idQuestHeader,
    required this.title,
    required this.description,
    this.welcomeMessage,
    required this.period,
    this.periodType,
    this.activeDays,
    this.periodPattern,
    this.patternStartDate,
  });

  factory QuestHeader.fromJson(Map<String, dynamic> json) {
    return QuestHeader(
      idQuestHeader: json['idQuestHeader'],
      title: json['title'],
      description: json['description'],
      welcomeMessage: json['welcomeMessage'],
      period: json['period'],
      periodType: json['periodType'],
      activeDays: json['activeDays'],
      periodPattern: json['periodPattern'],
      patternStartDate: json['patternStartDate'] != null
          ? DateTime.parse(json['patternStartDate'])
          : null,
    );
  }
}
```

### Ejemplo 1: Utilidad para Calcular Tiempo Restante

```dart
class QuestTimeUtils {
  /// Calcula el tiempo restante para una misión activa
  static Duration? getRemainingTime(Quest quest) {
    if (quest.state != 'L' || quest.dateExpiration == null) {
      return null;
    }
    
    final now = DateTime.now();
    final expiration = quest.dateExpiration!;
    final difference = expiration.difference(now);
    
    if (difference.isNegative) {
      return Duration.zero;
    }
    
    return difference;
  }

  /// Calcula el tiempo hasta la próxima reactivación
  static Duration? getTimeUntilReactivation(Quest quest) {
    if ((quest.state != 'C' && quest.state != 'E') || 
        quest.dateExpiration == null) {
      return null;
    }
    
    final now = DateTime.now();
    final nextActivation = quest.dateExpiration!;
    final difference = nextActivation.difference(now);
    
    if (difference.isNegative) {
      return Duration.zero;
    }
    
    return difference;
  }

  /// Formatea una duración en texto legible
  static String formatDuration(Duration duration) {
    if (duration.inSeconds <= 0) {
      return "0s";
    }
    
    final days = duration.inDays;
    final hours = duration.inHours % 24;
    final minutes = duration.inMinutes % 60;
    final seconds = duration.inSeconds % 60;
    
    if (days > 0) {
      return "${days}d ${hours}h";
    } else if (hours > 0) {
      return "${hours}h ${minutes}m";
    } else if (minutes > 0) {
      return "${minutes}m ${seconds}s";
    } else {
      return "${seconds}s";
    }
  }

  /// Formatea duración con texto descriptivo según el estado
  static String formatQuestTime(Quest quest) {
    if (quest.dateExpiration == null) {
      return '';
    }
    
    if (quest.state == 'L') {
      final remaining = getRemainingTime(quest);
      if (remaining == null) return '';
      if (remaining.inSeconds <= 0) {
        return '⏰ Expirada';
      }
      return '⏱️ ${formatDuration(remaining)} restantes';
    }
    
    if (quest.state == 'C' || quest.state == 'E') {
      final until = getTimeUntilReactivation(quest);
      if (until == null) return '';
      if (until.inSeconds <= 0) {
        return '🔄 Disponible ahora';
      }
      return '🔄 Disponible en ${formatDuration(until)}';
    }
    
    return '';
  }
}
```

### Ejemplo 2: Widget de Contador en Tiempo Real

```dart
import 'package:flutter/material.dart';
import 'dart:async';

class QuestTimerWidget extends StatefulWidget {
  final Quest quest;
  final TextStyle? textStyle;

  const QuestTimerWidget({
    Key? key,
    required this.quest,
    this.textStyle,
  }) : super(key: key);

  @override
  State<QuestTimerWidget> createState() => _QuestTimerWidgetState();
}

class _QuestTimerWidgetState extends State<QuestTimerWidget> {
  Timer? _timer;
  String _timeDisplay = '';

  @override
  void initState() {
    super.initState();
    _updateTimer();
    // Actualizar cada segundo
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateTimer();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _updateTimer() {
    if (!mounted) return;
    
    setState(() {
      _timeDisplay = QuestTimeUtils.formatQuestTime(widget.quest);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_timeDisplay.isEmpty) {
      return const SizedBox.shrink();
    }

    return Text(
      _timeDisplay,
      style: widget.textStyle ?? 
        TextStyle(
          fontSize: 14,
          color: _getColorForState(),
          fontWeight: FontWeight.w500,
        ),
    );
  }

  Color _getColorForState() {
    final state = widget.quest.state;
    
    if (state == 'L') {
      final remaining = QuestTimeUtils.getRemainingTime(widget.quest);
      if (remaining != null && remaining.inHours < 1) {
        return Colors.red; // Urgente
      }
      return Colors.orange; // En curso
    }
    
    if (state == 'C' || state == 'E') {
      return Colors.blue; // Próxima disponibilidad
    }
    
    return Colors.grey;
  }
}
```

### Ejemplo 3: Widget de Card de Misión Completo

```dart
class QuestCard extends StatelessWidget {
  final Quest quest;
  final VoidCallback? onTap;

  const QuestCard({
    Key? key,
    required this.quest,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _buildStateBadge(),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      quest.header.title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                quest.header.description,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 12),
              QuestTimerWidget(quest: quest),
              const SizedBox(height: 8),
              _buildProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStateBadge() {
    String emoji;
    String text;
    Color color;

    switch (quest.state) {
      case 'N':
        emoji = '🆕';
        text = 'Nueva';
        color = Colors.blue;
        break;
      case 'P':
        emoji = '⚙️';
        text = 'Configurar';
        color = Colors.orange;
        break;
      case 'L':
        emoji = '▶️';
        text = 'En curso';
        color = Colors.green;
        break;
      case 'C':
        emoji = '✅';
        text = 'Completada';
        color = Colors.teal;
        break;
      case 'E':
        emoji = '⏱️';
        text = 'Expirada';
        color = Colors.red;
        break;
      case 'F':
        emoji = '🏁';
        text = 'Finalizada';
        color = Colors.grey;
        break;
      default:
        emoji = '❓';
        text = 'Desconocido';
        color = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressIndicator() {
    final totalDetails = quest.details.length;
    if (totalDetails == 0) return const SizedBox.shrink();

    final checkedDetails = quest.details.where((d) => d.checked).length;
    final progress = checkedDetails / totalDetails;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Progreso',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
            ),
            Text(
              '$checkedDetails/$totalDetails',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.grey[800],
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        LinearProgressIndicator(
          value: progress,
          backgroundColor: Colors.grey[200],
          valueColor: AlwaysStoppedAnimation<Color>(
            progress == 1.0 ? Colors.green : Colors.blue,
          ),
        ),
      ],
    );
  }
}
```

---

## Flujo Completo de Reactivación

### 1. Usuario Completa una Misión Periódica

```
Estado inicial: L (Activa)
↓
Usuario completa todos los detalles
↓
Estado: C (Completada)
↓
Backend entrega recompensas inmediatamente
↓
Backend calcula dateExpiration = próxima fecha de reactivación (03:00 AM)
```

**Ejemplo de respuesta**:
```json
{
  "idQuestUser": 123,
  "state": "C",
  "dateExpiration": "2025-11-15T03:00:00.000Z",
  "header": {
    "title": "Ejercicio diario",
    "period": "D"
  }
}
```

### 2. El Sistema Reactiva la Misión Automáticamente

**Cuándo**: Al llamar a `loadQuests` después de que `dateExpiration` haya pasado

```
Estado: C (Completada, esperando reactivación)
dateExpiration: 2025-11-15T03:00:00.000Z
↓
[Hora actual >= dateExpiration]
↓
Backend resetea la misión:
  - state: L (Activa nuevamente)
  - finished: false
  - rewardDelivered: false
  - dateRead: ahora
  - dateExpiration: próxima expiración (03:00 AM del día válido siguiente)
  - Todos los detalles: isChecked = false
↓
Frontend recibe la misión reactivada en el próximo loadQuests
```

### 3. Casos Especiales: WEEKDAYS y PATTERN

Para misiones con periodicidad personalizada, **el backend ya calcula automáticamente el `dateExpiration` correcto** considerando los días válidos.

#### ⭐ IMPORTANTE: El Frontend NO Necesita Calcular Nada

**El backend se encarga de todo el cálculo de periodicidad**. El frontend simplemente debe:
1. Leer el campo `dateExpiration` del JSON
2. Mostrarlo en el contador
3. **No hacer ningún cálculo adicional de días válidos**

#### Ejemplo Real: Misión Lunes/Miércoles/Viernes

**Caso 1: Usuario completa el lunes a las 10:00 AM**
```json
// Respuesta del backend al completar:
{
  "idQuestUser": 123,
  "state": "C",
  "dateExpiration": "2025-11-19T03:00:00.000Z",  // ← Miércoles 03:00 AM
  "header": {
    "title": "Ejercicio semanal",
    "period": "D",
    "periodType": "WEEKDAYS",
    "activeDays": "1,3,5"  // Lunes(1), Miércoles(3), Viernes(5)
  }
}
```

**Frontend muestra**: "🔄 Disponible en 1d 17h" (hasta el miércoles 03:00 AM)

**Caso 2: Usuario completa el viernes a las 18:00 PM**
```json
// Respuesta del backend:
{
  "idQuestUser": 123,
  "state": "C",
  "dateExpiration": "2025-11-24T03:00:00.000Z",  // ← LUNES 03:00 AM (salta fin de semana)
  "header": {
    "title": "Ejercicio semanal",
    "periodType": "WEEKDAYS",
    "activeDays": "1,3,5"
  }
}
```

**Frontend muestra**: "🔄 Disponible en 2d 9h" (hasta el lunes 03:00 AM)

#### Ejemplo: Misión con Patrón Personalizado (2 días ON, 1 día OFF)

**Configuración**:
- `periodType`: "PATTERN"
- `periodPattern`: "1,1,0" (activo, activo, descanso)
- `patternStartDate`: "2025-11-01T00:00:00.000Z"

**Usuario completa el día 2 del ciclo (día activo)**
```json
{
  "state": "C",
  "dateExpiration": "2025-11-17T03:00:00.000Z",  // ← Próximo día activo del patrón
  "header": {
    "periodType": "PATTERN",
    "periodPattern": "1,1,0"
  }
}
```

**Frontend muestra**: "🔄 Disponible en 1d 5h" (salta el día de descanso)

#### Implementación en Flutter

El frontend **NO necesita conocer** la lógica de `activeDays` o `periodPattern`. Solo debe:

```dart
/// ✅ CORRECTO - Confiar en dateExpiration del backend
String getReactivationTime(Quest quest) {
  if (quest.dateExpiration == null) return '';
  
  final now = DateTime.now();
  final reactivation = quest.dateExpiration!;
  final difference = reactivation.difference(now);
  
  if (difference.isNegative) {
    return 'Disponible ahora';
  }
  
  return 'Disponible en ${formatDuration(difference)}';
}

/// ❌ INCORRECTO - NO intentes calcular días válidos manualmente
String getReactivationTimeWrong(Quest quest) {
  // ❌ NO HAGAS ESTO:
  if (quest.header.periodType == 'WEEKDAYS') {
    final activeDays = quest.header.activeDays?.split(',') ?? [];
    // ❌ NO intentes calcular el próximo día válido
    // ❌ El backend YA lo hizo por ti
  }
  // ...
}
```

#### Por Qué el Backend Calcula Todo

1. **Zona Horaria del Servidor**: El backend usa UTC y las 03:00 AM como punto de corte
2. **Lógica Compleja**: Los patrones cíclicos requieren calcular días desde el inicio
3. **Consistencia**: Todos los clientes ven la misma fecha de reactivación
4. **Días Festivos Futuros**: El backend puede agregar lógica adicional sin cambios en el frontend

#### Validación Simple en Flutter

Si quieres **validar** que el backend está funcionando correctamente:

```dart
class QuestDebugUtils {
  /// Para depuración: verifica si dateExpiration tiene sentido
  static String validateExpiration(Quest quest) {
    if (quest.dateExpiration == null) return 'OK';
    
    final exp = quest.dateExpiration!;
    final now = DateTime.now();
    
    // Verificar que la fecha esté en el futuro
    if (quest.state == 'C' || quest.state == 'E') {
      if (exp.isBefore(now)) {
        return '⚠️ dateExpiration en el pasado - llamar a loadQuests()';
      }
    }
    
    // Verificar que la hora sea 03:00 UTC
    if (exp.toUtc().hour != 3 || exp.toUtc().minute != 0) {
      return '⚠️ Hora no es 03:00 UTC';
    }
    
    return 'OK';
  }
}
```

#### Resumen para WEEKDAYS y PATTERN

| Responsabilidad | Backend | Frontend |
|----------------|---------|----------|
| Calcular próximo día válido | ✅ Sí | ❌ No |
| Considerar `activeDays` | ✅ Sí | ❌ No |
| Calcular patrón cíclico | ✅ Sí | ❌ No |
| Formatear `dateExpiration` | ❌ No | ✅ Sí |
| Mostrar contador visual | ❌ No | ✅ Sí |

**Regla de Oro**: El frontend solo lee `dateExpiration` y lo muestra. El backend hace todos los cálculos.

---

## Recomendaciones para Flutter

### 1. **Servicio de Actualización Periódica**

Crea un servicio que actualice las misiones periódicamente:

```dart
import 'dart:async';
import 'package:flutter/material.dart';

class QuestService extends ChangeNotifier {
  Timer? _refreshTimer;
  List<Quest> _quests = [];
  bool _isLoading = false;

  List<Quest> get quests => _quests;
  bool get isLoading => _isLoading;

  void startAutoRefresh() {
    // Actualizar cada 5 minutos
    _refreshTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => loadQuests(),
    );
  }

  void stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  Future<void> loadQuests() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Llamada a tu API
      final response = await _apiClient.post('/quests/load', {
        'userId': currentUserId,
      });

      _quests = (response['quests'] as List)
          .map((q) => Quest.fromJson(q))
          .toList();
    } catch (e) {
      debugPrint('Error cargando misiones: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    stopAutoRefresh();
    super.dispose();
  }
}
```

### 2. **Uso con Provider**

```dart
// En tu main.dart
void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => QuestService()..startAutoRefresh(),
      child: MyApp(),
    ),
  );
}

// En tu widget
class QuestsScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<QuestService>(
      builder: (context, questService, child) {
        if (questService.isLoading && questService.quests.isEmpty) {
          return Center(child: CircularProgressIndicator());
        }

        return ListView.builder(
          itemCount: questService.quests.length,
          itemBuilder: (context, index) {
            final quest = questService.quests[index];
            return QuestCard(
              quest: quest,
              onTap: () => _handleQuestTap(context, quest),
            );
          },
        );
      },
    );
  }
}
```

### 3. **Notificaciones de Expiración**

```dart
class QuestNotificationService {
  /// Verifica si una misión está próxima a expirar (menos de 1 hora)
  static bool shouldShowExpirationWarning(Quest quest) {
    if (quest.state != 'L' || quest.dateExpiration == null) {
      return false;
    }

    final remaining = QuestTimeUtils.getRemainingTime(quest);
    if (remaining == null) return false;

    return remaining.inMinutes > 0 && remaining.inMinutes <= 60;
  }

  /// Muestra una notificación local cuando una misión está por expirar
  static Future<void> scheduleExpirationNotification(Quest quest) async {
    if (!shouldShowExpirationWarning(quest)) return;

    final remaining = QuestTimeUtils.getRemainingTime(quest)!;
    
    // Usar flutter_local_notifications o similar
    await notificationService.showNotification(
      id: quest.idQuestUser,
      title: '⏰ Misión por expirar',
      body: '${quest.header.title} expira en ${QuestTimeUtils.formatDuration(remaining)}',
      scheduledDate: DateTime.now().add(remaining - Duration(minutes: 15)),
    );
  }
}
```

### 4. **Manejo de Zona Horaria**

```dart
import 'package:intl/intl.dart';

class DateFormatUtils {
  /// Formatea la fecha de expiración en zona horaria local
  static String formatExpirationForUser(DateTime dateExpiration) {
    final localDate = dateExpiration.toLocal();
    final format = DateFormat('EEE, d MMM • HH:mm', 'es_ES');
    return format.format(localDate);
  }

  /// Verifica si una fecha es hoy
  static bool isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year &&
           date.month == now.month &&
           date.day == now.day;
  }

  /// Verifica si una fecha es mañana
  static bool isTomorrow(DateTime date) {
    final tomorrow = DateTime.now().add(Duration(days: 1));
    return date.year == tomorrow.year &&
           date.month == tomorrow.month &&
           date.day == tomorrow.day;
  }

  /// Formato amigable para el usuario
  static String formatFriendly(DateTime date) {
    if (isToday(date)) {
      return 'Hoy a las ${DateFormat('HH:mm').format(date)}';
    }
    if (isTomorrow(date)) {
      return 'Mañana a las ${DateFormat('HH:mm').format(date)}';
    }
    return formatExpirationForUser(date);
  }
}
```

### 5. **Widget de Lista de Misiones con Filtros**

```dart
class QuestsListView extends StatefulWidget {
  final List<Quest> quests;

  const QuestsListView({Key? key, required this.quests}) : super(key: key);

  @override
  State<QuestsListView> createState() => _QuestsListViewState();
}

class _QuestsListViewState extends State<QuestsListView> {
  String _selectedFilter = 'all';

  List<Quest> get filteredQuests {
    switch (_selectedFilter) {
      case 'active':
        return widget.quests.where((q) => q.state == 'L').toList();
      case 'completed':
        return widget.quests.where((q) => q.state == 'C').toList();
      case 'pending':
        return widget.quests.where((q) => q.state == 'N' || q.state == 'P').toList();
      default:
        return widget.quests;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildFilterChips(),
        Expanded(
          child: ListView.builder(
            itemCount: filteredQuests.length,
            itemBuilder: (context, index) {
              return QuestCard(quest: filteredQuests[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          _buildFilterChip('Todas', 'all'),
          _buildFilterChip('Activas', 'active'),
          _buildFilterChip('Completadas', 'completed'),
          _buildFilterChip('Pendientes', 'pending'),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedFilter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (selected) {
          setState(() {
            _selectedFilter = value;
          });
        },
        selectedColor: Theme.of(context).primaryColor.withOpacity(0.2),
      ),
    );
  }
}
```

### 6. **Pull-to-Refresh**

```dart
class QuestsScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final questService = Provider.of<QuestService>(context);

    return RefreshIndicator(
      onRefresh: () => questService.loadQuests(),
      child: QuestsListView(quests: questService.quests),
    );
  }
}
```

### 7. **Manejo de Estado de Carga**

```dart
class LoadingStateBuilder extends StatelessWidget {
  final bool isLoading;
  final bool hasData;
  final Widget child;
  final Widget? loadingWidget;
  final Widget? emptyWidget;

  const LoadingStateBuilder({
    Key? key,
    required this.isLoading,
    required this.hasData,
    required this.child,
    this.loadingWidget,
    this.emptyWidget,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (isLoading && !hasData) {
      return loadingWidget ?? 
        Center(child: CircularProgressIndicator());
    }

    if (!hasData) {
      return emptyWidget ?? 
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.inbox_outlined, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text(
                'No hay misiones disponibles',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        );
    }

    return child;
  }
}
```

### 8. **Mostrar Información de Periodicidad (Opcional)**

Si quieres mostrar al usuario **cómo funciona** la periodicidad de la misión (solo informativo):

```dart
class QuestPeriodicityInfo extends StatelessWidget {
  final Quest quest;

  const QuestPeriodicityInfo({Key? key, required this.quest}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final info = _getPeriodicityDescription();
    if (info.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.blue.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.schedule, size: 16, color: Colors.blue),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              info,
              style: TextStyle(fontSize: 12, color: Colors.blue[800]),
            ),
          ),
        ],
      ),
    );
  }

  String _getPeriodicityDescription() {
    final header = quest.header;
    
    // Misión única
    if (header.period.toUpperCase() == 'U') {
      return 'Misión única - Solo se completa una vez';
    }

    // Periodicidad WEEKDAYS
    if (header.periodType == 'WEEKDAYS' && header.activeDays != null) {
      final days = header.activeDays!.split(',');
      final dayNames = days.map((d) => _getDayName(int.tryParse(d) ?? 0)).join(', ');
      return 'Se reactiva: $dayNames';
    }

    // Periodicidad PATTERN
    if (header.periodType == 'PATTERN' && header.periodPattern != null) {
      final pattern = header.periodPattern!.split(',');
      final activeDays = pattern.where((p) => p == '1').length;
      final totalDays = pattern.length;
      return 'Se reactiva cada $activeDays de $totalDays días';
    }

    // Periodicidad FIXED
    switch (header.period.toUpperCase()) {
      case 'D':
        return 'Se reactiva diariamente';
      case 'W':
        return 'Se reactiva semanalmente';
      case 'M':
        return 'Se reactiva mensualmente';
      default:
        return '';
    }
  }

  String _getDayName(int dayNumber) {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    if (dayNumber >= 0 && dayNumber < days.length) {
      return days[dayNumber];
    }
    return '';
  }
}
```

**Uso del widget informativo**:
```dart
Column(
  children: [
    QuestCard(quest: quest),
    QuestPeriodicityInfo(quest: quest), // ← Muestra info de periodicidad
  ],
)
```

**Ejemplo de salida**:
- "Se reactiva: Lun, Mié, Vie" (para WEEKDAYS con activeDays="1,3,5")
- "Se reactiva cada 2 de 3 días" (para PATTERN con "1,1,0")
- "Se reactiva diariamente" (para period="D")

**⚠️ Importante**: Este widget es **solo informativo para el usuario**. No debe usarse para cálculos. El campo `dateExpiration` sigue siendo la fuente de verdad para los contadores.

---

## Campos Importantes en la Respuesta

### Estructura de una Quest en Dart

```dart
class Quest {
  final int idQuestUser;
  final String state; // 'N' | 'P' | 'L' | 'C' | 'E' | 'F'
  final DateTime? dateRead;       // Cuándo se activó
  final DateTime? dateExpiration; // ⭐ Campo clave para contadores
  final QuestHeader header;
  final List<QuestDetail> details;
  
  Quest({
    required this.idQuestUser,
    required this.state,
    this.dateRead,
    this.dateExpiration,
    required this.header,
    required this.details,
  });
  
  // Helpers útiles
  bool get isActive => state == 'L';
  bool get isCompleted => state == 'C';
  bool get isExpired => state == 'E';
  bool get isPending => state == 'P';
  bool get isNew => state == 'N';
  bool get isFinished => state == 'F';
  
  bool get hasExpiration => dateExpiration != null;
  
  bool get isExpiringSoon {
    if (!isActive || dateExpiration == null) return false;
    final remaining = dateExpiration!.difference(DateTime.now());
    return remaining.inMinutes > 0 && remaining.inMinutes <= 60;
  }
  
  bool get canReactivate {
    if ((state != 'C' && state != 'E') || dateExpiration == null) {
      return false;
    }
    return DateTime.now().isAfter(dateExpiration!);
  }
}

class QuestHeader {
  final int idQuestHeader;
  final String title;
  final String description;
  final String? welcomeMessage;
  final String period;        // 'D' | 'W' | 'M' | 'U' - Tipo de período
  final int? duration;        // ⚠️ DEPRECADO - No usar
  final String? periodType;   // 'FIXED' | 'WEEKDAYS' | 'PATTERN'
  final String? activeDays;   // Para WEEKDAYS (ej: "1,3,5")
  final String? periodPattern; // Para PATTERN (ej: "1,1,0")
  final DateTime? patternStartDate; // Para PATTERN
  
  QuestHeader({
    required this.idQuestHeader,
    required this.title,
    required this.description,
    this.welcomeMessage,
    required this.period,
    this.duration,
    this.periodType,
    this.activeDays,
    this.periodPattern,
    this.patternStartDate,
  });
  
  // Helpers
  bool get isUnique => period.toUpperCase() == 'U';
  bool get isDaily => period.toUpperCase() == 'D';
  bool get isWeekly => period.toUpperCase() == 'W';
  bool get isMonthly => period.toUpperCase() == 'M';
  
  bool get isPeriodic => !isUnique;
}

class QuestDetail {
  final int idQuestUserDetail;
  final int idDetail;
  final String description;
  final bool needParam;
  final String paramType; // 'string' | 'number' | 'boolean'
  final String? labelParam;
  final String? descriptionParam;
  final bool isEditable;
  final String? value;
  final bool checked;
  
  QuestDetail({
    required this.idQuestUserDetail,
    required this.idDetail,
    required this.description,
    required this.needParam,
    required this.paramType,
    this.labelParam,
    this.descriptionParam,
    required this.isEditable,
    this.value,
    required this.checked,
  });
  
  factory QuestDetail.fromJson(Map<String, dynamic> json) {
    return QuestDetail(
      idQuestUserDetail: json['idQuestUserDetail'],
      idDetail: json['idDetail'],
      description: json['description'] ?? '',
      needParam: json['needParam'] ?? false,
      paramType: json['paramType'] ?? 'string',
      labelParam: json['labelParam'],
      descriptionParam: json['descriptionParam'],
      isEditable: json['isEditable'] ?? false,
      value: json['value'],
      checked: json['checked'] ?? false,
    );
  }
}
```

---

## Preguntas Frecuentes

### ¿Por qué todas las misiones expiran a las 03:00 AM?
Para evitar que las misiones cambien en medio del día del usuario y proporcionar una experiencia consistente. Las 03:00 AM es una hora en la que la mayoría de usuarios están durmiendo.

### ¿Qué pasa si el usuario completa una misión a las 02:00 AM?
La misión se marca como completada inmediatamente, pero su próxima reactivación será a las 03:00 AM del día válido siguiente según su periodicidad.

### ¿Puedo confiar solo en `dateExpiration` para todos los casos?
**Sí**. `dateExpiration` es el campo definitivo y más importante. Los demás campos (period, periodType, etc.) son solo informativos.

### ¿Qué hacer si `dateExpiration` es null?
Esto ocurre para misiones que aún no han sido activadas (estado `N` o `P`). En estos casos, no muestres ningún contador.

### ¿Cómo sé si una misión es única o periódica?
Verifica `header.period`:
- `'U'` = Única (no se reactiva)
- `'D'`, `'W'`, `'M'` = Periódica (se reactiva según el período)

### ¿El frontend necesita calcular qué días son válidos para WEEKDAYS o PATTERN?
**No**. El backend ya calculó todo y puso la fecha correcta en `dateExpiration`. El frontend solo debe leerla y mostrarla. Nunca intentes calcular manualmente el próximo día válido.

### Si completo una misión de Lunes/Miércoles/Viernes el lunes, ¿cuándo se reactiva?
El backend automáticamente pone `dateExpiration` al **miércoles a las 03:00 AM** (el siguiente día válido). Tu contador mostrará el tiempo hasta esa fecha. No necesitas hacer nada especial.

### ¿Qué pasa si `dateExpiration` está en el pasado?
Llama a `loadQuests()` inmediatamente. El backend detectará que la fecha pasó y reactivará la misión automáticamente, devolviéndola con estado `L` y una nueva `dateExpiration`.

### ¿Debo mostrar los campos `activeDays` o `periodPattern` al usuario?
Son opcionales y solo informativos. Puedes mostrarlos como "Se reactiva: Lun, Mié, Vie" pero **nunca** para calcular contadores. El widget `QuestPeriodicityInfo` del ejemplo lo hace de forma segura.

---

## Ejemplo Completo de Respuesta del Backend

```json
{
  "questsRewarded": [],
  "quests": [
    {
      "idQuestUser": 42,
      "state": "L",
      "dateRead": "2025-11-14T10:30:00.000Z",
      "dateExpiration": "2025-11-15T03:00:00.000Z",
      "header": {
        "idQuestHeader": 1,
        "title": "Ejercicio diario",
        "description": "Completa 30 minutos de ejercicio",
        "welcomeMessage": "¡Es hora de moverte!",
        "period": "D",
        "periodType": "FIXED"
      },
      "details": [
        {
          "idQuestUserDetail": 100,
          "idDetail": 10,
          "description": "30 minutos de ejercicio",
          "checked": false
        }
      ]
    },
    {
      "idQuestUser": 43,
      "state": "C",
      "dateRead": "2025-11-13T08:00:00.000Z",
      "dateExpiration": "2025-11-15T03:00:00.000Z",
      "header": {
        "idQuestHeader": 2,
        "title": "Leer libro",
        "description": "Lee 20 páginas",
        "period": "D",
        "periodType": "WEEKDAYS",
        "activeDays": "1,3,5"
      },
      "details": [
        {
          "idQuestUserDetail": 101,
          "idDetail": 11,
          "description": "20 páginas",
          "checked": true
        }
      ]
    }
  ]
}
```

---

## Integración Completa - Ejemplo de Servicio API

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class QuestApiService {
  final String baseUrl;
  final String token;

  QuestApiService({required this.baseUrl, required this.token});

  /// Carga todas las misiones del usuario
  Future<QuestsResponse> loadQuests(int userId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/quests/load'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'userId': userId}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return QuestsResponse.fromJson(data);
    } else {
      throw Exception('Error cargando misiones: ${response.statusCode}');
    }
  }

  /// Activa una misión
  Future<Quest> activateQuest(int userId, int questUserId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/quests/activate'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'userId': userId,
        'idQuest': questUserId,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return Quest.fromJson(data);
    } else {
      throw Exception('Error activando misión: ${response.statusCode}');
    }
  }

  /// Marca un detalle como completado
  Future<Quest> checkDetail({
    required int userId,
    required int idQuestUserDetail,
    required bool checked,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/quests/check-detail'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'userId': userId,
        'idQuestUserDetail': idQuestUserDetail,
        'checked': checked,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return Quest.fromJson(data);
    } else {
      throw Exception('Error actualizando detalle: ${response.statusCode}');
    }
  }
}

class QuestsResponse {
  final List<dynamic> questsRewarded;
  final List<Quest> quests;

  QuestsResponse({
    required this.questsRewarded,
    required this.quests,
  });

  factory QuestsResponse.fromJson(Map<String, dynamic> json) {
    return QuestsResponse(
      questsRewarded: json['questsRewarded'] ?? [],
      quests: (json['quests'] as List)
          .map((q) => Quest.fromJson(q))
          .toList(),
    );
  }
}
```

---

## Resumen para Desarrolladores Flutter/Dart

### ✅ Puntos Clave

1. **`dateExpiration` es el campo principal** - Úsalo con `DateTime.parse()` para todos los contadores
2. **Las misiones siempre expiran/reactivan a las 03:00 AM UTC**
3. **El backend calcula TODO** - Nunca calcules manualmente días válidos (WEEKDAYS/PATTERN)
4. **Si una misión es L-M-V y se completa el lunes**, el backend ya puso `dateExpiration` al miércoles 03:00
5. **Usa `Timer.periodic`** para actualizar contadores cada segundo
6. **Implementa `ChangeNotifier` o Bloc** para manejar el estado de las misiones
7. **Estado `L`** = Misión activa, muestra tiempo restante con colores
8. **Estado `C` o `E`** = Misión completada/expirada, muestra tiempo hasta reactivación
9. **Ignora el campo `duration`** - está deprecado
10. **Para misiones únicas (`period == 'U'`)**, no muestres contador de reactivación
11. **Usa `toLocal()`** para convertir fechas UTC a zona horaria local
12. **Implementa pull-to-refresh** para que el usuario pueda actualizar manualmente
13. **Los campos `activeDays` y `periodPattern`** son solo informativos, no los uses para cálculos

### 📦 Paquetes Recomendados

```yaml
dependencies:
  # HTTP requests
  http: ^1.1.0
  
  # State management
  provider: ^6.1.1
  # O alternativamente:
  # flutter_bloc: ^8.1.3
  
  # Formateo de fechas
  intl: ^0.18.1
  
  # Notificaciones locales (opcional)
  flutter_local_notifications: ^16.3.0
  
  # Almacenamiento local (opcional)
  shared_preferences: ^2.2.2
  hive: ^2.2.3
```

### 🎨 Ejemplo de UI Recomendada

```
┌─────────────────────────────────────┐
│ 🆕 Nueva                            │
│ Ejercicio diario                    │
│ Completa 30 minutos de ejercicio    │
│                                     │
│ [Activar Misión]                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ▶️ En curso                          │
│ Ejercicio diario                    │
│ Completa 30 minutos de ejercicio    │
│                                     │
│ ⏱️ 8h 45m 23s restantes             │
│ Progreso           1/1              │
│ ████████████░░░░░░░░ 60%            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ✅ Completada                        │
│ Ejercicio diario                    │
│ Completa 30 minutos de ejercicio    │
│                                     │
│ 🔄 Disponible en 15h 20m            │
│ Progreso          1/1 ✓             │
│ ████████████████████ 100%           │
└─────────────────────────────────────┘
```

---

## Soporte y Contacto

Si tienes dudas sobre la implementación o necesitas casos de uso adicionales, consulta con el equipo de backend o revisa los tests en `tests/periodUtils.test.js`.
