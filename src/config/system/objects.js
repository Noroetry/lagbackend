/**
 * Objetos del sistema
 * 
 * Estos objetos se crean automáticamente al iniciar la aplicación si no existen.
 * Para añadir nuevos objetos, simplemente agrégalos a este array.
 * 
 * Campos:
 * - objectName: Nombre completo del objeto (único)
 * - shortName: Abreviatura o nombre corto
 * - description: Descripción de qué representa el objeto
 * - type: Tipo del objeto (experience, quest, coin, etc.)
 */

module.exports = [
  {
    objectName: 'Experiencia',
    shortName: 'XP',
    description: 'Puntos de experiencia para subir de nivel',
    type: 'experience'
  },
  {
    objectName: 'Misión',
    shortName: 'Misión',
    description: 'Misiones transferidas como objetos de recompensa/castigo',
    type: 'quest'
  },
  {
    objectName: 'Moneda',
    shortName: 'c',
    description: 'Moneda representativa',
    type: 'coin'
  }
];
