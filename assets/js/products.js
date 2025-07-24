// js/products.js

window.products = {
    html: `
        <div class="card">
            <div class="card-header">
                <div id="products-tab-navigation" class="tab-navigation">
                    <button id="tab-registry" class="tab-btn active">Asset Registry</button>
                    <button id="tab-spare-parts" class="tab-btn">Spare Parts</button>
                    <button id="tab-clients" class="tab-btn">Clients</button>
                </div>
            </div>
            <div id="products-content">
                <!-- Content injected by JS -->
            </div>
        </div>
    `,
    
    registryViewHtml: `<div class="card-controls"><input type="text" id="product-search-input" class="filter-input" placeholder="Search model or serial..."><button id="add-product-btn" class="btn">Add New Product</button></div><div class="table-wrapper"><table id="products-table"></table></div>`,
    sparePartsViewHtml: `<div class="card-controls"><select id="part-status-filter" class="filter-input"><option value="Pending">Pending</option><option value="">All Statuses</option><option value="Ordered">Ordered</option><option value="Received">Received</option><option value="Cancelled">Cancelled</option></select></div><div class="table-wrapper"><table id="spare-parts-table"></table></div>`,
    clientsViewHtml: `<div class="card-controls"><button id="add-client-btn" class="btn">Add New Client</button></div><div class="table-wrapper"><table id="clients-table"></table></div>`,

    init: function() {
        if (app.currentUser.role !== 'Admin') {
            document.querySelector('#app-content').innerHTML = `<div class="card"><p>You do not have permission to view this page.</p></div>`;
            return;
        }
        this.setupAdminView();
    },

    setupAdminView: function() {
        this.showRegistry();
        document.getElementById('tab-registry').addEventListener('click', () => this.showRegistry());
        document.getElementById('tab-spare-parts').addEventListener('click', () => this.showSpareParts());
        document.getElementById('tab-clients').addEventListener('click', () => this.showClients());
    },
    
    setActiveTab: function(tabId) { document.querySelectorAll('#products-tab-navigation .tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(tabId)?.classList.add('active'); },
    showRegistry: function() { this.setActiveTab('tab-registry'); document.getElementById('products-content').innerHTML = this.registryViewHtml; this.loadProducts(); },
    showSpareParts: function() { this.setActiveTab('tab-spare-parts'); document.getElementById('products-content').innerHTML = this.sparePartsViewHtml; this.loadSparePartOrders(); },
    showClients: function() { this.setActiveTab('tab-clients'); document.getElementById('products-content').innerHTML = this.clientsViewHtml; this.loadClients(); },

    loadProducts: async function() {
        const table = document.getElementById('products-table');
        table.innerHTML = `<thead><tr><th>Model</th><th>Serial No.</th><th>Client/Location</th><th>Warranty</th><th>AMC</th><th>Actions</th></tr></thead><tbody><tr><td colspan="6">Loading...</td></tr></tbody>`;
        document.getElementById('add-product-btn').onclick = () => this.showProductModal();
        document.getElementById('product-search-input').oninput = () => this.loadProducts();
        try {
            const searchTerm = document.getElementById('product-search-input').value;
            let query = client.from('products').select(`*, client:clients(name)`).eq('is_active', true);
            if(searchTerm) query = query.or(`model_name.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%`);
            const { data, error } = await query.order('model_name');
            if(error) throw error;
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = data.length === 0 ? `<tr><td colspan="6">No products found.</td></tr>` : data.map(p => `<tr><td>${p.model_name}</td><td>${p.serial_number || ''}</td><td>${p.client?.name || '<em>Not Deployed</em>'}</td><td>${this.getContractStatus(p.warranty_end_date)}</td><td>${this.getContractStatus(p.amc_end_date)}</td><td class="actions"><button class="btn-small history-btn" data-id="${p.id}" data-name="${p.model_name}">History</button><button class="btn-small edit-product-btn" data-id="${p.id}">Edit</button></td></tr>`).join('');
            tbody.querySelectorAll('button').forEach(btn => btn.addEventListener('click', e => {
                const id = e.target.dataset.id;
                if(e.target.classList.contains('edit-product-btn')) this.showProductModal(id);
                if(e.target.classList.contains('history-btn')) this.showHistoryModal(id, e.target.dataset.name);
            }));
        } catch(error) { console.error("Error loading products:", error); app.showToast("Could not load products.", 'error'); }
    },

    showProductModal: async function(productId = null) {
        let product = {};
        const { data: clients } = await client.from('clients').select('id, name').order('name');
        if (productId) {
            const { data, error } = await client.from('products').select('*').eq('id', productId).single();
            if(error) { app.showToast("Could not find product.", 'error'); return; }
            product = data;
        }
        const clientOptions = clients.map(c => `<option value="${c.id}" ${product.client_id === c.id ? 'selected':''}>${c.name}</option>`).join('');
        const formHtml = `<form id="product-form"><div class="form-grid"><div><label>Model Name:</label><input type="text" id="model-name" value="${product.model_name || ''}" required></div><div><label>Serial Number:</label><input type="text" id="serial-number" value="${product.serial_number || ''}"></div><div><label>Client/Location:</label><select id="client-id"><option value="">-- Not Deployed --</option>${clientOptions}</select></div><div><label>Purchase Date:</label><input type="date" id="purchase-date" value="${product.purchase_date || ''}"></div><div><label>Warranty End Date:</label><input type="date" id="warranty-end-date" value="${product.warranty_end_date || ''}"></div><div><label>AMC End Date:</label><input type="date" id="amc-end-date" value="${product.amc_end_date || ''}"></div></div></form>`;
        app.showModal(productId ? 'Edit Product' : 'Add Product', formHtml, { onSave: () => this.handleProductSubmit(productId), saveText: productId ? 'Save Changes' : 'Add Product'});
        if(productId) document.getElementById('client-id').value = product.client_id;
    },

    handleProductSubmit: async function(productId) {
        const formData = { model_name: document.getElementById('model-name').value, serial_number: document.getElementById('serial-number').value || null, client_id: document.getElementById('client-id').value || null, purchase_date: document.getElementById('purchase-date').value || null, warranty_end_date: document.getElementById('warranty-end-date').value || null, amc_end_date: document.getElementById('amc-end-date').value || null };
        if(!formData.model_name) { app.showToast("Model name is required.", 'error'); return; }
        try {
            let error;
            if (productId) ({ error } = await client.from('products').update(formData).eq('id', productId));
            else ({ error } = await client.from('products').insert(formData));
            if(error) throw error;
            app.showToast(`Product ${productId ? 'updated' : 'added'}.`);
            app.hideModal();
            this.loadProducts();
        } catch(error) { console.error("Error saving product:", error); app.showToast(error.message, 'error'); }
    },
    
    showHistoryModal: async function(productId, productName) {
        const modalContent = `<div class="card-controls" style="margin-bottom: 20px;"><button id="add-service-log-btn" class="btn-small">Add Service Log</button><button id="order-spare-part-btn" class="btn-small">Order Spare Part</button></div><h4>Service & Parts History</h4><div id="product-history-list" class="asset-history-container">Loading...</div>`;
        app.showModal(`History for: ${productName}`, modalContent);
        document.getElementById('add-service-log-btn').onclick = () => this.showServiceLogModal(productId, productName);
        document.getElementById('order-spare-part-btn').onclick = () => this.showSparePartModal(productId, productName);
        this.loadHistory(productId);
    },

    loadHistory: async function(productId) {
        const container = document.getElementById('product-history-list');
        try {
            const { data: service, error: serviceErr } = await client.from('service_logs').select(`*, technician:users(full_name)`).eq('product_id', productId);
            if(serviceErr) throw serviceErr;
            const { data: parts, error: partsErr } = await client.from('spare_part_orders').select(`*, requester:users(full_name)`).eq('product_id', productId);
            if(partsErr) throw partsErr;
            const history = [...service.map(s => ({ type: 'Service', date: s.service_date, data: s })), ...parts.map(p => ({ type: 'Part Order', date: p.created_at, data: p }))].sort((a, b) => new Date(b.date) - new Date(a.date));
            container.innerHTML = history.length === 0 ? '<p>No history for this product.</p>' : history.map(item => {
                if (item.type === 'Service') return `<div class="history-item"><span class="history-event status available">Service</span><span class="history-user">by <strong>${item.data.technician?.full_name || 'N/A'}</strong> on ${new Date(item.data.service_date).toLocaleDateString()}</span><div class="history-details">${item.data.service_details}</div></div>`;
                else return `<div class="history-item"><span class="history-event status pending">Part Order</span><span class="history-user">by <strong>${item.data.requester?.full_name || 'N/A'}</strong> on ${new Date(item.data.created_at).toLocaleDateString()}</span><div class="history-details">${item.data.quantity} x ${item.data.part_name} - <strong>Status: ${item.data.status}</strong></div></div>`;
            }).join('');
        } catch(error) { console.error("Error loading history:", error); container.innerHTML = '<p>Could not load history.</p>'; }
    },

    loadSparePartOrders: async function() {
        const table = document.getElementById('spare-parts-table');
        table.innerHTML = `<thead><tr><th>Product</th><th>Part Name</th><th>Qty</th><th>Requested By</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr><td colspan="6">Loading...</td></tr></tbody>`;
        document.getElementById('part-status-filter').onchange = () => this.loadSparePartOrders();
        const status = document.getElementById('part-status-filter').value;
        let query = client.from('spare_part_orders').select(`*, product:products(model_name, serial_number), requester:users(full_name)`);
        if(status) query = query.eq('status', status);
        const { data, error } = await query.order('created_at', { ascending: false });
        if(error) { app.showToast("Could not load parts orders.", 'error'); return; }
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = data.length === 0 ? `<tr><td colspan="6">No spare part orders found.</td></tr>` : data.map(p => `<tr><td>${p.product.model_name} (${p.product.serial_number})</td><td>${p.part_name}</td><td>${p.quantity}</td><td>${p.requester?.full_name || 'N/A'}</td><td><span class="status ${p.status.toLowerCase()}">${p.status}</span></td><td class="actions">${p.status === 'Pending' ? `<button class="btn-small update-part-status-btn" data-id="${p.id}" data-status="Ordered">Mark Ordered</button>` : ''}${p.status === 'Ordered' ? `<button class="btn-small update-part-status-btn" data-id="${p.id}" data-status="Received">Mark Received</button>` : ''}</td></tr>`).join('');
        tbody.querySelectorAll('.update-part-status-btn').forEach(btn => btn.addEventListener('click', e => this.handlePartStatusChange(e.target.dataset.id, e.target.dataset.status)));
    },

    handlePartStatusChange: async function(partId, newStatus) {
        if(!confirm(`Mark this part as ${newStatus}?`)) return;
        const updateData = { status: newStatus };
        if(newStatus === 'Ordered') updateData.order_date = new Date().toISOString();
        if(newStatus === 'Received') updateData.received_date = new Date().toISOString();
        try { await client.from('spare_part_orders').update(updateData).eq('id', partId); app.showToast("Part order status updated."); this.loadSparePartOrders(); } catch(error) { app.showToast("Failed to update status.", 'error'); }
    },

    showServiceLogModal: async function(productId, productName) {
        const formHtml = `<form id="service-log-form"><label>Service Date:</label><input type="date" id="service-date" value="${new Date().toISOString().slice(0,10)}" required><label>Service Details:</label><textarea id="service-details" rows="4" required></textarea><label>Parts Used (optional):</label><input type="text" id="parts-used"></form>`;
        app.showModal(`Add Service Log for ${productName}`, formHtml, { onSave: () => this.handleServiceLogSubmit(productId), saveText: 'Add Log' });
    },

    handleServiceLogSubmit: async function(productId) {
        const formData = { product_id: productId, technician_id: app.currentUser.id, service_date: document.getElementById('service-date').value, service_details: document.getElementById('service-details').value, parts_used: document.getElementById('parts-used').value || null };
        if(!formData.service_date || !formData.service_details) { app.showToast("Date and details are required.", 'error'); return; }
        try { await client.from('service_logs').insert(formData); app.showToast("Service log added."); app.hideModal(); this.loadHistory(productId); } catch(error) { app.showToast("Failed to add log.", 'error'); }
    },

    showSparePartModal: async function(productId, productName) {
        const formHtml = `<form id="spare-part-form"><label>Part Name / Description:</label><input type="text" id="part-name" required><label>Quantity:</label><input type="number" id="quantity" value="1" min="1" required></form>`;
        app.showModal(`Order Spare Part for ${productName}`, formHtml, { onSave: () => this.handleSparePartSubmit(productId), saveText: 'Place Order' });
    },

    handleSparePartSubmit: async function(productId) {
        const formData = { product_id: productId, requested_by_id: app.currentUser.id, part_name: document.getElementById('part-name').value, quantity: document.getElementById('quantity').value };
        if(!formData.part_name || !formData.quantity) { app.showToast("Part name and quantity are required.", 'error'); return; }
        try { await client.from('spare_part_orders').insert(formData); app.showToast("Spare part ordered."); app.hideModal(); this.loadHistory(productId); } catch(error) { app.showToast("Failed to order part.", 'error'); }
    },

    loadClients: async function() {
        const table = document.getElementById('clients-table');
        table.innerHTML = `<thead><tr><th>Name</th><th>Location</th><th>Contact</th><th>Email</th><th>Actions</th></tr></thead><tbody><tr><td colspan="5">Loading...</td></tr></tbody>`;
        document.getElementById('add-client-btn').onclick = () => this.showClientModal();
        try {
            const { data, error } = await client.from('clients').select('*').order('name');
            if(error) throw error;
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = data.length === 0 ? `<tr><td colspan="5">No clients found.</td></tr>` : data.map(c => `<tr><td>${c.name}</td><td>${c.location||''}</td><td>${c.contact_person||''}</td><td>${c.contact_email||''}</td><td class="actions"><button class="btn-small edit-client-btn" data-id="${c.id}">Edit</button></td></tr>`).join('');
            tbody.querySelectorAll('.edit-client-btn').forEach(btn => btn.addEventListener('click', e => this.showClientModal(e.target.dataset.id)));
        } catch(error) { app.showToast("Could not load clients.", 'error'); }
    },

    showClientModal: async function(clientId = null) {
        let client = {};
        if (clientId) {
            const { data, error } = await client.from('clients').select('*').eq('id', clientId).single();
            if(error) { app.showToast("Could not find client.", 'error'); return; }
            client = data;
        }
        const formHtml = `<form id="client-form"><div class="form-grid"><div><label>Name:</label><input type="text" id="client-name" value="${client.name || ''}" required></div><div><label>Location:</label><input type="text" id="client-location" value="${client.location || ''}"></div><div><label>Contact Person:</label><input type="text" id="client-contact-person" value="${client.contact_person || ''}"></div><div><label>Contact Email:</label><input type="email" id="client-contact-email" value="${client.contact_email || ''}"></div></div></form>`;
        app.showModal(clientId ? 'Edit Client' : 'Add New Client', formHtml, { onSave: () => this.handleClientSubmit(clientId), saveText: clientId ? 'Save Changes' : 'Add Client'});
    },

    handleClientSubmit: async function(clientId) {
        const formData = { name: document.getElementById('client-name').value, location: document.getElementById('client-location').value, contact_person: document.getElementById('client-contact-person').value, contact_email: document.getElementById('client-contact-email').value };
        if(!formData.name) { app.showToast("Client name is required.", 'error'); return; }
        try {
            let error;
            if(clientId) ({ error } = await client.from('clients').update(formData).eq('id', clientId));
            else ({ error } = await client.from('clients').insert(formData));
            if(error) throw error;
            app.showToast(`Client ${clientId ? 'updated' : 'added'}.`);
            app.hideModal();
            this.loadClients();
        } catch(error) { app.showToast(error.message, 'error'); }
    },
    
    getContractStatus: function(endDateStr) {
        if (!endDateStr) return '<span class="status inactive">N/A</span>';
        const endDate = new Date(endDateStr);
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        if (endDate < now) return `<span class="status denied">Expired</span>`;
        if (endDate <= thirtyDaysFromNow) return `<span class="status pending">Expires Soon</span>`;
        return `<span class="status approved">Active</span>`;
    }
};