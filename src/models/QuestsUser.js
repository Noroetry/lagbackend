const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuestsUser = sequelize.define('QuestsUser', {
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
    state: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      defaultValue: 'N'
    },
    finished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    dateCreated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    dateRead: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    dateExpiration: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    dateFinished: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
    ,
    // Indicates whether rewards/penalties for this quest-user have been applied
    rewardDelivered: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'quests_users'
  });

  QuestsUser.associate = function(models) {
    if (models.User) {
      QuestsUser.belongsTo(models.User, { foreignKey: 'idUser', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
    if (models.QuestsHeader) {
      QuestsUser.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
    if (models.QuestsUserDetail) {
      // QuestsUser has many user-detail rows (by idUser) — cascade when user deleted
      QuestsUser.hasMany(models.QuestsUserDetail, { foreignKey: 'idUser', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  };

  return QuestsUser;
};
