const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuestsUserDetail = sequelize.define('QuestsUserDetail', {
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
    idDetail: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    value: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: null
    },
    isChecked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    dateUpdated: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    tableName: 'quests_users_detail'
  });

  QuestsUserDetail.associate = function(models) {
    if (models.User) {
      QuestsUserDetail.belongsTo(models.User, { foreignKey: 'idUser' });
    }
    if (models.QuestsHeader) {
      QuestsUserDetail.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest' });
    }
    if (models.QuestsDetail) {
      QuestsUserDetail.belongsTo(models.QuestsDetail, { foreignKey: 'idDetail' });
    }
  };

  return QuestsUserDetail;
};
