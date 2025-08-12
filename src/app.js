document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('planoCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const planoImagen = document.getElementById('planoImagen');
    const modalTipoPuesto = document.getElementById('modalTipoPuesto');

    const TIPOS_PUESTO = {
        GERENCIAL: 'GERENCIAL',
        PIZZAS: 'PIZZAS',
        ESTANDAR: 'ESTANDAR'
    };

    const state = {
        empresas: [],
        puestos: [],
        activeEmpresaId: null,
        isPainting: false,
        pendingPuesto: null,
        modoBorrado: false,
        empresaEditando: null
    };

    function crearModalConfirmacion() {
        const modalHTML = `
            <div id="modalConfirmacion" class="modal">
                <div class="modal-content">
                    <span class="close" id="closeConfirmacion">&times;</span>
                    <h3>Confirmación</h3>
                    <p id="mensajeConfirmacion"></p>
                    <div class="modal-buttons">
                        <button id="btnConfirmarOK" class="btn-primary">Sí</button>
                        <button id="btnConfirmarCancel" class="btn-secondary">No</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('closeConfirmacion').addEventListener('click', () => {
            document.getElementById('modalConfirmacion').style.display = 'none';
            if (window._cancelConfirmacion) window._cancelConfirmacion();
        });
        document.getElementById('btnConfirmarCancel').addEventListener('click', () => {
            document.getElementById('modalConfirmacion').style.display = 'none';
            if (window._cancelConfirmacion) window._cancelConfirmacion();
        });
    }

    function mostrarConfirmacion(mensaje, callbackOK, callbackCancel) {
        document.getElementById('mensajeConfirmacion').textContent = mensaje;
        document.getElementById('modalConfirmacion').style.display = 'block';
        window._cancelConfirmacion = callbackCancel;
        const btnOK = document.getElementById('btnConfirmarOK');
        const handler = () => {
            document.getElementById('modalConfirmacion').style.display = 'none';
            btnOK.removeEventListener('click', handler);
            if (callbackOK) callbackOK();
        };
        btnOK.addEventListener('click', handler);
    }

    function mostrarMensaje(mensaje) {
        document.getElementById('mensajeConfirmacion').textContent = mensaje;
        document.getElementById('modalConfirmacion').style.display = 'block';
        const btnOK = document.getElementById('btnConfirmarOK');
        const btnCancel = document.getElementById('btnConfirmarCancel');
        
        // Cambiar el texto del botón a "Cerrar" para mensajes simples
        btnOK.textContent = 'Aceptar';
        
        // Ocultar el botón cancelar para mensajes simples
        btnCancel.style.display = 'none';
        
        const handler = () => {
            document.getElementById('modalConfirmacion').style.display = 'none';
            btnOK.removeEventListener('click', handler);
            btnOK.textContent = 'Sí'; // Restaurar el texto original del botón
            btnCancel.style.display = 'block'; // Restaurar el botón cancelar
        };
        btnOK.addEventListener('click', handler);
    }

    function initializeApp() {
        planoImagen.onload = () => {
            canvas.width = planoImagen.naturalWidth;
            canvas.height = planoImagen.naturalHeight;
            ctx.drawImage(planoImagen, 0, 0);
            cargarDatos();
        };
        if (planoImagen.complete) {
            planoImagen.onload();
        }
        setupEventListeners();
        crearModalEditarEmpresa();
        crearModalConfirmacion();
    }

    function setupEventListeners() {
        canvas.addEventListener('click', handleCanvasClick);
        document.getElementById('empresaForm').addEventListener('submit', agregarEmpresa);
        document.getElementById('limpiarTodo').addEventListener('click', limpiarTodo);
        document.getElementById('exportPDF').addEventListener('click', generarPDF);
        
        document.getElementById('closeTipoPuesto').addEventListener('click', () => modalTipoPuesto.style.display = 'none');
        document.getElementById('btnConfirmarTipo').addEventListener('click', confirmarTipoPuesto);

        // Evento del nuevo botón
        document.getElementById('btnToggleBorrado').addEventListener('click', toggleModoBorrado);
        
        // Eventos para importar/exportar
        document.getElementById('btnImportar').addEventListener('click', () => {
            document.getElementById('importarJson').click();
        });
        document.getElementById('btnExportar').addEventListener('click', exportarJSON);
        document.getElementById('importarJson').addEventListener('change', handleImportarArchivo);
    }

    function crearModalEditarEmpresa() {
        const modalHTML = `
            <div id="modalEditarEmpresa" class="modal">
                <div class="modal-content">
                    <span class="close" id="closeEditarEmpresa">&times;</span>
                    <h3>Editar Empresa</h3>
                    <p>Modifica el nombre y color de la empresa.</p>
                    <div class="form-group">
                        <label for="editNombreEmpresa">Nombre de la Empresa:</label>
                        <input type="text" id="editNombreEmpresa" required>
                    </div>
                    <div class="form-group">
                        <label for="editColorEmpresa">Color para Pintar:</label>
                        <input type="color" id="editColorEmpresa" value="#e31a1c" style="width: 100%; height: 40px;">
                    </div>
                    <div class="modal-buttons">
                        <button id="btnConfirmarEditar" class="btn-primary">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Event listeners para el modal de editar
        document.getElementById('closeEditarEmpresa').addEventListener('click', () => {
            document.getElementById('modalEditarEmpresa').style.display = 'none';
        });
        document.getElementById('btnConfirmarEditar').addEventListener('click', confirmarEditarEmpresa);
    }

    function toggleModoBorrado() {
        state.modoBorrado = !state.modoBorrado;
        const btn = document.getElementById('btnToggleBorrado');
        if (state.modoBorrado) {
            btn.textContent = 'Desactivar Modo Borrado';
            btn.classList.add('btn-danger');
            canvas.style.cursor = 'cell'; // O un cursor de borrador
        } else {
            btn.textContent = 'Activar Modo Borrado';
            btn.classList.remove('btn-danger');
            canvas.style.cursor = 'default';
        }
    }

    function handleCanvasClick(event) {
        if (state.isPainting) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
        const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));

        // Lógica para el MODO BORRADO
        if (state.modoBorrado) {
            const puestoAEliminar = state.puestos.find(p => Math.abs(p.x - x) < 15 && Math.abs(p.y - y) < 15);
            
            if (puestoAEliminar) {
                mostrarConfirmacion(`¿Seguro que quieres eliminar este puesto de tipo ${puestoAEliminar.tipo}?`, () => {
                    state.puestos = state.puestos.filter(p => p.id !== puestoAEliminar.id);
                    floodFill(puestoAEliminar.x, puestoAEliminar.y, [255, 255, 255], () => {
                        actualizarUI();
                        guardarDatos();
                    });
                });
            } else {
                mostrarMensaje("No se encontró ningún puesto en esta ubicación para borrar.");
            }
            return; // Termina la función aquí si está en modo borrado
        }

        // Lógica de PINTADO (sin cambios)
        if (!state.activeEmpresaId) {
            return mostrarMensaje('Por favor, selecciona una empresa de la lista antes de pintar.');
        }

        const activeEmpresa = state.empresas.find(e => e.id === state.activeEmpresaId);
        if (!activeEmpresa) return;

        const fillColor = hexToRgba(activeEmpresa.color);
        const targetColor = getPixelColor(ctx.getImageData(0, 0, canvas.width, canvas.height), x, y);

        if (colorsAreSimilar(targetColor, fillColor, 10)) return; // Si ya está pintado del mismo color, no hacer nada
        
        state.pendingPuesto = { x, y, empresaId: activeEmpresa.id, fillColor };
        modalTipoPuesto.style.display = 'block';
    }

    function confirmarTipoPuesto() {
        if (!state.pendingPuesto) return;

        const tipoSeleccionado = document.getElementById('selectTipoPuesto').value;
        const { x, y, empresaId, fillColor } = state.pendingPuesto;

        const nuevoPuesto = {
            id: Date.now(),
            tipo: tipoSeleccionado,
            x: x,
            y: y,
            empresaId: empresaId,
            ocupado: true
        };
        
        state.puestos.push(nuevoPuesto);
        floodFill(x, y, fillColor, () => {
            actualizarUI();
            guardarDatos();
        });

        modalTipoPuesto.style.display = 'none';
        state.pendingPuesto = null;
    }

    function agregarEmpresa(e) {
        e.preventDefault();
        const nombreInput = document.getElementById('nombreEmpresa');
        const colorInput = document.getElementById('colorEmpresa');
        const nombre = nombreInput.value.trim();
        const color = colorInput.value;

        if (!nombre) return mostrarMensaje('El nombre es obligatorio.');

        if (state.empresas.some(emp => emp.nombre.toLowerCase() === nombre.toLowerCase())) {
            return mostrarMensaje('Ya existe una empresa con ese nombre.');
        }
        if (state.empresas.some(emp => emp.color === color)) {
            return mostrarMensaje('Ese color ya ha sido elegido por otra empresa.');
        }

        const empresa = { id: Date.now().toString(), nombre, color };
        state.empresas.push(empresa);
        actualizarUI();
        guardarDatos();
        nombreInput.value = '';
    }

    function seleccionarEmpresa(id) {
        state.activeEmpresaId = id;
        actualizarListaEmpresas();
    }

    function eliminarEmpresa(id, event) {
        event.stopPropagation();
        mostrarConfirmacion('¿Seguro que quieres eliminar esta empresa? Los puestos y colores asignados se borrarán.', () => {
            const puestosAEliminar = state.puestos.filter(p => p.empresaId === id);
            puestosAEliminar.forEach(puesto => {
                floodFill(puesto.x, puesto.y, [255, 255, 255]);
            });
            state.puestos = state.puestos.filter(p => p.empresaId !== id);
            state.empresas = state.empresas.filter(e => e.id !== id);
            if (state.activeEmpresaId === id) state.activeEmpresaId = null;
            actualizarUI();
            guardarDatos();
        });
    }

    function floodFill(startX, startY, fillColor, callback) {
        state.isPainting = true;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const targetColor = getPixelColor(imageData, startX, startY);
        const tolerance = 30;

        if (colorsAreSimilar(targetColor, fillColor, 10)) {
            state.isPainting = false;
            if (callback) callback();
            return;
        }

        const queue = [[startX, startY]];
        const visited = new Uint8Array(imageData.width * imageData.height);
        visited[startY * canvas.width + startX] = 1;

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            setPixelColor(imageData, x, y, fillColor);
            const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
            for (const [nx, ny] of neighbors) {
                const index1D = ny * canvas.width + nx;
                if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height && !visited[index1D]) {
                    if (colorsAreSimilar(getPixelColor(imageData, nx, ny), targetColor, tolerance)) {
                        visited[index1D] = 1;
                        queue.push([nx, ny]);
                    }
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
        state.isPainting = false;
        if (callback) callback();
    }

    function hexToRgba(hex) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return [r, g, b]; }
    function colorsAreSimilar(c1, c2, tol) { const dr = c1[0] - c2[0], dg = c1[1] - c2[1], db = c1[2] - c2[2]; return (dr * dr + dg * dg + db * db) < (tol * tol); }
    function getPixelColor(d, x, y) { const i = (y * d.width + x) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2]]; }
    function setPixelColor(d, x, y, c) { const i = (y * d.width + x) * 4; d.data[i] = c[0]; d.data[i + 1] = c[1]; d.data[i + 2] = c[2]; d.data[i + 3] = 255; }

    function actualizarUI() {
        actualizarListaEmpresas();
        actualizarTablaResumen();
        actualizarTablaGeneral();
    }

    function actualizarListaEmpresas() {
        const lista = document.getElementById('listaEmpresas');
        lista.innerHTML = '';
        state.empresas.forEach(empresa => {
            const div = document.createElement('div');
            div.className = `empresa-item ${state.activeEmpresaId === empresa.id ? 'active' : ''}`;
            
            // Crear el contenido HTML
            div.innerHTML = `
                <div class="empresa-info">
                    <div class="empresa-color" style="background-color: ${empresa.color}"></div>
                    <span class="empresa-nombre">${empresa.nombre}</span>
                </div>
                <div class="empresa-buttons">
                    <button class="btn-small btn-edit" data-empresa-id="${empresa.id}" title="Editar empresa">✏️</button>
                    <button class="btn-small btn-delete" data-empresa-id="${empresa.id}" title="Eliminar empresa">&times;</button>
                </div>`;
            
            // Agregar event listeners
            const empresaInfo = div.querySelector('.empresa-info');
            empresaInfo.addEventListener('click', () => seleccionarEmpresa(empresa.id));
            
            const btnEdit = div.querySelector('.btn-edit');
            btnEdit.addEventListener('click', (event) => {
                event.stopPropagation();
                editarEmpresa(empresa.id);
            });
            
            const btnDelete = div.querySelector('.btn-delete');
            btnDelete.addEventListener('click', (event) => {
                event.stopPropagation();
                eliminarEmpresa(empresa.id, event);
            });
            
            lista.appendChild(div);
        });
    }

    function actualizarTablaResumen() {
        const tbody = document.querySelector('#tablaEmpresas tbody');
        tbody.innerHTML = '';
        state.empresas.forEach(empresa => {
            const puestosAsignados = state.puestos.filter(p => p.empresaId === empresa.id);
            const gerencial = puestosAsignados.filter(p => p.tipo === TIPOS_PUESTO.GERENCIAL).length;
            const pizzas = puestosAsignados.filter(p => p.tipo === TIPOS_PUESTO.PIZZAS).length;
            const estandar = puestosAsignados.filter(p => p.tipo === TIPOS_PUESTO.ESTANDAR).length;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="background-color: ${empresa.color}20; font-weight: bold;">${empresa.nombre}</td>
                <td>${gerencial}</td>
                <td>${pizzas}</td>
                <td>${estandar}</td>
                <td style="font-weight: bold;">${puestosAsignados.length}</td>`;
        });
    }

    function actualizarTablaGeneral() {
        // Totales fijos
        const totalFijos = { G: 11, P: 114, E: 96 };
        const totalGeneral = 221;

        let ocupados = { G: 0, P: 0, E: 0 };
        state.puestos.forEach(p => {
            if (p.ocupado) {
                if (p.tipo === TIPOS_PUESTO.GERENCIAL) ocupados.G++;
                if (p.tipo === TIPOS_PUESTO.PIZZAS) ocupados.P++;
                if (p.tipo === TIPOS_PUESTO.ESTANDAR) ocupados.E++;
            }
        });

        // Calcular disponibles
        const disponibles = {
            G: totalFijos.G - ocupados.G,
            P: totalFijos.P - ocupados.P,
            E: totalFijos.E - ocupados.E
        };
        const disponiblesTotal = totalGeneral - (ocupados.G + ocupados.P + ocupados.E);

        document.getElementById('ocupadosGerencial').textContent = ocupados.G;
        document.getElementById('ocupadosPizzas').textContent = ocupados.P;
        document.getElementById('ocupadosEstandar').textContent = ocupados.E;
        document.getElementById('ocupadosTotal').textContent = ocupados.G + ocupados.P + ocupados.E;
        document.getElementById('disponiblesGerencial').textContent = disponibles.G;
        document.getElementById('disponiblesPizzas').textContent = disponibles.P;
        document.getElementById('disponiblesEstandar').textContent = disponibles.E;
        document.getElementById('disponiblesTotal').textContent = disponiblesTotal;
        document.getElementById('totalGerencial').textContent = totalFijos.G;
        document.getElementById('totalPizzas').textContent = totalFijos.P;
        document.getElementById('totalEstandar').textContent = totalFijos.E;
        document.getElementById('totalGeneral').textContent = totalGeneral;
    }

    function guardarDatos() {
        const data = { empresas: state.empresas, puestos: state.puestos, canvas: canvas.toDataURL() };
        localStorage.setItem('hubuxState', JSON.stringify(data));
    }

    function cargarDatos() {
        const dataJSON = localStorage.getItem('hubuxState');
        if (!dataJSON) {
            actualizarUI();
            return;
        }
        const data = JSON.parse(dataJSON);
        state.empresas = data.empresas || [];
        state.puestos = data.puestos || [];

        if (data.canvas) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                actualizarUI();
            };
            img.src = data.canvas;
        } else {
            actualizarUI();
        }
    }

    function limpiarTodo() {
        mostrarConfirmacion('¿Seguro que quieres realizar esto? Se borrarán todas las empresas, puestos y colores.', () => {
            localStorage.removeItem('hubuxState');
            state.activeEmpresaId = null;
            state.empresas = [];
            state.puestos = [];
            ctx.drawImage(planoImagen, 0, 0);
            actualizarUI();
        });
    }

    function generarPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
    
        const marcaAguaImg = document.getElementById('marcaAgua');
    
        if (marcaAguaImg.complete) {
            const imgData = getBase64Image(marcaAguaImg);
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    
        doc.setFontSize(30);
        doc.text('Ocupación Hubux', pageWidth / 2, 15, { align: 'center' });
    
        // ✅ Exportar canvas como PNG con fondo transparente (no agregar fondo blanco al canvas)
        const canvasDataURL = canvas.toDataURL('image/png');
    
        // ✅ Ubicar el plano más abajo
        doc.addImage(canvasDataURL, 'PNG', 15, 35, 160, 135);
    
        doc.autoTable({
            html: '#tablaEmpresas',
            startY: 35,
            margin: { left: 180 },
            theme: 'grid',
            styles: { halign: 'center' },
            headStyles: { fillColor: [89, 89, 89] },
            didParseCell: function (data) {
                if (data.column.index === 0 && data.row.index >= 0) {
                    const empresaNombre = data.cell.text.join('').trim();
                    const empresa = state.empresas.find(e =>
                        e.nombre.toLowerCase() === empresaNombre.toLowerCase()
                    );
    
                    if (empresa) {
                        const color = empresa.color;
                        const r = parseInt(color.slice(1, 3), 16);
                        const g = parseInt(color.slice(3, 5), 16);
                        const b = parseInt(color.slice(5, 7), 16);
                        data.cell.styles.fillColor = [r, g, b];
                        data.cell.styles.textColor = [0, 0, 0];
                    }
                }
            }
        });
    
        doc.autoTable({
            html: '.resumen-general-table table',
            startY: doc.lastAutoTable.finalY + 10,
            margin: { left: 180 },
            theme: 'grid',
            styles: { halign: 'center' },
            headStyles: { fillColor: [89, 89, 89] }
        });
    
        doc.save(`Ocupacion Hubux ${new Date().toISOString().slice(0, 10)}.pdf`);
        
        // Exportar JSON automáticamente después del PDF
        exportarJSON();
    }
    
    // Marca de agua sin opacidad
    function getBase64Image(img) {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png");
    }

    // Función para exportar datos como JSON
    function exportarJSON() {
        const data = {
            empresas: state.empresas,
            puestos: state.puestos,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `hubuxState-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('✅ Datos exportados exitosamente');
        console.log('chima ATT: Sebas')
    }

    // Función para manejar la importación de archivos
    function handleImportarArchivo(event) {
        const archivo = event.target.files[0];
        if (archivo) {
            mostrarConfirmacion(
                '¿Seguro que quieres importar estos datos? Se sobrescribirán los datos actuales.',
                () => cargarDesdeArchivoJSON(archivo),
                () => {
                    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
                    event.target.value = '';
                }
            );
        }
    }

    // Función para cargar datos desde archivo JSON
    function cargarDesdeArchivoJSON(archivo) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validar que el archivo tenga la estructura correcta
                if (!data.empresas || !data.puestos) {
                    mostrarMensaje('❌ El archivo no tiene el formato correcto de Hubux');
                    return;
                }
                
                // Cargar los datos
                state.empresas = data.empresas || [];
                state.puestos = data.puestos || [];
                state.activeEmpresaId = null;
                
                // Limpiar el canvas y redibujar
                ctx.drawImage(planoImagen, 0, 0);
                
                // Redibujar todos los puestos
                state.puestos.forEach(puesto => {
                    const empresa = state.empresas.find(e => e.id === puesto.empresaId);
                    if (empresa) {
                        const fillColor = hexToRgba(empresa.color);
                        floodFill(puesto.x, puesto.y, fillColor);
                    }
                });
                
                // Actualizar la interfaz
                actualizarUI();
                guardarDatos();
                
                console.log('✅ Datos importados exitosamente');
                mostrarMensaje(`✅ Datos importados exitosamente\nEmpresas: ${state.empresas.length}\nPuestos: ${state.puestos.length}`);
                
            } catch (error) {
                console.error('❌ Error al importar archivo:', error);
                mostrarMensaje('❌ Error al leer el archivo. Asegúrate de que sea un archivo JSON válido.');
            }
        };
        reader.readAsText(archivo);
        
        // Limpiar el input
        event.target.value = '';
    }
    
    

    function editarEmpresa(id) {
        const empresa = state.empresas.find(e => e.id === id);
        if (!empresa) return;

        state.empresaEditando = empresa;
        document.getElementById('editNombreEmpresa').value = empresa.nombre;
        document.getElementById('editColorEmpresa').value = empresa.color;
        document.getElementById('modalEditarEmpresa').style.display = 'block';
    }

    function confirmarEditarEmpresa() {
        if (!state.empresaEditando) return;

        const nombreInput = document.getElementById('editNombreEmpresa');
        const colorInput = document.getElementById('editColorEmpresa');
        const nombre = nombreInput.value.trim();
        const color = colorInput.value;

        if (!nombre) return mostrarMensaje('El nombre es obligatorio.');

        // Verificar que no exista otra empresa con el mismo nombre (excluyendo la actual)
        if (state.empresas.some(emp => emp.id !== state.empresaEditando.id && emp.nombre.toLowerCase() === nombre.toLowerCase())) {
            return mostrarMensaje('Ya existe una empresa con ese nombre.');
        }
        
        // Verificar que no exista otra empresa con el mismo color (excluyendo la actual)
        if (state.empresas.some(emp => emp.id !== state.empresaEditando.id && emp.color === color)) {
            return mostrarMensaje('Ese color ya ha sido elegido por otra empresa.');
        }

        // Actualizar la empresa
        state.empresaEditando.nombre = nombre;
        state.empresaEditando.color = color;

        // Actualizar los puestos existentes con el nuevo color
        const puestosEmpresa = state.puestos.filter(p => p.empresaId === state.empresaEditando.id);
        puestosEmpresa.forEach(puesto => {
            const fillColor = hexToRgba(color);
            floodFill(puesto.x, puesto.y, fillColor);
        });

        document.getElementById('modalEditarEmpresa').style.display = 'none';
        state.empresaEditando = null;
        actualizarUI();
        guardarDatos();
    }

    initializeApp();
});