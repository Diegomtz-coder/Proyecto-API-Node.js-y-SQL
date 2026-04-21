// frontend/app.js
const API_URL = 'http://localhost:3000/api/empleados';
 
// ============================================
// 📌 Función para Iniciar Sesión (Login)
// ============================================

function prepararLogin() {
    const usuario = document.getElementById('userIn').value;
    const contrasena = document.getElementById('passIn').value;
    
    // Llamamos a la función que ya tenías escrita
    iniciarSesion(usuario, contrasena);
}

async function iniciarSesion(username, password) {
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Guarda el token en el navegador
            localStorage.setItem('token', data.token);
            console.log('Token guardado con éxito');
            mostrarMensaje('✅ Sesión iniciada correctamente', 'success');
            
            // Después de loguearnos, cargamos los empleados
            cargarEmpleados(); 
        } else {
            mostrarMensaje(`❌ ${data.mensaje}`, 'error');
        }
    } catch (error) {
        console.error('Error en login:', error);
    }
}

function cerrarSesion() {
    // 1. Borramos el token para que el servidor niegue el acceso
    localStorage.removeItem('token');
    

    console.log('Sesión cerrada y token eliminado');
    
    // f5 para que cargue otra vez sin acceso a los datos
    window.location.reload();
}

// ============================================
// 📌 Cargar la lista de empleados al iniciar
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    cargarEmpleados();
});
 
// ============================================
// 📌 Manejar el envío del formulario (INSERT / UPDATE)
// ============================================
document.getElementById('empleadoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const empleado = {
        nombre: document.getElementById('nombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        email: document.getElementById('email').value.trim(),
        puesto: document.getElementById('puesto').value.trim() || null,
        salario: document.getElementById('salario').value || null,
        fecha_contratacion: document.getElementById('fecha_contratacion').value || null
    };

    if (!empleado.nombre || !empleado.apellido || !empleado.email) {
        mostrarMensaje('Por favor completa los campos obligatorios', 'error');
        return;
    }

    // DECISIÓN: Si hay un ID en editandoId, usamos PUT (actualizar), si no, POST (crear)
    const metodo = editandoId ? 'PUT' : 'POST';
    const url = editandoId ? `${API_URL}/${editandoId}` : API_URL;

    try {
        const token = localStorage.getItem('token'); // Recuperar token

        const response = await fetch(url, {
            method: metodo,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // <--- AGREGADO
            },
            body: JSON.stringify(empleado)
        });

        const data = await response.json();

        if (response.ok) {
            mostrarMensaje(editandoId ? '✅ Actualizado correctamente' : '✅ Registrado correctamente', 'success');
            
            // RESETEAR FORMULARIO Y ESTADO
            editandoId = null; 
            document.getElementById('empleadoForm').reset();
            
            // Restaurar botón a su estado original
            const btn = document.querySelector('#empleadoForm button[type="submit"]');
            btn.innerText = "💾 Guardar Empleado";
            btn.className = "btn btn-primary w-100";
            
            cargarEmpleados(); 
        } else {
            mostrarMensaje(`❌ ${data.error || 'Error en la operación'}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('❌ Error de conexión con el servidor', 'error');
    }
});
 
// ============================================
// 📌 Función para mostrar mensajes
// ============================================
function mostrarMensaje(texto, tipo) {
    const mensajeDiv = document.getElementById('mensaje');
    mensajeDiv.textContent = texto;
    mensajeDiv.className = tipo;
   
    // Ocultar después de 5 segundos
    setTimeout(() => {
        mensajeDiv.style.display = 'none';
    }, 5000);
}
 
// ============================================
// 📌 Función para cargar empleados (GET) - MODIFICADA CON JWT
// ============================================
async function cargarEmpleados() {
    try {
        // 1. Recuperar el token que guardamos al hacer login
        const token = localStorage.getItem('token');

        // 2. Modificar el fetch para enviar el token
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`, // enviamos el token al servidor
                'Content-Type': 'application/json'
            }
        });

        // 3. Manejar si el token no es válido o no existe
        if (response.status === 401 || response.status === 403) {
            console.warn("No autorizado. Redirigiendo o mostrando mensaje...");
            document.getElementById('empleados').innerHTML =
                `<tr><td colspan="6" class="text-center text-warning">⚠️Inicia sesión para ver los datos</td></tr>`;
            return;
        }

        const empleados = await response.json();
        const tbody = document.getElementById('empleados');
       
        if (empleados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">No hay empleados registrados</td></tr>`;
            return;
        }

        // Actualizar el número total en el centro si tienes el contador
        const contador = document.getElementById('totalGrafica');
        if(contador) contador.innerText = empleados.length;

        generarGrafica(empleados);
        
        // Construir las filas de la tabla
        tbody.innerHTML = empleados.map(emp => `
            <tr onclick="seleccionarEmpleado(${emp.id})" style="cursor:pointer;">
                <td>${emp.id}</td>
                <td>${emp.nombre} ${emp.apellido}</td>
                <td>${emp.email}</td>
                <td>${emp.puesto || '-'}</td>
                <td>$${emp.salario ? Number(emp.salario).toFixed(2) : '-'}</td>
                <td class="text-center">
                    <button class="btn btn-outline-danger btn-sm border-0" 
                        onclick="event.stopPropagation(); eliminarEmpleado(${emp.id}, '${emp.nombre}')">
                      <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
       
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        document.getElementById('empleados').innerHTML =
            `<tr><td colspan="6" class="text-center text-danger">Error de conexión con el servidor</td></tr>`;
    }
}
 
// ============================================
// 📌 Función para seleccionar un empleado 
// ============================================
let editandoId = null; // null = modo agregar, número = modo editar

// 1. Función para cargar datos en el formulario (Edición)
async function seleccionarEmpleado(id) {
    try {
        const token = localStorage.getItem('token'); // Recuperar token

        const response = await fetch(`${API_URL}/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` } // <--- AGREGADO
        });
        const emp = await response.json();

        // Llenar los datos del formulario 
        document.getElementById('nombre').value = emp.nombre;
        document.getElementById('apellido').value = emp.apellido;
        document.getElementById('email').value = emp.email; 
        document.getElementById('puesto').value = emp.puesto || '';
        document.getElementById('salario').value = emp.salario || '';

        editandoId = id; // Guardamos el ID
        
        // Boton de actualizar datos
        const btn = document.querySelector('#empleadoForm button[type="submit"]');
        btn.innerText = "🚀 Actualizar Datos";
        btn.className = "btn btn-warning w-100";
    } catch (error) { console.error(error); }
}


//  para eliminar un empleado
async function eliminarEmpleado(id, nombre) {
    if (confirm(`¿Estás seguro de que deseas eliminar a ${nombre}?`)) {
        try {
            const token = localStorage.getItem('token'); // Recuperar token

            const response = await fetch(`${API_URL}/${id}`, { 
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` } // <--- AGREGADO
            });

            if (response.ok) {
                mostrarMensaje('🗑️ Empleado eliminado', 'success');
                cargarEmpleados();
            } else {
                alert("Error al intentar eliminar.");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
}

