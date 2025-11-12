const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MessageUser = sequelize.define('MessageUser', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_message: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'messages',
                key: 'id',
            },
        },
        id_user: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        dateRead: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },
        deleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        tableName: 'messages_users',
        timestamps: true,
    });

    MessageUser.associate = (models) => {
        MessageUser.belongsTo(models.Message, {
            foreignKey: 'id_message',
            as: 'message'
        });

        MessageUser.belongsTo(models.User, {
            foreignKey: 'id_user',
            as: 'user'
        });
    };

    return MessageUser;
};
