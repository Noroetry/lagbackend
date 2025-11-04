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
        source: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        destination: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        adjunts: {
            type: DataTypes.TEXT, // store base64 or JSON array
            allowNull: true,
        },
        read: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: 'N',
        },
        dateRead: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },
        dateSent: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        state: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: 'A', // A = active, D = deleted, R = archived (useful values)
        }
    }, {
        tableName: 'messages'
    });

    // Associations can be added if needed later
    Message.associate = function(models) {
        // We keep source/destination as username strings. Optionally associate by username if desired.
    };

    return Message;
};
