// js/assets.js

window.assets = {
    html: `
        <div class="card">
            <div class="card-header">
                <div id="assets-tab-navigation" class="tab-navigation"></div>
                <button id="add-asset-btn" class="btn hidden">Add New Asset</button>
            </div>
            <div id="assets-content"></div>
        </div>
    `,
    myAssetsViewHtml: `<h3>My Assigned Assets</h3><p class="view-description">Assets currently checked out to you. Request a return when you are ready to give them back.</p><div class="table-wrapper"><table id="my-assets-table"></table></div>`,
    availableAssetsViewHtml: `<h3>Available Assets for Request</h3><p class="view-description">Request any available asset. An admin will review it.</p><div class="table-wrapper"><table id="available-assets-table"></table></div>`,
    adminAllAssetsViewHtml: `<h3>All Company Assets</h3><div id="admin-asset-filters" style="display:flex; flex-wrap: wrap; gap: 15px; margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;"><select id="asset-status-filter" class="filter-input"><option value="">All</option><option value="Available">Available</option><option value="Assigned">Assigned</option></select><input type="text" id="asset-search-input" placeholder="Search..." class="filter-input" style="flex-grow: 1;"></div><div class="table-wrapper"><table id="all-assets-table"></table></div>`,
    adminRequestsViewHtml: `<h3>Pending Acquisition Requests</h3><p class="view-description">Review and process asset requests from employees.</p><div class="table-wrapper"><table id="asset-requests-table"></table></div>`,
    adminReturnsViewHtml: `<h3>Pending Return Requests</h3><p class="view-description">Confirm the physical return of assets requested by employees.</p><div class="table-wrapper"><table id="asset-returns-table"></table></div>`,

    init: function() {
        if (app.currentUser.role === 'Admin') this.setupAdminView();
        else this.setupEmployeeView();
    },

    setupEmployeeView: function() {
        const tabNav = document.getElementById('assets-tab-navigation');
        tabNav.innerHTML = `<button id="tab-my-assets" class="tab-btn active">My Assigned Assets</button><button id="tab-available-assets" class="tab-btn">Request an Asset</button>`;
        this.showMyAssets();
        tabNav.querySelector('#tab-my-assets').addEventListener('click', () => this.showMyAssets());
        tabNav.querySelector('#tab-available-assets').addEventListener('click', () => this.showAvailableAssets());
    },

    setupAdminView: function() {
        const tabNav = document.getElementById('assets-tab-navigation');
        tabNav.innerHTML = `<button id="tab-all-assets" class="tab-btn active">All Assets</button><button id="tab-asset-requests" class="tab-btn">Acquisition Requests</button><button id="tab-asset-returns" class="tab-btn">Return Requests</button>`;
        document.getElementById('add-asset-btn').classList.remove('hidden');
        document.getElementById('add-asset-btn').addEventListener('click', () => this.showAddAssetModal());
        this.showAdminAllAssets();
        tabNav.querySelector('#tab-all-assets').addEventListener('click', () => this.showAdminAllAssets());
        tabNav.querySelector('#tab-asset-requests').addEventListener('click', () => this.showAdminRequests());
        tabNav.querySelector('#tab-asset-returns').addEventListener('click', () => this.showAdminReturns());
    },

    setActiveTab: function(tabId) { document.querySelectorAll('#assets-tab-navigation .tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(tabId)?.classList.add('active'); },
    showMyAssets: function() { this.setActiveTab('tab-my-assets'); document.getElementById('assets-content').innerHTML = this.myAssetsViewHtml; this.loadMyAssets(); },
    showAvailableAssets: function() { this.setActiveTab('tab-available-assets'); document.getElementById('assets-content').innerHTML = this.availableAssetsViewHtml; this.loadAvailableAssets(); },
    showAdminAllAssets: function() { this.setActiveTab('tab-all-assets'); document.getElementById('assets-content').innerHTML = this.adminAllAssetsViewHtml; this.loadAllAssets(); },
    showAdminRequests: function() { this.setActiveTab('tab-asset-requests'); document.getElementById('assets-content').innerHTML = this.adminRequestsViewHtml; this.loadAssetRequests(); },
    showAdminReturns: function() { this.setActiveTab('tab-asset-returns'); document.getElementById('assets-content').innerHTML = this.adminReturnsViewHtml; this.loadReturnRequests(); },

    loadMyAssets: async function() {
        const table = document.getElementById('my-assets-table');
        table.innerHTML = `<thead><tr><th>Asset Name</th><th>Type</th><th>Serial No.</th><th>Checkout Date</th><th>Action</th></tr></thead><tbody><tr><td colspan="5">Loading...</td></tr></tbody>`;
        const { data, error } = await client.from('assets').select('*, asset_returns(status)').eq('assigned_to', app.currentUser.id);
        if (error) { app.showToast('Could not load your assets.', 'error'); return; }
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = data.length === 0 ? '<tr><td colspan="5">No assets are assigned to you.</td></tr>' : data.map(asset => {
            const hasPendingReturn = asset.asset_returns.some(req => req.status === 'Pending');
            return `<tr><td>${asset.asset_name}</td><td>${asset.asset_type || ''}</td><td>${asset.serial_number || ''}</td><td>${new Date(asset.checkout_date).toLocaleDateString()}</td><td>${hasPendingReturn ? '<span class="status pending">Return Pending</span>' : `<button class="btn-small return-asset-btn" data-id="${asset.id}" data-name="${asset.asset_name}">Request Return</button>`}</td></tr>`;
        }).join('');
        document.querySelectorAll('.return-asset-btn').forEach(btn => btn.addEventListener('click', e => this.handleReturnRequest(e.target.dataset.id, e.target.dataset.name)));
    },

    loadAvailableAssets: async function() {
        const table = document.getElementById('available-assets-table');
        table.innerHTML = `<thead><tr><th>Asset Name</th><th>Type</th><th>Serial No.</th><th>Action</th></tr></thead><tbody><tr><td colspan="4">Loading...</td></tr></tbody>`;
        const { data, error } = await client.from('assets').select('*, asset_requests(status)').is('assigned_to', null);
        if (error) { app.showToast('Could not load available assets.', 'error'); return; }
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = data.length === 0 ? '<tr><td colspan="4">No assets are available.</td></tr>' : data.map(asset => {
            const hasPendingRequest = asset.asset_requests.some(req => req.status === 'Pending');
            return `<tr><td>${asset.asset_name}</td><td>${asset.asset_type || ''}</td><td>${asset.serial_number || ''}</td><td>${hasPendingRequest ? '<span class="status pending">Requested</span>' : `<button class="btn-small request-asset-btn" data-id="${asset.id}" data-name="${asset.asset_name}">Request</button>`}</td></tr>`;
        }).join('');
        document.querySelectorAll('.request-asset-btn').forEach(btn => btn.addEventListener('click', e => this.handleRequestAsset(e.target.dataset.id, e.target.dataset.name)));
    },

    loadAllAssets: async function() {
        const table = document.getElementById('all-assets-table');
        table.innerHTML = `<thead><tr><th>Asset Name</th><th>Type</th><th>Serial No.</th><th>Status</th><th>Assigned To</th><th>Actions</th></tr></thead><tbody><tr><td colspan="6">Loading...</td></tr></tbody>`;
        document.getElementById('asset-status-filter').onchange = () => this.loadAllAssets();
        document.getElementById('asset-search-input').oninput = () => this.loadAllAssets();
        let query = client.from('assets').select('*, assigned_user:users(full_name)');
        const status = document.getElementById('asset-status-filter').value;
        const searchTerm = document.getElementById('asset-search-input').value;
        if (status === 'Available') query = query.is('assigned_to', null);
        if (status === 'Assigned') query = query.not('assigned_to', 'is', null);
        if (searchTerm) query = query.or(`asset_name.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%`);
        const { data, error } = await query.order('asset_name');
        if (error) { app.showToast('Could not load assets.', 'error'); return; }
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = data.length === 0 ? '<tr><td colspan="6">No assets found.</td></tr>' : data.map(asset => {
            const isAssigned = !!asset.assigned_to;
            return `<tr><td>${asset.asset_name}</td><td>${asset.asset_type || ''}</td><td>${asset.serial_number || ''}</td><td><span class="status ${isAssigned ? 'assigned' : 'available'}">${isAssigned ? 'Assigned' : 'Available'}</span></td><td>${isAssigned ? (asset.assigned_user ? asset.assigned_user.full_name : 'N/A') : 'N/A'}</td><td class="actions">${isAssigned ? `<button class="btn-small checkin-btn" data-id="${asset.id}">Force Check-in</button>` : `<button class="btn-small checkout-btn" data-id="${asset.id}">Assign</button>`}<button class="btn-small history-btn" data-id="${asset.id}" data-name="${asset.asset_name}">History</button><button class="btn-small delete-asset-btn btn-danger" data-id="${asset.id}">Delete</button></td></tr>`;
        }).join('');
        table.querySelectorAll('.checkout-btn, .checkin-btn, .delete-asset-btn, .history-btn').forEach(btn => btn.addEventListener('click', e => this.handleAdminAssetAction(e)));
    },

    loadAssetRequests: async function() {
        const table = document.getElementById('asset-requests-table');
        table.innerHTML = `<thead><tr><th>Employee</th><th>Asset</th><th>Reason</th><th>Submitted</th><th>Actions</th></tr></thead><tbody><tr><td colspan="5">Loading...</td></tr></tbody>`;
        try {
            const { data, error } = await client.from('asset_requests').select(`*, user:users!asset_requests_user_id_fkey(full_name), asset:assets!asset_requests_asset_id_fkey(asset_name)`).eq('status', 'Pending').order('created_at');
            if (error) throw error;
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = data.length === 0 ? '<tr><td colspan="5">No pending asset requests.</td></tr>' : data.map(req => `<tr><td>${req.user?.full_name || 'N/A'}</td><td>${req.asset?.asset_name || 'N/A'}</td><td>${req.reason}</td><td>${new Date(req.created_at).toLocaleDateString()}</td><td class="actions"><button class="btn-small approve-request-btn" data-req-id="${req.id}" data-asset-id="${req.asset_id}" data-user-id="${req.user_id}">Approve</button><button class="btn-small deny-request-btn btn-danger" data-req-id="${req.id}">Deny</button></td></tr>`).join('');
            table.querySelectorAll('.approve-request-btn, .deny-request-btn').forEach(btn => btn.addEventListener('click', e => this.handleRequestAction(e)));
        } catch (error) { console.error("Error loading asset requests:", error); app.showToast('Could not load requests.', 'error'); }
    },

    loadReturnRequests: async function() {
        const table = document.getElementById('asset-returns-table');
        table.innerHTML = `<thead><tr><th>Employee</th><th>Asset</th><th>Reason</th><th>Submitted</th><th>Action</th></tr></thead><tbody><tr><td colspan="5">Loading...</td></tr></tbody>`;
        try {
            const { data, error } = await client.from('asset_returns').select(`*, user:users!asset_returns_user_id_fkey(full_name), asset:assets!asset_returns_asset_id_fkey(asset_name, serial_number)`).eq('status', 'Pending').order('created_at');
            if (error) throw error;
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = data.length === 0 ? '<tr><td colspan="5">No pending return requests.</td></tr>' : data.map(req => `<tr><td>${req.user?.full_name || 'N/A'}</td><td>${req.asset ? `${req.asset.asset_name} (${req.asset.serial_number || 'N/A'})` : 'N/A'}</td><td>${req.reason}</td><td>${new Date(req.created_at).toLocaleDateString()}</td><td class="actions"><button class="btn-small confirm-return-btn" data-return-id="${req.id}" data-asset-id="${req.asset_id}">Confirm Return</button></td></tr>`).join('');
            table.querySelectorAll('.confirm-return-btn').forEach(btn => btn.addEventListener('click', e => this.handleConfirmReturn(e.target.dataset.returnId, e.target.dataset.assetId)));
        } catch (error) { console.error("Error loading return requests:", error); app.showToast('Could not load return requests.', 'error'); }
    },

    showHistoryModal: function(assetId, assetName) {
        const modalContent = `<div id="asset-history-list" class="asset-history-container"><p>Loading history...</p></div>`;
        app.showModal(`History for: ${assetName}`, modalContent);
        this.loadAssetHistory(assetId);
    },

    loadAssetHistory: async function(assetId) {
        const historyContainer = document.getElementById('asset-history-list');
        try {
            let historyEvents = [];
            const { data: requests, error: reqError } = await client.from('asset_requests').select('processed_at, user:users!asset_requests_user_id_fkey(full_name)').eq('asset_id', assetId).eq('status', 'Approved');
            if (reqError) throw reqError;
            requests.forEach(req => historyEvents.push({ event: 'Checked Out', user: req.user.full_name, date: new Date(req.processed_at) }));

            const { data: returns, error: retError } = await client.from('asset_returns').select('processed_at, user:users!asset_returns_user_id_fkey(full_name)').eq('asset_id', assetId).eq('status', 'Completed');
            if (retError) throw retError;
            returns.forEach(ret => historyEvents.push({ event: 'Returned', user: ret.user.full_name, date: new Date(ret.processed_at) }));

            const { data: directAssignments, error: directError } = await client.from('assets').select('checkout_date, assigned_user:users(full_name)').eq('id', assetId).not('checkout_date', 'is', null).single();
            if (directError && directError.code !== 'PGRST116') throw directError;
            if (directAssignments) {
                 if(!historyEvents.some(e => e.user === directAssignments.assigned_user.full_name && e.event === 'Checked Out')) {
                     historyEvents.push({ event: 'Assigned by Admin', user: directAssignments.assigned_user.full_name, date: new Date(directAssignments.checkout_date) });
                 }
            }
            
            historyEvents.sort((a, b) => b.date - a.date);

            if (historyEvents.length === 0) {
                historyContainer.innerHTML = '<p>No history found for this asset.</p>';
            } else {
                historyContainer.innerHTML = historyEvents.map(item => `<div class="history-item"><span class="history-event status ${item.event.includes('Out') || item.event.includes('Assigned') ? 'assigned' : 'available'}">${item.event}</span><span class="history-user">by <strong>${item.user}</strong></span><span class="history-date">${item.date.toLocaleString()}</span></div>`).join('');
            }
        } catch (error) {
            console.error("Error loading asset history:", error);
            historyContainer.innerHTML = '<p>Could not load asset history.</p>';
        }
    },

    handleAdminAssetAction: function(e) {
        const target = e.target.closest('button');
        const assetId = target.dataset.id;
        if (target.classList.contains('checkout-btn')) this.showCheckoutModal(assetId);
        else if (target.classList.contains('checkin-btn')) this.handleCheckin(assetId, true);
        else if (target.classList.contains('delete-asset-btn')) this.handleDelete(assetId);
        else if (target.classList.contains('history-btn')) this.showHistoryModal(assetId, target.dataset.name);
    },

    handleReturnRequest: function(assetId, assetName) {
        const reason = prompt(`(Optional) Please provide a reason for returning "${assetName}":`);
        if (reason === null) return;
        this.submitReturnRequest(assetId, reason);
    },

    submitReturnRequest: async function(assetId, reason) {
        try { await client.from('asset_returns').insert({ user_id: app.currentUser.id, asset_id: assetId, reason: reason }); app.showToast('Return request submitted!'); this.showMyAssets(); } catch (error) { app.showToast(error.message, 'error'); }
    },

    handleConfirmReturn: async function(returnId, assetId) {
        if (!confirm('Confirm you have physically received this asset? This will make it available.')) return;
        try {
            await client.from('assets').update({ assigned_to: null, checkout_date: null, return_date: new Date().toISOString() }).eq('id', assetId);
            await client.from('asset_returns').update({ status: 'Completed', processed_by: app.currentUser.id, processed_at: new Date().toISOString() }).eq('id', returnId);
            app.showToast('Asset return confirmed.');
            this.loadReturnRequests();
        } catch (error) { app.showToast(error.message, 'error'); }
    },

    handleRequestAsset: function(assetId, assetName) {
        const reason = prompt(`Please provide a reason for requesting "${assetName}":`);
        if (reason === null) return;
        if (!reason.trim()) { app.showToast('A reason is required.', 'error'); return; }
        this.submitAssetRequest(assetId, reason);
    },

    submitAssetRequest: async function(assetId, reason) {
        try { await client.from('asset_requests').insert({ user_id: app.currentUser.id, asset_id: assetId, reason: reason }); app.showToast('Asset request submitted!'); this.showAvailableAssets(); } catch (error) { app.showToast(error.message, 'error'); }
    },

    handleRequestAction: function(e) {
        const reqId = e.target.dataset.reqId;
        if (e.target.classList.contains('approve-request-btn')) this.approveAssetRequest(reqId, e.target.dataset.assetId, e.target.dataset.userId);
        else if (e.target.classList.contains('deny-request-btn')) this.denyAssetRequest(reqId);
    },

    approveAssetRequest: async function(reqId, assetId, userId) {
        if (!confirm('This will assign the asset. Proceed?')) return;
        try {
            await client.from('assets').update({ assigned_to: userId, checkout_date: new Date().toISOString() }).eq('id', assetId);
            await client.from('asset_requests').update({ status: 'Approved', processed_by: app.currentUser.id, processed_at: new Date().toISOString() }).eq('id', reqId);
            app.showToast('Request approved.');
            this.loadAssetRequests();
        } catch (error) { app.showToast(error.message, 'error'); }
    },

    denyAssetRequest: async function(reqId) {
        if (!confirm('Deny this request?')) return;
        try { await client.from('asset_requests').update({ status: 'Denied', processed_by: app.currentUser.id, processed_at: new Date().toISOString() }).eq('id', reqId); app.showToast('Request denied.'); this.loadAssetRequests(); } catch (error) { app.showToast(error.message, 'error'); }
    },

    showAddAssetModal: function() {
        const formHtml = `<form id="new-asset-form"><label for="asset-name">Asset Name:</label><input type="text" id="asset-name" required><label for="asset-type">Type:</label><input type="text" id="asset-type"><label for="serial-number">Serial Number:</label><input type="text" id="serial-number"></form>`;
        app.showModal('Add New Asset', formHtml, { onSave: () => this.handleAddAsset(), saveText: 'Add Asset' });
    },

    handleAddAsset: async function() {
        const asset_name = document.getElementById('asset-name').value;
        const asset_type = document.getElementById('asset-type').value;
        const serial_number = document.getElementById('serial-number').value;
        if (!asset_name) { app.showToast('Asset name is required.', 'error'); return; }
        try { await client.from('assets').insert({ asset_name, asset_type, serial_number }); app.showToast('Asset added!'); app.hideModal(); this.loadAllAssets(); } catch (error) { app.showToast(error.message, 'error'); }
    },

    showCheckoutModal: async function(assetId) {
        const { data: users, error } = await client.from('users').select('id, full_name').eq('is_active', true).order('full_name');
        if (error) { app.showToast('Could not load employees.', 'error'); return; }
        const userOptions = users.map(user => `<option value="${user.id}">${user.full_name}</option>`).join('');
        const formHtml = `<form id="checkout-asset-form"><label for="employee-select">Assign to:</label><select id="employee-select" required><option value="">-- Select --</option>${userOptions}</select></form>`;
        app.showModal('Assign Asset', formHtml, { onSave: () => this.handleCheckout(assetId), saveText: 'Assign' });
    },

    handleCheckout: async function(assetId) {
        const assigned_to = document.getElementById('employee-select').value;
        if (!assigned_to) { app.showToast('Please select an employee.', 'error'); return; }
        try { await client.from('assets').update({ assigned_to, checkout_date: new Date().toISOString() }).eq('id', assetId); app.showToast('Asset assigned.'); app.hideModal(); this.loadAllAssets(); } catch (error) { app.showToast(error.message, 'error'); }
    },

    handleCheckin: async function(assetId, isAdminForce = false) {
        if (isAdminForce && !confirm('Force check-in this asset? This overrides any return requests.')) return;
        try {
            await client.from('assets').update({ assigned_to: null, checkout_date: null, return_date: new Date().toISOString() }).eq('id', assetId);
            await client.from('asset_returns').update({ status: 'Completed', processed_by: app.currentUser.id, processed_at: new Date().toISOString() }).eq('asset_id', assetId).eq('status', 'Pending');
            app.showToast('Asset checked in successfully.');
            if (isAdminForce) this.loadAllAssets(); else this.showAdminReturns();
        } catch (error) { app.showToast(error.message, 'error'); }
    },

    handleDelete: async function(assetId) {
        if (!confirm('Permanently delete this asset? This cannot be undone.')) return;
        try {
            const { error } = await client.from('assets').delete().eq('id', assetId);
            if (error) throw error;
            app.showToast('Asset deleted.');
            this.loadAllAssets();
        } catch (error) {
            if (error.code === '23503') app.showToast('Cannot delete. It is part of an active request.', 'error');
            else app.showToast(error.message, 'error');
        }
    }
};