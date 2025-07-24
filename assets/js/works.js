// js/works.js

window.works = {
    html: `
        <div class="card">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h2 id="works-title">Service Logs</h2>
                <button id="add-log-btn" class="btn">Add New Service Log</button>
            </div>
            
            <!-- Admin View: Filters & Export Controls -->
            <div id="admin-works-view" class="hidden">
                <div id="audit-filters" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
                    <select id="audit-product-filter" class="filter-input"><option value="">Filter by Product...</option></select>
                    <select id="audit-technician-filter" class="filter-input"><option value="">Filter by Technician...</option></select>
                    <input type="date" id="audit-start-date" class="filter-input" title="Start Date">
                    <input type="date" id="audit-end-date" class="filter-input" title="End Date">
                </div>
                <div class="card-controls">
                    <span>Showing <strong id="log-count">0</strong> service logs.</span>
                    <div>
                        <button id="export-csv-btn" class="btn-secondary" disabled>Export CSV</button>
                        <button id="export-pdf-btn" class="btn-secondary" disabled>Export PDF</button>
                    </div>
                </div>
            </div>
            
            <div class="table-wrapper">
                <table id="work-logs-table"></table>
            </div>
        </div>
    `,

    filteredLogs: [],

    init: function() {
        document.getElementById('add-log-btn').addEventListener('click', () => this.showServiceLogModal());
        if (app.currentUser.role === 'Admin') {
            this.setupAdminView();
        } else {
            this.setupEmployeeView();
        }
    },

    // ===================================================================
    // VIEW SETUP
    // ===================================================================
    setupAdminView: function() {
        document.getElementById('admin-works-view').classList.remove('hidden');
        this.populateFilters();
        document.getElementById('audit-filters').addEventListener('change', () => this.loadAdminLogs());
        document.getElementById('export-csv-btn').addEventListener('click', () => this.exportAsCSV());
        document.getElementById('export-pdf-btn').addEventListener('click', () => this.exportAsPDF());
        this.loadAdminLogs();
    },

    setupEmployeeView: function() {
        document.getElementById('works-title').textContent = 'My Service Logs';
        this.loadEmployeeLogs();
    },

    populateFilters: async function() {
        try {
            const [productsRes, usersRes] = await Promise.all([
                client.from('products').select('id, model_name, serial_number').order('model_name'),
                client.from('users').select('id, full_name').order('full_name')
            ]);
            if (productsRes.error || usersRes.error) throw new Error("Failed to populate filters.");
            const productFilter = document.getElementById('audit-product-filter');
            productsRes.data.forEach(p => productFilter.innerHTML += `<option value="${p.id}">${p.model_name} (${p.serial_number||'N/A'})</option>`);
            const techFilter = document.getElementById('audit-technician-filter');
            usersRes.data.forEach(u => techFilter.innerHTML += `<option value="${u.id}">${u.full_name}</option>`);
        } catch(error) { app.showToast(error.message, 'error'); }
    },
    
    // ===================================================================
    // DATA LOADING (Simplified and Corrected)
    // ===================================================================
    loadEmployeeLogs: async function() {
        const table = document.getElementById('work-logs-table');
        const headers = `<th>Date</th><th>Product</th><th>Details</th><th>Parts Used</th>`;
        table.innerHTML = `<thead><tr>${headers}</tr></thead><tbody><tr><td colspan="4">Loading...</td></tr></tbody>`;
        try {
            const { data, error } = await client.from('service_logs').select('*, product:products(model_name, serial_number)').eq('technician_id', app.currentUser.id).order('service_date', { ascending: false });
            if (error) throw error;
            const tableBody = table.querySelector('tbody');
            tableBody.innerHTML = data.length === 0 ? `<tr><td colspan="4">You have not logged any service work.</td></tr>` : 
                data.map(log => `<tr><td>${new Date(log.service_date).toLocaleDateString()}</td><td>${log.product?.model_name||'N/A'} (${log.product?.serial_number||'N/A'})</td><td>${log.service_details}</td><td>${log.parts_used || 'None'}</td></tr>`).join('');
        } catch (error) { console.error("Error loading employee logs:", error); app.showToast("Could not load your logs.", 'error'); }
    },

    loadAdminLogs: async function() {
        const table = document.getElementById('work-logs-table');
        const headers = `<th>Date</th><th>Technician</th><th>Product</th><th>Details</th><th>Parts Used</th>`;
        table.innerHTML = `<thead><tr>${headers}</tr></thead><tbody><tr><td colspan="5">Loading logs...</td></tr></tbody>`;
        document.getElementById('export-csv-btn').disabled = true;
        document.getElementById('export-pdf-btn').disabled = true;

        try {
            // THE FIX: Simplified query, only fetching from service_logs
            let query = client.from('service_logs').select(`*, product:products(model_name, serial_number), technician:users(full_name)`);

            // Apply filters
            const productId = document.getElementById('audit-product-filter').value;
            const techId = document.getElementById('audit-technician-filter').value;
            const startDate = document.getElementById('audit-start-date').value;
            const endDate = document.getElementById('audit-end-date').value;
            if (productId) query = query.eq('product_id', productId);
            if (techId) query = query.eq('technician_id', techId);
            if (startDate) query = query.gte('service_date', startDate);
            if (endDate) query = query.lte('service_date', endDate);

            const { data, error } = await query.order('service_date', { ascending: false });
            if (error) throw error;
            
            this.filteredLogs = data; // Store data for export
            this.renderAdminLogs();
        } catch(error) {
            console.error("Error loading work logs:", error);
            app.showToast(error.message, 'error');
            table.querySelector('tbody').innerHTML = `<tr><td colspan="5">Error loading logs. Please check RLS policies.</td></tr>`;
        }
    },
    
    renderAdminLogs: function() {
        const tableBody = document.getElementById('work-logs-table').querySelector('tbody');
        document.getElementById('log-count').textContent = this.filteredLogs.length;

        if (this.filteredLogs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5">No service logs found for the selected criteria.</td></tr>`;
            return;
        }

        tableBody.innerHTML = this.filteredLogs.map(log => `
            <tr>
                <td>${new Date(log.service_date).toLocaleDateString()}</td>
                <td>${log.technician?.full_name || 'N/A'}</td>
                <td>${log.product?.model_name || 'N/A'} (${log.product?.serial_number || 'N/A'})</td>
                <td>${log.service_details}</td>
                <td>${log.parts_used || 'None'}</td>
            </tr>
        `).join('');

        document.getElementById('export-csv-btn').disabled = false;
        document.getElementById('export-pdf-btn').disabled = false;
    },

    // ===================================================================
    // MODAL & SUBMISSION (Now role-aware)
    // ===================================================================
    showServiceLogModal: async function() {
        const isAdmin = app.currentUser.role === 'Admin';
        
        // Fetch products for the dropdown
        const { data: products, error: prodError } = await client.from('products').select('id, model_name, serial_number').eq('is_active', true).order('model_name');
        if (prodError) { app.showToast("Could not load products.", 'error'); return; }
        const productOptions = products.map(p => `<option value="${p.id}">${p.model_name} (${p.serial_number || 'N/A'})</option>`).join('');

        // Fetch users for the admin-only technician dropdown
        let techDropdownHtml = '';
        if (isAdmin) {
            const { data: users, error: userError } = await client.from('users').select('id, full_name').eq('is_active', true).order('full_name');
            if (userError) { app.showToast("Could not load users.", 'error'); return; }
            const userOptions = users.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('');
            techDropdownHtml = `<label>Technician:</label><select id="log-technician-id" required><option value="">-- Select a technician --</option>${userOptions}</select>`;
        }
        
        const formHtml = `
            <form id="service-log-form" class="form-grid">
                ${isAdmin ? `<div>${techDropdownHtml}</div>` : ''}
                <div><label>Product Worked On:</label><select id="log-product-id" required><option value="">-- Select a product --</option>${productOptions}</select></div>
                <div><label>Service Date:</label><input type="date" id="service-date" value="${new Date().toISOString().slice(0,10)}" required></div>
                <div class="grid-col-span-2"><label>Service Details / Work Done:</label><textarea id="service-details" rows="4" required></textarea></div>
                <div class="grid-col-span-2"><label>Parts Used (optional, comma-separated):</label><input type="text" id="parts-used"></div>
            </form>`;
        app.showModal(`Add New Service Log`, formHtml, { onSave: () => this.handleServiceLogSubmit(), saveText: 'Add Log' });
    },

    handleServiceLogSubmit: async function() {
        const isAdmin = app.currentUser.role === 'Admin';
        
        const formData = {
            product_id: document.getElementById('log-product-id').value,
            // If admin, get from dropdown; otherwise, use current user's ID
            technician_id: isAdmin ? document.getElementById('log-technician-id').value : app.currentUser.id,
            service_date: document.getElementById('service-date').value,
            service_details: document.getElementById('service-details').value,
            parts_used: document.getElementById('parts-used').value || null
        };
        
        const requiredFields = isAdmin ? [formData.product_id, formData.technician_id, formData.service_date, formData.service_details] : [formData.product_id, formData.service_date, formData.service_details];
        if (requiredFields.some(field => !field)) {
            app.showToast("Please fill all required fields.", 'error');
            return;
        }

        try {
            const { error } = await client.from('service_logs').insert(formData);
            if (error) throw error;
            app.showToast("Service log added successfully.");
            app.hideModal();
            // Refresh the correct view
            if (isAdmin) this.loadAdminLogs();
            else this.loadEmployeeLogs();
        } catch(error) { app.showToast("Failed to add log.", 'error'); }
    },
    
    // ===================================================================
    // EXPORT FUNCTIONS
    // ===================================================================
    exportAsCSV: function() {
        if (this.filteredLogs.length === 0) { app.showToast("No data to export.", 'error'); return; }
        const headers = ["Service Date", "Technician", "Product Model", "Serial Number", "Details", "Parts Used"];
        const rows = this.filteredLogs.map(log => [
            new Date(log.service_date).toLocaleString(),
            log.technician?.full_name || '',
            log.product?.model_name || '',
            log.product?.serial_number || '',
            `"${(log.service_details || '').replace(/"/g, '""')}"`,
            `"${(log.parts_used || '').replace(/"/g, '""')}"`
        ]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `service_logs_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    },

    exportAsPDF: function() {
        if (this.filteredLogs.length === 0) { app.showToast("No data to export.", 'error'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(18); doc.text("Service Log Report", 14, 22);
        doc.setFontSize(11); doc.setTextColor(100); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        const tableColumn = ["Date", "Technician", "Product", "Details", "Parts Used"];
        const tableRows = this.filteredLogs.map(log => [
            new Date(log.service_date).toLocaleString(),
            log.technician?.full_name || '',
            `${log.product?.model_name||''}\n(${log.product?.serial_number||''})`,
            log.service_details,
            log.parts_used || 'None'
        ]);
        doc.autoTable({ head: [tableColumn], body: tableRows, startY: 40, theme: 'grid', headStyles: { fillColor: [74, 144, 226] }, styles: { fontSize: 8, cellPadding: 2 }, didParseCell: function(data) { if (data.section === 'body') { data.cell.styles.valign = 'middle'; } } });
        doc.save(`service_logs_${new Date().toISOString().slice(0,10)}.pdf`);
    }
};