//Crear las graficas
function generarGrafica(empleados) {
    const conteo = {};
    empleados.forEach(emp => {
        const puesto = emp.puesto || 'Otros';
        conteo[puesto] = (conteo[puesto] || 0) + 1;
    });

    const etiquetas = Object.keys(conteo);
    const valores = Object.values(conteo);

    const ctx = document.getElementById('graficaPuestos').getContext('2d');
    
    if (window.miGrafica) { window.miGrafica.destroy(); }

    window.miGrafica = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                // Colores 
                backgroundColor: [
                    'rgba(59, 130, 246, 0.7)', 
                    'rgba(16, 185, 129, 0.7)', 
                    'rgba(238, 255, 0, 0.71)', 
                    'rgba(239, 68, 68, 0.7)',  
                    'rgba(139, 92, 246, 0.7)'  
                ],
                borderColor: '#f5fffe', // borde oscuro que separa las rebanadas
                borderWidth: 4,         // borde grueso
                hoverOffset: 35,        // efecto de expansión al pasar el mouse
                cutout: '78%'           // dona más delgada
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 20
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#e0e0e0',
                        padding: 25,
                        usePointStyle: true, // Círculos en lugar de cuadrados
                        pointStyle: 'circle',
                        font: {
                            size: 17,
                            family: "'Segoe UI', sans-serif",
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#2d2d2d', 
                    titleColor: '#fff',     
                    bodyColor: '#fff',
                    bodyFont: { size: 15 },
                    padding: 15,
                    cornerRadius: 12,
                    displayColors: true,
                    borderColor: '#444',
                    borderWidth: 1
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}