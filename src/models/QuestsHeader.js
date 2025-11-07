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
      QuestsHeader.hasMany(models.QuestsDetail, { foreignKey: 'idQuest' });
    }
    if (models.QuestsObject) {
      QuestsHeader.hasMany(models.QuestsObject, { foreignKey: 'idQuest' });
    }
    if (models.QuestsUser) {
      QuestsHeader.hasMany(models.QuestsUser, { foreignKey: 'idQuest' });
    }
  };

  return QuestsHeader;
};
