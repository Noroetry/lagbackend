const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuestsHeader = sequelize.define('QuestsHeader', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    },
    period: {
      type: DataTypes.STRING(1),
      allowNull: false,
      defaultValue: 'D'
    },
    periodType: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'FIXED',
      comment: 'Tipo de periodicidad: FIXED (D/W/M), WEEKDAYS (días específicos), PATTERN (patrón cíclico)'
    },
    activeDays: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Días activos separados por coma (0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb). Ej: "1,3,5" para L-M-V'
    },
    periodPattern: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Patrón cíclico donde 1=día activo, 0=descanso. Ej: "1,1,0" = 2 días on, 1 off'
    },
    patternStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de inicio del patrón para calcular días del ciclo'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1440
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    levelRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    baseRewardXP: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0
    },
    basePenaltyXP: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.0
    },
    nextQuest: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    }
  }, {
    tableName: 'quests_headers'
  });

  QuestsHeader.associate = function(models) {
    if (models.QuestsDetail) {
      // Ensure cascade at ORM level as well
      QuestsHeader.hasMany(models.QuestsDetail, { foreignKey: 'idQuest', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
    if (models.QuestsObject) {
      QuestsHeader.hasMany(models.QuestsObject, { foreignKey: 'idQuest', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
    if (models.QuestsUser) {
      QuestsHeader.hasMany(models.QuestsUser, { foreignKey: 'idQuest', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  };

  return QuestsHeader;
};
