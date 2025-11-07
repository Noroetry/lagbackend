const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuestsObject = sequelize.define('QuestsObject', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    idQuest: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    idObject: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      defaultValue: 'R'
    },
    quantity: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'quests_objects'
  });

  QuestsObject.associate = function(models) {
    if (models.QuestsHeader) {
      QuestsObject.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest' });
    }
    if (models.ObjectItem) {
      QuestsObject.belongsTo(models.ObjectItem, { foreignKey: 'idObject' });
    }
  };

  return QuestsObject;
};
