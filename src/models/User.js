const bcryptjs = require('bcryptjs');
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        admin: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
    }, {
        tableName: 'users' 
    });
    
    User.beforeCreate(async (user) => {
        const salt = await bcryptjs.genSalt(10); 
        
        user.password = await bcryptjs.hash(user.password, salt);
    });

    User.prototype.comparePassword = async function(candidatePassword) {
        const isMatch = await bcryptjs.compare(candidatePassword, this.password);
        return isMatch;
    };

    return User;
};