/**
 * Standardized error messages for API responses
 */

const ERROR_MESSAGES = {
  // Authentication errors
  AUTH: {
    UNAUTHORIZED: 'No autorizado',
    TOKEN_MISSING: 'No autorizado, no hay token',
    TOKEN_INVALID: 'No autorizado, token fallido o expirado',
    USER_NOT_FOUND: 'No autorizado, usuario no encontrado',
    INVALID_CREDENTIALS: 'Credenciales inválidas',
    REFRESH_TOKEN_INVALID: 'Refresh token inválido o expirado',
    REFRESH_TOKEN_MISSING: 'refreshToken missing',
    LOGOUT_NO_TOKEN: 'No se proporcionó refreshToken ni usuario autenticado'
  },

  // User errors
  USER: {
    REQUIRED_FIELDS: 'Nombre de usuario, email y contraseña son obligatorios',
    RESERVED_USERNAME: 'El nombre de usuario contiene palabras reservadas y no está permitido',
    DUPLICATE_USER: 'El usuario/email ya está registrado',
    NOT_FOUND: 'Usuario no encontrado',
    PROFILE_FETCH_FAILED: 'Fallo al recuperar el perfil del usuario'
  },

  // Quest errors
  QUEST: {
    USER_ID_REQUIRED: 'userId is required',
    QUEST_ID_REQUIRED: 'userId and idQuest (quests_users id) are required',
    PARAMS_REQUIRED: 'userId (or idUser), idQuest and values (or idDetail+value) are required',
    CHECK_REQUIRED: 'userId, idQuestUserDetail and checked are required',
    NOT_FOUND: 'Quest not found or could not be activated',
    INVALID_STATE: 'Quest must be in state N to activate',
    VALIDATION_FAILED: 'Validation failed'
  },

  // Message errors
  MESSAGE: {
    USER_ID_REQUIRED: 'userId is required',
    MESSAGE_USER_ID_REQUIRED: 'userId and messageUserId are required',
    NOT_FOUND: 'Message not found or does not belong to user'
  },

  // Generic errors
  GENERIC: {
    INTERNAL_ERROR: 'Internal server error',
    INTERNAL_ERROR_ES: 'Fallo interno del servidor',
    ROUTE_NOT_FOUND: 'Ruta no encontrada',
    LOGOUT_FAILED: 'Fallo al cerrar sesión'
  }
};

module.exports = ERROR_MESSAGES;
