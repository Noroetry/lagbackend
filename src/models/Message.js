const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        code: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'info',
        },
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    }, {
        tableName: 'messages',
        timestamps: true,
    });

    Message.associate = (models) => {
        Message.hasMany(models.MessageUser, {
            foreignKey: 'id_message',
            as: 'userMessages'
        });
    };

    return Message;
};
