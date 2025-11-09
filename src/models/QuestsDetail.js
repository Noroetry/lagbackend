const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuestsDetail = sequelize.define('QuestsDetail', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    idQuest: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    needParam: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    labelParam: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    descriptionParam: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isEditable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
    ,
    // paramType can be 'string' or 'number' (frontend will use this to decide input type)
    paramType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'number' // text o number por ahora
    }
  }, {
    tableName: 'quests_details'
  });

  QuestsDetail.associate = function(models) {
    if (models.QuestsHeader) {
      QuestsDetail.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  };

  return QuestsDetail;
};
