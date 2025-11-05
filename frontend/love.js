document.addEventListener('DOMContentLoaded', function() {
    // Verificamos si el usuario ha iniciado sesión.
    // Aunque la lista es pública, el acceso normal es a través del menú de usuario.
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const tableBody = document.getElementById('love-table-body');
    const loadingSpinner = document.getElementById('loading');

    async function fetchOverdueDebts() {
        loadingSpinner.style.display = 'block';
        tableBody.innerHTML = '';

        try {
            // Llamamos al endpoint público, no se necesita token de autorización.
            const response = await fetch('/api/love-list');

            if (!response.ok) {
                throw new Error('Error al obtener los datos del servidor.');
            }

            const data = await response.json();
            
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">No hay obligaciones vencidas en este momento. ¡Felicidades a la comunidad!</td></tr>';
            } else {
                populateTable(data);
            }

        } catch (error) {
            console.error('Error:', error);
            tableBody.innerHTML = '<tr><td colspan="4">No se pudo cargar la información. Inténtelo de nuevo más tarde.</td></tr>';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function populateTable(debts) {
        debts.forEach(debt => {
            const row = document.createElement('tr');

            const overdueDate = new Date(debt.overdue_since).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            row.innerHTML = `
                <td>${debt.username}</td>
                <td>${parseFloat(debt.total_overdue_amount).toFixed(4)}</td>
                <td>${overdueDate}</td>
                <td>${debt.recurrence_count}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    fetchOverdueDebts();
});
