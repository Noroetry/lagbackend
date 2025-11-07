const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuestsUserLog = sequelize.define('QuestsUserLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    idUser: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    idQuest: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // result: 'C' = completed, 'E' = expired
    result: {
      type: DataTypes.CHAR(1),
      allowNull: false,
    },
    // rewards/penalties applied (JSON array of objects)
    rewards: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    // When the quest processing finished
    dateFinished: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    // Optional free-form notes or metadata
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    }
  }, {
    tableName: 'quests_user_logs'
  });

  QuestsUserLog.associate = function(models) {
    if (models.User) {
      QuestsUserLog.belongsTo(models.User, { foreignKey: 'idUser' });
    }
    if (models.QuestsHeader) {
      QuestsUserLog.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest' });
    }
  };

  return QuestsUserLog;
};
