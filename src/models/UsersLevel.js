const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UsersLevel = sequelize.define('UsersLevel', {
    levelNumber: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'level_number'
    },
    minExpRequired: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'users_levels',
    timestamps: true
  });

  UsersLevel.associate = function(models) {
    // no associations currently
  };

  return UsersLevel;
};
