// js/requests.js

window.requests = {
    html: `
        <div class="card">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h2 id="requests-title">My Requests</h2>
                <button id="add-request-btn" class="btn">Make a New Request</button>
            </div>

            <!-- Admin Filter Controls - Hidden by default -->
            <div id="admin-request-filters" class="hidden" style="display:flex; flex-wrap: wrap; gap: 15px; margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
                <select id="request-user-filter" class="filter-input"><option value="">All Employees</option></select>
                <select id="request-type-filter" class="filter-input">
                    <option value="">All Types</option>
                    <option value="Money">Money</option>
                    <option value="Leave">Leave</option>
                    <option value="Off-Day">Off-Day</option>
                </select>
                <select id="request-status-filter" class="filter-input">
                    <option value="Pending">Pending</option>
                    <option value="">All Statuses</option>
                    <option value="Approved">Approved</option>
                    <option value="Denied">Denied</option>
                </select>
                <button id="clear-request-filters-btn" class="btn-secondary">Clear</button>
            </div>

            <table id="requests-table">
                <thead>
                    <tr id="requests-table-header">
                        <!-- Header content is built dynamically -->
                    </tr>
                </thead>
                <tbody id="requests-table-body">
                    <!-- Request rows will be inserted here -->
                </tbody>
            </table>
        </div>
    `,

    init: function() {
        if (app.currentUser.role === 'Admin') {
            this.setupAdminView();
        } else {
            this.setupEmployeeView();
        }
        this.loadRequests();
    },

    setupEmployeeView: function() {
        document.getElementById('requests-table-header').innerHTML = `
            <th>Submitted</th>
            <th>Type</th>
            <th>Details</th>
            <th>Status</th>
            <th>Admin Comment</th>
        `;
        document.getElementById('add-request-btn').addEventListener('click', () => this.showRequestModal());
    },

    setupAdminView: function() {
        document.getElementById('requests-title').textContent = 'Manage All Requests';
        document.getElementById('add-request-btn').style.display = 'none';
        document.getElementById('admin-request-filters').classList.remove('hidden');

        document.getElementById('requests-table-header').innerHTML = `
            <th>Employee</th>
            <th>Submitted</th>
            <th>Type</th>
            <th>Details</th>
            <th>Status</th>
            <th>Actions</th>
        `;

        this.populateUserFilter();

        // Add event listeners for filter controls
        document.getElementById('request-user-filter').addEventListener('change', () => this.loadRequests());
        document.getElementById('request-type-filter').addEventListener('change', () => this.loadRequests());
        document.getElementById('request-status-filter').addEventListener('change', () => this.loadRequests());
        document.getElementById('clear-request-filters-btn').addEventListener('click', () => this.clearFilters());

        // Use event delegation for dynamic action buttons
        document.getElementById('requests-table-body').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const requestId = target.dataset.id;
            if (target.classList.contains('approve-btn')) {
                this.handleAdminAction(requestId, 'Approved');
            } else if (target.classList.contains('deny-btn')) {
                this.handleAdminAction(requestId, 'Denied');
            }
        });
    },

    populateUserFilter: async function() {
        try {
            const { data: users, error } = await client.from('users').select('id, full_name').order('full_name');
            if (error) throw error;
            const userFilter = document.getElementById('request-user-filter');
            users.forEach(user => {
                userFilter.innerHTML += `<option value="${user.id}">${user.full_name}</option>`;
            });
        } catch (error) {
            app.showToast('Could not load user list for filtering.', 'error');
        }
    },

    loadRequests: async function() {
        const tableBody = document.getElementById('requests-table-body');
        tableBody.innerHTML = `<tr><td colspan="6">Loading requests...</td></tr>`;

        try {
            // THE FIX IS ON THIS LINE: We specify the exact foreign key relationship to use.
            let query = client.from('requests').select('*, users:users!requests_user_id_fkey(full_name)');

            if (app.currentUser.role === 'Admin') {
                const userId = document.getElementById('request-user-filter').value;
                const type = document.getElementById('request-type-filter').value;
                const status = document.getElementById('request-status-filter').value;

                if (userId) query = query.eq('user_id', userId);
                if (type) query = query.eq('request_type', type);
                if (status) query = query.eq('status', status);
            } else {
                query = query.eq('user_id', app.currentUser.id);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            tableBody.innerHTML = '';
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6">No requests found.</td></tr>';
                return;
            }

            data.forEach(req => {
                const row = document.createElement('tr');
                // The joined data is now in req.users
                const employeeName = req.users ? req.users.full_name : 'Unknown';
                const statusClass = req.status.toLowerCase();

                let rowContent = `
                    ${app.currentUser.role === 'Admin' ? `<td>${employeeName}</td>` : ''}
                    <td>${new Date(req.created_at).toLocaleDateString()}</td>
                    <td>${req.request_type}</td>
                    <td>${this.formatRequestDetails(req)}</td>
                    <td><span class="status ${statusClass}">${req.status}</span></td>
                    ${app.currentUser.role === 'Admin' ? 
                        `<td class="actions">
                            ${req.status === 'Pending' ? 
                                `<button class="btn-small approve-btn" data-id="${req.id}">Approve</button>
                                <button class="btn-small deny-btn btn-danger" data-id="${req.id}">Deny</button>` 
                                : `Processed`
                            }
                        </td>`
                        : `<td>${req.admin_comment || 'N/A'}</td>`
                    }
                `;
                row.innerHTML = rowContent;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading requests:', error);
            app.showToast('Failed to load requests.', 'error');
        }
    },
    
    // Helper to display JSONB details nicely
    formatRequestDetails: function(request) {
        if (!request.details) return 'No details.';
        switch(request.request_type) {
            case 'Money':
                return `Amount: $${request.details.amount || 0}, Reason: ${request.details.reason || 'N/A'}`;
            case 'Leave':
                return `Type: ${request.details.leave_type || 'N/A'}<br>
                        From: ${request.details.start_date || 'N/A'} To: ${request.details.end_date || 'N/A'}`;
            case 'Off-Day':
                return `Date: ${request.details.off_day_date || 'N/A'}`;
            default:
                return JSON.stringify(request.details);
        }
    },

    clearFilters: function() {
        document.getElementById('request-user-filter').value = '';
        document.getElementById('request-type-filter').value = '';
        document.getElementById('request-status-filter').value = 'Pending';
        this.loadRequests();
    },

    showRequestModal: function() {
        const formHtml = `
            <form id="new-request-form">
                <label for="request-type-selector">What do you want to request?</label>
                <select id="request-type-selector" required>
                    <option value="" selected>-- Please select a type --</option>
                    <option value="Money">Money</option>
                    <option value="Leave">Leave</option>
                    <option value="Off-Day">Off-Day</option>
                </select>
                <div id="request-form-fields">
                    <!-- Dynamic form fields will be injected here -->
                </div>
            </form>
        `;
        
        // THE FIX: We now use the new options object format.
        app.showModal('Make a New Request', formHtml, {
            onSave: () => this.handleRequestSubmit(),
            saveText: 'Submit Request' // You can customize the button text here
        });
        
        // Add event listener to dynamically change the form (this part is unchanged)
        document.getElementById('request-type-selector').addEventListener('change', (e) => {
            const type = e.target.value;
            const fieldsContainer = document.getElementById('request-form-fields');
            let fieldsHtml = '';
            if (type === 'Money') {
                fieldsHtml = `
                    <label for="req-amount">Amount ($):</label>
                    <input type="number" id="req-amount" required min="0" step="0.01">
                    <label for="req-reason">Reason:</label>
                    <textarea id="req-reason" rows="3" required></textarea>
                `;
            } else if (type === 'Leave') {
                fieldsHtml = `
                    <label for="req-leave-type">Leave Type:</label>
                    <select id="req-leave-type"><option>Vacation</option><option>Sick</option><option>Personal</option></select>
                    <label for="req-start-date">Start Date:</label>
                    <input type="date" id="req-start-date" required>
                    <label for="req-end-date">End Date:</label>
                    <input type="date" id="req-end-date" required>
                `;
            } else if (type === 'Off-Day') {
                fieldsHtml = `
                    <label for="req-off-day">Date:</label>
                    <input type="date" id="req-off-day" required>
                `;
            }
            fieldsContainer.innerHTML = fieldsHtml;
        });
    },

    handleRequestSubmit: async function() {
        const requestType = document.getElementById('request-type-selector').value;
        if (!requestType) {
            app.showToast('Please select a request type.', 'error');
            return;
        }

        let details = {};
        if (requestType === 'Money') {
            details = {
                amount: document.getElementById('req-amount').value,
                reason: document.getElementById('req-reason').value
            };
        } else if (requestType === 'Leave') {
            details = {
                leave_type: document.getElementById('req-leave-type').value,
                start_date: document.getElementById('req-start-date').value,
                end_date: document.getElementById('req-end-date').value
            };
        } else if (requestType === 'Off-Day') {
            details = {
                off_day_date: document.getElementById('req-off-day').value
            };
        }

        const requestData = {
            user_id: app.currentUser.id,
            request_type: requestType,
            details: details,
            status: 'Pending'
        };

        try {
            const { error } = await client.from('requests').insert(requestData);
            if (error) throw error;
            app.showToast('Request submitted successfully!');
            app.hideModal();
            this.loadRequests();
        } catch (error) {
            app.showToast('Failed to submit request.', 'error');
        }
    },
    
    handleAdminAction: async function(requestId, action) {
        let adminComment = '';
        if (action === 'Denied') {
            adminComment = prompt(`Please provide a reason for denying this request:`);
            if (adminComment === null) return; // User cancelled the prompt
        }
        
        const updateData = {
            status: action,
            processed_by: app.currentUser.id,
            processed_at: new Date().toISOString(),
            admin_comment: adminComment
        };

        try {
            const { error } = await client.from('requests').update(updateData).eq('id', requestId);
            if (error) throw error;
            app.showToast(`Request has been ${action}.`);
            this.loadRequests();
        } catch (error) {
            app.showToast('Failed to process request.', 'error');
        }
    }
};