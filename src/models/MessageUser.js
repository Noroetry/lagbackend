const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MessageUser = sequelize.define('MessageUser', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_user: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'info',
            comment: 'Tipo de mensaje: info, reward, penalty',
        },
        title: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        adjunts: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            comment: 'Array de objetos con las recompensas: [{id: 1, quantity: 50}, {id: 2, quantity: 100}]',
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
        MessageUser.belongsTo(models.User, {
            foreignKey: 'id_user',
            as: 'user'
        });
    };

    return MessageUser;
};
