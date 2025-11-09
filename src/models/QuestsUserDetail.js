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
    // store as TEXT so we can hold strings or numbers; validation will be handled in service
    value: {
      type: DataTypes.TEXT,
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
      QuestsUserDetail.belongsTo(models.User, { foreignKey: 'idUser', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
    if (models.QuestsHeader) {
      QuestsUserDetail.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
    if (models.QuestsDetail) {
      QuestsUserDetail.belongsTo(models.QuestsDetail, { foreignKey: 'idDetail', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  };

  return QuestsUserDetail;
};
