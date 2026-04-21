// backend/db.js
const mysql = require('mysql2');
require('dotenv').config(); // solucita los datos a .env
 
// Crear un pool de conexiones para mejor rendimiento
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,           // Cambia por tu usuario de MySQL
    password: process.env.DB_PASS, // Cambia por tu contraseña
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
 
// Exportar el pool con soporte de promesas
module.exports = pool.promise();