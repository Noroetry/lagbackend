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
    },
    id_quest_header: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Para recompensas tipo quest: ID del quest_header a asignar como premio'
    }
  }, {
    tableName: 'quests_objects'
  });

  QuestsObject.associate = function(models) {
    if (models.QuestsHeader) {
      QuestsObject.belongsTo(models.QuestsHeader, { foreignKey: 'idQuest', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
    if (models.ObjectItem) {
      // idObject references objects table; migration already sets onDelete CASCADE there
      QuestsObject.belongsTo(models.ObjectItem, { foreignKey: 'idObject', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  };

  return QuestsObject;
};
