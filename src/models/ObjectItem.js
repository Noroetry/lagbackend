const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ObjectItem = sequelize.define('ObjectItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    objectName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    }
  }, {
    tableName: 'objects'
  });

  ObjectItem.associate = function(models) {
    // Used by quests_objects
    if (models.QuestsObject) {
      ObjectItem.hasMany(models.QuestsObject, { foreignKey: 'idObject' });
    }
  };

  return ObjectItem;
};
