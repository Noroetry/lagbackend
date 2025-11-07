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
  }, {
    tableName: 'quests_users'
  });

  QuestsUser.associate = function(models) {
    if (models.User) {
      QuestsUser.belongsTo(models.User, { foreignKey: 'idUser' });
    }
    if (models.QuestsHeader) {
      QuestsUser.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest' });
    }
    if (models.QuestsUserDetail) {
      QuestsUser.hasMany(models.QuestsUserDetail, { foreignKey: 'idUser' });
    }
  };

  return QuestsUser;
};
