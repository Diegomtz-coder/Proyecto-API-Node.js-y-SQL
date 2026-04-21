// backend/server.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

require('dotenv').config(); // 📌 1. Variables de entorno seguras
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // 📌 2. Seguridad HTTP
const { body, validationResult } = require('express-validator'); // 📌 3. Validación y Sanitización
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;


// MIDDLEWARES DE SEGURIDAD
app.use(helmet()); // Protege contra vulnerabilidades web comunes configurando cabeceras HTTP

// CORS Controlado: Solo permite peticiones desde tu origen de confianza
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json()); // Express ya incluye el parseo de JSON
app.use(express.urlencoded({ extended: true }));

// Middleware de validación para reutilizar en POST y PUT
const validarEmpleado = [
    body('nombre').trim().escape().notEmpty().withMessage('El nombre es obligatorio'),
    body('apellido').trim().escape().notEmpty().withMessage('El apellido es obligatorio'),
    body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
    body('salario').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Salario debe ser un número positivo'),
    body('puesto').trim().escape()
];

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('🚀 API de Empleados segura y funcionando');
});

//  exportar datos a excel
const ExcelJS = require('exceljs'); 

app.get('/excel', async (req, res) => {
    try {
        console.log("Creando archivo Excel solicitado...");
        
        // Traer datos de la DB
        const [rows] = await db.query('SELECT * FROM empleados');

        // Configurar el libro
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Empleados');

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nombre', key: 'nombre', width: 20 },
            { header: 'Apellido', key: 'apellido', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Puesto', key: 'puesto', width: 20 },
            { header: 'Salario', key: 'salario', width: 15 }
        ];

        // Insertar datos
        worksheet.addRows(rows);

        // 4. Cabeceras para que el navegador lo descargue
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Empleados.xlsx');

        // Enviar
        await workbook.xlsx.write(res);
        res.end();
        
        console.log("✅ ¡Archivo enviado con éxito!");

    } catch (error) {
        console.error("Error al exportar:", error);
        res.status(500).send("Error interno al generar el archivo");
    }
});

// Ruta de Token
const verificarToken = (req, res, next) => {
    // 1. Buscamos el token en la cabecera 'Authorization'
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // El formato es "Bearer TOKEN"

    if (!token) {
        return res.status(403).json({ error: 'Acceso denegado: No se proporcionó un token' });
    }

    try {
        // 2. Verificamos que el token sea válido con tu clave secreta
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verificado; // Guardamos la info del usuario por si la necesitamos
        next(); // ¡Pasa! El usuario tiene permiso
    } catch (error) {
        res.status(401).json({ error: 'Token no válido o expirado' });
    }
};

// ruta de login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Buscar al usuario
        const [usuarios] = await db.query('SELECT * FROM usuarios WHERE username = ?', [username]);

        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
        }

        const usuario = usuarios[0];

        // 2. Comparar contraseña encriptada
        const passwordCorrecta = await bcrypt.compare(password, usuario.password);

        if (!passwordCorrecta) {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
        }

        // 3. Crear el Token
        const token = jwt.sign(
            { id: usuario.id, username: usuario.username },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({ mensaje: 'Login exitoso', token });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});


// ============================================
// 📌 RUTA PARA INSERTAR (CREATE) - AHORA PROTEGIDA
// ============================================
// Se añade 'verificarToken' para que solo usuarios logueados creen empleados
app.post('/api/empleados', verificarToken, validarEmpleado, async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
        return res.status(400).json({ errores: errores.array() });
    }

    try {
        const { nombre, apellido, email, puesto, salario, fecha_contratacion } = req.body;
        
        const query = `
            INSERT INTO empleados 
            (nombre, apellido, email, puesto, salario, fecha_contratacion) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.query(query, [
            nombre, 
            apellido, 
            email, 
            puesto || null, 
            salario || null, 
            fecha_contratacion || null
        ]);
        
        res.status(201).json({
            message: '✅ Empleado creado exitosamente',
            empleadoId: result.insertId
        });
        
    } catch (error) {
        console.error('Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El email ya está registrado' });
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================
// 📌 RUTA PARA OBTENER TODOS (READ) - AHORA PROTEGIDA
// ============================================
// Aquí es donde el servidor "bloquea" la tabla si no hay token
app.get('/api/empleados', verificarToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM empleados');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los empleados' });
    }
});

// ============================================
// 📌 RUTA PARA OBTENER POR ID (READ)
// ============================================
app.get('/api/empleados/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM empleados WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Empleado no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el empleado' });
    }
});

// ============================================
// 📌 RUTA PARA ACTUALIZAR (UPDATE)
// ============================================
app.put('/api/empleados/:id', verificarToken, validarEmpleado, async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
        return res.status(400).json({ errores: errores.array() });
    }

    try {
        const { id } = req.params;
        const { nombre, apellido, email, puesto, salario } = req.body;

        const query = `UPDATE empleados SET nombre=?, apellido=?, email=?, puesto=?, salario=? WHERE id=?`;
        const [result] = await db.query(query, [nombre, apellido, email, puesto || null, salario || null, id]);

        if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ message: '✏️ Actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// ============================================
// 📌 RUTA PARA ELIMINAR (DELETE)
// ============================================
app.delete('/api/empleados/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM empleados WHERE id = ?', [id]);
        res.json({ message: '🗑️ Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});


// ============================================
// 🚀 INICIAR EL SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`🌐 Servidor seguro corriendo en el puerto ${PORT}`);
});