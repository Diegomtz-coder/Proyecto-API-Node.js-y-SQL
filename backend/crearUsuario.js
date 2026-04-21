const bcrypt = require('bcryptjs');
const db = require('./db'); 

async function crearAdmin() {
    const user = 'Diego';
    const pass = '150805'; 
    
    // Encripta la contraseña
    const passwordEncriptada = await bcrypt.hash(pass, 10);

    try {
        await db.query('INSERT INTO usuarios (username, password) VALUES (?, ?)', [user, passwordEncriptada]);
        console.log('✅ Usuario administrador creado con éxito');
        process.exit();
    } catch (error) {
        console.error('❌ Error al crear usuario:', error.message);
        process.exit();
    }
}

crearAdmin();