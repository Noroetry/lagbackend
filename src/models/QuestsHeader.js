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
