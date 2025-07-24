// js/servicedesk.js

window.servicedesk = {
    html: `
        <div class="card">
            <div class="card-header">
                <div id="servicedesk-tab-navigation" class="tab-navigation"></div>
                <button id="new-ticket-btn" class="btn">Submit New Ticket</button>
            </div>
            <div id="admin-ticket-filters" class="hidden" style="display:flex; flex-wrap: wrap; gap: 15px; margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
                <select id="ticket-status-filter" class="filter-input"><option value="">All Statuses</option><option value="Open">Open</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option><option value="Closed">Closed</option></select>
                <select id="ticket-priority-filter" class="filter-input"><option value="">All Priorities</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option></select>
                <select id="ticket-user-filter" class="filter-input"><option value="">All Requesters</option></select>
                <input type="text" id="ticket-search-input" placeholder="Search subject..." class="filter-input" style="flex-grow: 1;">
            </div>
            <div class="table-wrapper" id="ticket-list-view">
                <table id="tickets-table"></table>
            </div>
            <div id="ticket-detail-view" class="hidden" style="margin-top: 20px;"></div>
        </div>
    `,
    currentView: 'my-tickets',

    init: function() {
        if (app.currentUser.role === 'Admin') this.setupAdminView();
        else this.setupEmployeeView();
        document.getElementById('new-ticket-btn').addEventListener('click', () => this.showNewTicketModal());
    },

    setupEmployeeView: function() {
        const tabNav = document.getElementById('servicedesk-tab-navigation');
        tabNav.innerHTML = `
            <button id="tab-my-tickets" class="tab-btn active">My Submitted Tickets</button>
            <button id="tab-assigned-tickets" class="tab-btn">Assigned to Me</button>
        `;
        this.showMyTickets();
        tabNav.querySelector('#tab-my-tickets').addEventListener('click', () => this.showMyTickets());
        tabNav.querySelector('#tab-assigned-tickets').addEventListener('click', () => this.showAssignedTickets());
    },

    setupAdminView: function() {
        const tabNav = document.getElementById('servicedesk-tab-navigation');
        tabNav.innerHTML = `<button id="tab-all-tickets" class="tab-btn active">All Tickets</button>`;
        document.getElementById('admin-ticket-filters').classList.remove('hidden');
        this.populateUserFilter();
        document.getElementById('ticket-status-filter').addEventListener('change', () => this.loadTickets());
        document.getElementById('ticket-priority-filter').addEventListener('change', () => this.loadTickets());
        document.getElementById('ticket-user-filter').addEventListener('change', () => this.loadTickets());
        document.getElementById('ticket-search-input').addEventListener('input', () => this.loadTickets());
        this.loadTickets();
    },

    setActiveTab: function(tabId) {
        document.querySelectorAll('#servicedesk-tab-navigation .tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(tabId);
        if (activeBtn) activeBtn.classList.add('active');
    },

    showMyTickets: function() { this.currentView = 'my-tickets'; this.setActiveTab('tab-my-tickets'); this.loadTickets(); },
    showAssignedTickets: function() { this.currentView = 'assigned-tickets'; this.setActiveTab('tab-assigned-tickets'); this.loadTickets(); },
    
    loadTickets: async function() {
        document.getElementById('ticket-detail-view').classList.add('hidden');
        document.getElementById('ticket-list-view').classList.remove('hidden');
        const table = document.getElementById('tickets-table');
        const isAdmin = app.currentUser.role === 'Admin';
        let colspan = 5, headers = `<th>Subject</th><th>Priority</th><th>Status</th><th>Last Update</th><th>Actions</th>`;
        if (isAdmin) {
            colspan = 7;
            headers = `<th>Subject</th><th>Requester</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Last Update</th><th>Actions</th>`;
        } else if (this.currentView === 'assigned-tickets') {
            headers = `<th>Subject</th><th>Requester</th><th>Priority</th><th>Status</th><th>Last Update</th><th>Actions</th>`;
            colspan = 6;
        }
        table.innerHTML = `<thead><tr>${headers}</tr></thead><tbody><tr><td colspan="${colspan}">Loading tickets...</td></tr></tbody>`;
        
        try {
            let query = client.from('tickets').select(`*, requester:users!tickets_created_by_fkey(full_name), assignee:users!tickets_assigned_to_fkey(full_name)`);
            if (isAdmin) {
                const status = document.getElementById('ticket-status-filter').value, priority = document.getElementById('ticket-priority-filter').value, userId = document.getElementById('ticket-user-filter').value, searchTerm = document.getElementById('ticket-search-input').value;
                if (status) query = query.eq('status', status);
                if (priority) query = query.eq('priority', priority);
                if (userId) query = query.eq('created_by', userId);
                if (searchTerm) query = query.ilike('subject', `%${searchTerm}%`);
            } else {
                if(this.currentView === 'my-tickets') query = query.eq('created_by', app.currentUser.id);
                else query = query.eq('assigned_to', app.currentUser.id);
            }
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = data.length === 0 ? `<tr><td colspan="${colspan}">No tickets found.</td></tr>` : 
                data.map(ticket => `<tr><td>#${ticket.id} - ${ticket.subject}</td>${isAdmin || this.currentView === 'assigned-tickets' ? `<td>${ticket.requester?.full_name || 'N/A'}</td>` : ''}${isAdmin ? `<td>${ticket.assignee?.full_name || '<em>Unassigned</em>'}</td>` : ''}<td><span class="priority ${ticket.priority.toLowerCase()}">${ticket.priority}</span></td><td><span class="status ${ticket.status.replace(/\s+/g, '-').toLowerCase()}">${ticket.status}</span></td><td>${new Date(ticket.created_at).toLocaleDateString()}</td><td><button class="btn-small view-ticket-btn" data-id="${ticket.id}">View Details</button></td></tr>`).join('');
            tbody.querySelectorAll('.view-ticket-btn').forEach(btn => btn.addEventListener('click', e => this.showTicketDetail(e.target.dataset.id)));
        } catch(error) { console.error("Error loading tickets:", error); app.showToast('Could not load tickets.', 'error'); }
    },
    
    showTicketDetail: async function(ticketId) {
        document.getElementById('ticket-list-view').classList.add('hidden');
        document.getElementById('new-ticket-btn').classList.add('hidden');
        document.getElementById('admin-ticket-filters')?.classList.add('hidden');
        const detailView = document.getElementById('ticket-detail-view');
        detailView.classList.remove('hidden');
        detailView.innerHTML = `<p>Loading ticket details...</p>`;
        try {
            const { data: ticket, error } = await client.from('tickets').select(`*, requester:users!tickets_created_by_fkey(full_name), assignee:users!tickets_assigned_to_fkey(full_name)`).eq('id', ticketId).single();
            if (error) throw error;
            const isAdmin = app.currentUser.role === 'Admin', isCreator = ticket.created_by === app.currentUser.id, isAssignee = ticket.assigned_to === app.currentUser.id;
            const canUpdateStatus = isAdmin || isAssignee, canComment = isAdmin || isCreator || isAssignee, isResolved = ['Resolved', 'Closed'].includes(ticket.status);
            let controlsHtml = '';
            if (canUpdateStatus && !isResolved) {
                const statusOptions = ['Open', 'In Progress', 'Resolved', 'Closed'].map(s => `<option value="${s}" ${ticket.status === s ? 'selected' : ''}>${s}</option>`).join('');
                let assigneeDropdownHtml = '';
                if (isAdmin) {
                    const { data: users } = await client.from('users').select('id, full_name').eq('is_active', true);
                    const userOptions = users.map(u => `<option value="${u.id}" ${ticket.assigned_to === u.id ? 'selected' : ''}>${u.full_name}</option>`).join('');
                    assigneeDropdownHtml = `<label for="ticket-assignee-update">Assign To:</label><select id="ticket-assignee-update"><option value="">-- Unassigned --</option>${userOptions}</select>`;
                }
                controlsHtml = `<div class="ticket-admin-actions"><h4>${isAdmin ? 'Admin Controls' : 'Update Status'}</h4><div class="admin-controls-grid"><label for="ticket-status-update">Change Status:</label><select id="ticket-status-update">${statusOptions}</select>${assigneeDropdownHtml}</div><button id="update-ticket-btn" class="btn" style="margin-top: 15px;">Update Ticket</button></div>`;
            }
            detailView.innerHTML = `<button id="back-to-tickets-btn" class="btn btn-secondary" style="margin-bottom:20px;">← Back to List</button><div class="ticket-detail-header"><h3>#${ticket.id} - ${ticket.subject}</h3><div class="ticket-meta"><span><strong>Requester:</strong> ${ticket.requester?.full_name||'N/A'}</span><span><strong>Assigned To:</strong> ${ticket.assignee?.full_name||'<em>Unassigned</em>'}</span><span><strong>Priority:</strong> <span class="priority ${ticket.priority.toLowerCase()}">${ticket.priority}</span></span><span><strong>Status:</strong> <span class="status ${ticket.status.replace(/\s+/g, '-').toLowerCase()}">${ticket.status}</span></span></div></div><div class="ticket-body"><div class="ticket-description">${ticket.description.replace(/\n/g, '<br>')}</div>${controlsHtml}<hr><h4>Comments & History</h4><div id="ticket-comments-list" class="comments-container"></div>${(canComment && !isResolved) ? `<div class="ticket-add-comment"><textarea id="new-comment-text" rows="3" placeholder="Add a public comment..."></textarea>${isAdmin ? `<label><input type="checkbox" id="is-internal-note"> Add as internal note</label>` : ''}<button id="post-comment-btn" class="btn">Post Comment</button></div>` : '<p>This ticket is resolved. No further comments can be added.</p>'}</div>`;
            this.loadTicketComments(ticketId);
            document.getElementById('back-to-tickets-btn').addEventListener('click', () => { this.loadTickets(); document.getElementById('new-ticket-btn').classList.remove('hidden'); document.getElementById('admin-ticket-filters')?.classList.remove('hidden');});
            if (canComment && !isResolved) document.getElementById('post-comment-btn').addEventListener('click', () => this.postTicketComment(ticketId));
            if (canUpdateStatus && !isResolved) document.getElementById('update-ticket-btn').addEventListener('click', () => this.updateTicket(ticketId));
        } catch(error) { console.error("Error showing ticket detail:", error); detailView.innerHTML = `<p>Error loading ticket. <a href="#" onclick="window.servicedesk.loadTickets()">Go back</a></p>`; }
    },

    loadTicketComments: async function(ticketId) {
        const container = document.getElementById('ticket-comments-list');
        const { data, error } = await client.from('ticket_comments').select(`*, user:users(full_name)`).eq('ticket_id', ticketId).order('created_at', { ascending: true });
        if (error) { container.innerHTML = `<p>Could not load comments.</p>`; return; }
        container.innerHTML = data.length === 0 ? '<p>No comments yet.</p>' : data.filter(c => !c.is_internal_note || app.currentUser.role === 'Admin').map(c => `<div class="comment-item ${c.is_internal_note ? 'internal' : ''}"><strong>${c.user?.full_name || 'System'}${c.is_internal_note ? ' (Internal Note)' : ''}:</strong><p>${c.comment}</p><small>${new Date(c.created_at).toLocaleString()}</small></div>`).join('');
    },

    showNewTicketModal: function() {
        const formHtml = `<form id="new-ticket-form"><label for="ticket-subject">Subject:</label><input type="text" id="ticket-subject" required><label for="ticket-priority">Priority:</label><select id="ticket-priority" required><option value="Medium">Medium</option><option value="Low">Low</option><option value="High">High</option><option value="Urgent">Urgent</option></select><label for="ticket-description">Description:</label><textarea id="ticket-description" rows="5" required></textarea></form>`;
        app.showModal('Submit New Service Ticket', formHtml, { onSave: () => this.handleSubmitTicket(), saveText: 'Submit Ticket' });
    },

    handleSubmitTicket: async function() {
        const subject = document.getElementById('ticket-subject').value;
        const priority = document.getElementById('ticket-priority').value;
        const description = document.getElementById('ticket-description').value;
        
        // --- DEBUGGING ---
        const ticketData = { 
            subject, 
            priority, 
            description, 
            created_by: app.currentUser.id 
        };
        console.log("Submitting ticket with this data:", ticketData);
        // --- END DEBUGGING ---

        if (!subject || !description) { 
            app.showToast('Subject and description are required.', 'error'); 
            return; 
        }
        try {
            const { error } = await client.from('tickets').insert(ticketData); // Use the data object
            if (error) throw error; // Make sure to throw the error to catch it below

            app.showToast('Ticket submitted successfully!');
            app.hideModal();
            this.loadTickets();
        } catch (error) { 
            // THIS IS WHERE THE DETAILED ERROR IS
            console.error("Submit Ticket Error:", error);
            app.showToast(error.message, 'error'); 
        }
    },

    postTicketComment: async function(ticketId) {
        const commentText = document.getElementById('new-comment-text').value;
        const isInternal = document.getElementById('is-internal-note')?.checked || false;
        if (!commentText.trim()) return;
        try {
            await client.from('ticket_comments').insert({ ticket_id: ticketId, user_id: app.currentUser.id, comment: commentText, is_internal_note: isInternal });
            document.getElementById('new-comment-text').value = '';
            this.loadTicketComments(ticketId);
        } catch (error) { app.showToast('Failed to post comment.', 'error'); }
    },

    updateTicket: async function(ticketId) {
        const newStatus = document.getElementById('ticket-status-update').value;
        const assigneeSelect = document.getElementById('ticket-assignee-update');
        const newAssignee = assigneeSelect ? (assigneeSelect.value || null) : undefined;
        if (!confirm(`Are you sure you want to update this ticket?`)) return;
        try {
            let updateData = { status: newStatus };
            if (newAssignee !== undefined) updateData.assigned_to = newAssignee;
            await client.from('tickets').update(updateData).eq('id', ticketId);
            const comment = `Ticket status changed to ${newStatus}.${newAssignee !== undefined ? (newAssignee ? ` Assigned to an employee.` : ' Set to Unassigned.') : ''}`;
            await client.from('ticket_comments').insert({ ticket_id: ticketId, user_id: app.currentUser.id, comment, is_internal_note: true });
            app.showToast('Ticket updated successfully.');
            this.showTicketDetail(ticketId);
        } catch (error) { app.showToast('Failed to update ticket.', 'error'); }
    },
    
    populateUserFilter: async function() {
        const userFilter = document.getElementById('ticket-user-filter');
        if (userFilter.options.length > 1) return;
        try {
            const { data: users, error } = await client.from('users').select('id, full_name').order('full_name');
            if (error) throw error;
            users.forEach(user => userFilter.innerHTML += `<option value="${user.id}">${user.full_name}</option>`);
        } catch (error) { app.showToast('Could not load user filter.', 'error'); }
    }
};