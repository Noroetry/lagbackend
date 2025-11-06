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
        // Experiencia del jugador: valor decimal entre 0.00 y 100.00
        exp: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0.0,
            validate: {
                min: 0.0,
                // max 99.99: when user reaches 100 we'll trigger a level-up in game logic later
                max: 99.99
            }
        },
        // Nivel del jugador (índice a tabla de niveles en el futuro)
        level: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        // Título (índice a tabla de títulos en el futuro)
        title: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        // Job / ocupación (índice a tabla de jobs en el futuro)
        job: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        // Range: cadena que describe el rango o código (puede mapear a otra tabla más adelante)
        range: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Z',
        },
            // Refresh token almacenado (opcional). Se usa para validar refresh tokens y permitir rotación.
            refreshToken: {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null,
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