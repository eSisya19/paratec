// js/trips.js

window.trips = {
    html: `
        <div class="card">
            <div class="card-header">
                <div id="trips-tab-navigation" class="tab-navigation"></div>
                <button id="add-trip-btn" class="btn">Request New Trip</button>
            </div>
            <div id="trips-content"></div>
        </div>
    `,
    adminListViewHtml: `<div id="admin-trip-filters" style="display:flex; flex-wrap: wrap; gap: 15px; margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;"><select id="trip-user-filter" class="filter-input"><option value="">All Employees</option></select><select id="trip-status-filter" class="filter-input"><option value="Pending">Pending</option><option value="">All Statuses</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select><input type="text" id="trip-search-input" placeholder="Search destination..." class="filter-input" style="flex-grow: 1;"><button id="clear-trip-filters-btn" class="btn-secondary">Clear</button></div><div class="table-wrapper"><table id="trips-table"><thead><tr id="trips-table-header"></tr></thead><tbody id="trips-table-body"></tbody></table></div>`,
    adminCalendarViewHtml: `<div id="trip-calendar-container" style="margin-top:20px;"></div>`,
    employeeViewHtml: `<div class="table-wrapper"><table id="trips-table"><thead><tr id="trips-table-header"></tr></thead><tbody id="trips-table-body"></tbody></table></div>`,
    calendarInstance: null,

    init: function() {
        document.getElementById('add-trip-btn').addEventListener('click', () => this.showTripModal());
        if (app.currentUser.role === 'Admin') this.setupAdminView();
        else this.setupEmployeeView();
    },

    setupEmployeeView: function() {
        document.getElementById('trips-tab-navigation').innerHTML = `<button id="tab-my-trips" class="tab-btn active">My Trips</button>`;
        this.showEmployeeTrips();
    },

    setupAdminView: function() {
        const tabNav = document.getElementById('trips-tab-navigation');
        tabNav.innerHTML = `<button id="tab-trip-list" class="tab-btn active">Trip List</button><button id="tab-trip-calendar" class="tab-btn">Calendar View</button>`;
        this.showAdminTripList();
        tabNav.querySelector('#tab-trip-list').addEventListener('click', () => this.showAdminTripList());
        tabNav.querySelector('#tab-trip-calendar').addEventListener('click', () => this.showAdminCalendar());
    },

    setActiveTab: function(tabId) { document.querySelectorAll('#trips-tab-navigation .tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(tabId)?.classList.add('active'); },
    showEmployeeTrips: function() { this.setActiveTab('tab-my-trips'); document.getElementById('trips-content').innerHTML = this.employeeViewHtml; this.loadTrips(); },
    showAdminTripList: function() { this.setActiveTab('tab-trip-list'); document.getElementById('trips-content').innerHTML = this.adminListViewHtml; this.loadTrips(); },
    showAdminCalendar: function() { this.setActiveTab('tab-trip-calendar'); document.getElementById('trips-content').innerHTML = this.adminCalendarViewHtml; this.loadAndRenderCalendar(); },

    loadAndRenderCalendar: async function() {
        const calendarEl = document.getElementById('trip-calendar-container');
        if (!calendarEl) return;
        try {
            const { data, error } = await client.from('trips').select(`*, trip_participants(users(full_name))`).in('status', ['Approved']);
            if (error) throw error;
            const calendarEvents = data.map(trip => {
                const participants = trip.trip_participants.map(p => p.users.full_name);
                let color = '#4a90e2';
                if (trip.actual_departure && !trip.actual_return) color = '#7ed321';
                if (trip.actual_return) color = '#777';
                const startDate = trip.actual_departure ? new Date(trip.actual_departure) : new Date(trip.scheduled_date);
                let endDate = trip.actual_return ? new Date(trip.actual_return) : null;
                if (endDate) endDate.setDate(endDate.getDate() + 1);
                return { id: trip.id, title: `${trip.destination} (${participants.join(', ')})`, start: startDate.toISOString().slice(0, 10), end: endDate ? endDate.toISOString().slice(0, 10) : null, allDay: true, description: trip.reason, color: color, participants: participants.join(', '), status: trip.status };
            });
            if (this.calendarInstance) this.calendarInstance.destroy();
            this.calendarInstance = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
                events: calendarEvents,
                eventDidMount: (info) => { info.el.setAttribute('title', `Status: ${info.event.extendedProps.status}\nParticipants: ${info.event.extendedProps.participants}\nReason: ${info.event.extendedProps.description}`); }
            });
            this.calendarInstance.render();
        } catch (error) { console.error("Error loading calendar data:", error); calendarEl.innerHTML = '<p>Could not load calendar data.</p>'; }
    },

    loadTrips: async function() {
        const tableBody = document.getElementById('trips-table-body');
        tableBody.innerHTML = `<tr><td colspan="7">Loading trips...</td></tr>`;
        try {
            let query = client.from('trips').select(`*, creator:users!trips_created_by_fkey(full_name), trip_participants(users(id, full_name))`);
            if (app.currentUser.role !== 'Admin') {
                query = query.eq('trip_participants.user_id', app.currentUser.id);
            } else {
                document.getElementById('admin-trip-filters').classList.remove('hidden');
                document.getElementById('trip-user-filter').onchange = () => this.loadTrips();
                document.getElementById('trip-status-filter').onchange = () => this.loadTrips();
                document.getElementById('trip-search-input').oninput = () => this.loadTrips();
                document.getElementById('clear-trip-filters-btn').onclick = () => this.clearFilters();
                this.populateUserFilter();
                const status = document.getElementById('trip-status-filter').value;
                const searchTerm = document.getElementById('trip-search-input').value;
                if (status) query = query.eq('status', status);
                if (searchTerm) query = query.ilike('destination', `%${searchTerm}%`);
            }
            let { data, error } = await query.order('scheduled_date', { ascending: false });
            if (error) throw error;
            if (app.currentUser.role === 'Admin') {
                const userFilterId = document.getElementById('trip-user-filter').value;
                if (userFilterId) data = data.filter(trip => trip.trip_participants.some(p => p.users.id === userFilterId));
            }
            this.renderTable(data);
        } catch (error) { console.error('Error loading trips:', error); app.showToast('Failed to load trips.', 'error'); }
    },

    renderTable: function(data) {
        const tableBody = document.getElementById('trips-table-body');
        tableBody.innerHTML = '';
        const isAdmin = app.currentUser.role === 'Admin';
        if (data.length === 0) { tableBody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 5}">No trips found.</td></tr>`; return; }
        data.forEach(trip => {
            const row = document.createElement('tr');
            const participants = trip.trip_participants.map(p => p.users.full_name).join(', ');
            row.innerHTML = isAdmin ? this.renderAdminRow(trip, participants) : this.renderEmployeeRow(trip, participants);
            tableBody.appendChild(row);
        });
        
        // THE FIX: The single, unified event listener now includes the 'log-trip-btn' case.
        document.getElementById('trips-table-body').addEventListener('click', e => {
            const target = e.target.closest('button');
            if (!target) return;
            const tripId = target.dataset.id;
            if (target.classList.contains('approve-btn')) this.handleTripAction(tripId, 'Approved');
            else if (target.classList.contains('reject-btn')) this.handleTripAction(tripId, 'Rejected');
            else if (target.classList.contains('delete-btn')) this.handleTripDelete(tripId);
            else if (target.classList.contains('start-trip-btn')) this.handleStartTrip(tripId);
            else if (target.classList.contains('end-trip-btn')) this.showEndTripModal(tripId);
            else if (target.classList.contains('log-trip-btn')) this.showLogModal(tripId);
        });
    },

    renderEmployeeRow: function(trip, participants) {
        let actions = 'N/A';
        const statusClass = trip.status.toLowerCase();
        if (trip.status === 'Approved') {
            if (!trip.actual_departure) actions = `<button class="btn-small start-trip-btn" data-id="${trip.id}">Start Trip</button>`;
            else if (!trip.actual_return) actions = `<button class="btn-small log-trip-btn" data-id="${trip.id}">Add Log</button><button class="btn-small end-trip-btn btn-danger" data-id="${trip.id}">End Trip</button>`;
            else actions = `<button class="btn-small log-trip-btn" data-id="${trip.id}">View Logs</button>`;
        } else if (trip.status === 'Pending') {
            actions = 'Awaiting Approval';
        }
        return `<td>${trip.destination}</td><td>${new Date(trip.scheduled_date).toLocaleDateString()}</td><td>${participants}</td><td><span class="status ${statusClass}">${trip.status}</span></td><td class="actions">${actions}</td>`;
    },

    renderAdminRow: function(trip, participants) {
        let adminActions = '';
        if (trip.status === 'Pending') {
            adminActions += `<button class="btn-small approve-btn" data-id="${trip.id}">Approve</button><button class="btn-small reject-btn" data-id="${trip.id}">Reject</button>`;
        }
        // THE FIX: The "View Logs" button is now correctly added to the admin actions.
        adminActions += `<button class="btn-small log-trip-btn" data-id="${trip.id}">View Logs</button><button class="btn-small delete-btn btn-danger" data-id="${trip.id}">Delete</button>`;
        const statusClass = trip.status.toLowerCase();
        return `<td>${trip.destination}</td><td>${participants}</td><td><span class="status ${statusClass}">${trip.status}</span></td><td>${trip.actual_departure ? new Date(trip.actual_departure).toLocaleString() : 'Not started'}</td><td>${trip.actual_return ? new Date(trip.actual_return).toLocaleString() : 'In progress'}</td><td>${this.calculateDuration(trip.actual_departure, trip.actual_return)}</td><td class="actions">${adminActions}</td>`;
    },

    showTripModal: async function() {
        const isAdmin = app.currentUser.role === 'Admin';
        let participantsHtml = '';
        if (isAdmin) {
            const { data: users, error } = await client.from('users').select('id, full_name').order('full_name');
            if (error) { app.showToast('Could not load user list.', 'error'); return; }
            const userOptions = users.map(user => `<option value="${user.id}">${user.full_name}</option>`).join('');
            participantsHtml = `<label for="trip-participants">Assign Employees:</label><select id="trip-participants" multiple required style="height: 150px;">${userOptions}</select><small>Hold Ctrl/Cmd to select multiple.</small>`;
        } else {
            participantsHtml = `<label for="trip-participants">Participant:</label><input type="text" value="${app.currentUser.full_name}" disabled>`;
        }
        const formHtml = `<form id="new-trip-form"><label for="trip-destination">Destination:</label><input type="text" id="trip-destination" required><label for="scheduled-date">Scheduled Date:</label><input type="date" id="scheduled-date" required><label for="trip-reason">Reason:</label><textarea id="trip-reason" rows="3" required></textarea>${participantsHtml}</form>`;
        app.showModal(isAdmin ? 'Schedule & Assign Trip' : 'Request New Trip', formHtml, { onSave: () => this.handleTripSubmit(), saveText: 'Submit' });
    },

    handleTripSubmit: async function() {
        const isAdmin = app.currentUser.role === 'Admin';
        const destination = document.getElementById('trip-destination').value;
        const scheduled_date = document.getElementById('scheduled-date').value;
        const reason = document.getElementById('trip-reason').value;
        let participantIds = isAdmin ? [...document.getElementById('trip-participants').options].filter(opt => opt.selected).map(opt => opt.value) : [app.currentUser.id];
        if (!destination || !scheduled_date || !reason || participantIds.length === 0) { app.showToast('All fields are required.', 'error'); return; }
        try {
            const tripData = { destination, scheduled_date, reason, created_by: app.currentUser.id, assigned_by: isAdmin ? app.currentUser.id : null, status: isAdmin ? 'Approved' : 'Pending' };
            const { data: newTrip, error: tripError } = await client.from('trips').insert(tripData).select().single();
            if (tripError) throw tripError;
            const participantData = participantIds.map(userId => ({ trip_id: newTrip.id, user_id: userId }));
            const { error: participantsError } = await client.from('trip_participants').insert(participantData);
            if (participantsError) throw participantsError;
            app.showToast('Trip submitted successfully!');
            app.hideModal();
            this.loadTrips();
        } catch (error) { console.error("Trip submission error:", error); app.showToast('Failed to submit trip.', 'error'); }
    },

    handleTripAction: async function(tripId, newStatus) {
        if (newStatus === 'Rejected' && !confirm('Are you sure?')) return;
        try { await client.from('trips').update({ status: newStatus }).eq('id', tripId); app.showToast(`Trip has been ${newStatus}.`); this.loadTrips(); } catch (error) { app.showToast('Failed to process trip.', 'error'); }
    },

    handleTripDelete: async function(tripId) {
        if (!confirm('Permanently delete this trip?')) return;
        try { await client.from('trips').delete().eq('id', tripId); app.showToast('Trip deleted.'); this.loadTrips(); } catch (error) { app.showToast('Failed to delete trip.', 'error'); }
    },

    handleStartTrip: async function(tripId) {
        if (!confirm('Start this trip now?')) return;
        try { await client.from('trips').update({ actual_departure: new Date().toISOString() }).eq('id', tripId); app.showToast('Trip started!'); this.loadTrips(); } catch (error) { app.showToast('Failed to start trip.', 'error'); }
    },

    showEndTripModal: function(tripId) {
        const formHtml = `<p>Please provide a final conclusion report for your trip. Summarize the work done and the outcome.</p><form id="end-trip-form"><label for="conclusion-report">Conclusion Report:</label><textarea id="conclusion-report" rows="6" required></textarea></form>`;
        app.showModal('End Trip & File Report', formHtml, { onSave: () => this.handleEndTrip(tripId), saveText: 'End Trip' });
    },

    handleEndTrip: async function(tripId) {
        const conclusion_report = document.getElementById('conclusion-report').value;
        if (!conclusion_report.trim()) { app.showToast('A conclusion report is required to end the trip.', 'error'); return; }
        try {
            await client.from('trip_logs').insert({ trip_id: tripId, user_id: app.currentUser.id, details: conclusion_report, log_type: 'Conclusion' });
            await client.from('trips').update({ actual_return: new Date().toISOString(), conclusion_report: conclusion_report }).eq('id', tripId);
            app.showToast('Trip ended successfully!');
            app.hideModal();
            this.loadTrips();
        } catch (error) { app.showToast('Failed to end trip.', 'error'); }
    },

    showLogModal: async function(tripId) {
        const { data: trip, error: tripError } = await client.from('trips').select('*').eq('id', tripId).single();
        if (tripError) { app.showToast('Could not load trip data.', 'error'); return; }
        const isCompleted = !!trip.actual_return;
        const isAdmin = app.currentUser.role === 'Admin';
        const canAddLog = !isCompleted && !isAdmin;
        let addLogHtml = '';
        if (canAddLog) addLogHtml = `<hr><h4>Add New Log Entry</h4><div id="trip-add-log-section"><textarea id="new-log-details" rows="3" placeholder="Enter work update..."></textarea><button id="submit-log-btn" class="btn" style="margin-top: 10px;">Submit Log</button></div>`;
        else if (isAdmin && !isCompleted) addLogHtml = `<p><em>Trip is in progress. Logs can be added by the employee.</em></p>`;
        const modalContent = `<div id="trip-logs-list-container" class="comments-container" style="max-height: 300px; overflow-y: auto;"><p>Loading logs...</p></div>${addLogHtml}`;
        app.showModal(`Logs for Trip to ${trip.destination}`, modalContent);
        this.loadTripLogs(tripId);
        if (canAddLog) document.getElementById('submit-log-btn').addEventListener('click', () => this.handleAddLog(tripId));
    },

    loadTripLogs: async function(tripId) {
        const container = document.getElementById('trip-logs-list-container');
        try {
            const { data, error } = await client.from('trip_logs').select(`*, user:users(full_name)`).eq('trip_id', tripId).order('created_at', { ascending: false });
            if (error) throw error;
            if (data.length === 0) container.innerHTML = '<p>No logs have been added for this trip yet.</p>';
            else container.innerHTML = data.map(log => `<div class="comment-item"><strong style="color:${log.log_type === 'Conclusion' ? 'var(--primary-color)' : 'inherit'}">${log.user?.full_name || 'N/A'} logged a ${log.log_type}:</strong><p>${log.details.replace(/\n/g, '<br>')}</p><small>${new Date(log.created_at).toLocaleString()}</small></div>`).join('');
        } catch (e) { container.innerHTML = '<p>Could not load trip logs.</p>'; }
    },

    handleAddLog: async function(tripId) {
        const details = document.getElementById('new-log-details').value;
        if (!details.trim()) { app.showToast('Log details cannot be empty.', 'error'); return; }
        try {
            await client.from('trip_logs').insert({ trip_id: tripId, user_id: app.currentUser.id, details: details, log_type: 'Update' });
            app.showToast('Log added successfully.');
            this.loadTripLogs(tripId);
            document.getElementById('new-log-details').value = '';
        } catch (error) { app.showToast('Failed to add log.', 'error'); }
    },

    calculateDuration: function(start, end) {
        if (!start) return 'N/A';
        const endDate = end ? new Date(end) : new Date();
        const startDate = new Date(start);
        if (isNaN(startDate.getTime())) return 'N/A';
        let diff = Math.abs(endDate.getTime() - startDate.getTime()) / 1000;
        const days = Math.floor(diff / 86400); diff -= days * 86400;
        const hours = Math.floor(diff / 3600) % 24; diff -= hours * 3600;
        const minutes = Math.floor(diff / 60) % 60;
        let duration = [];
        if (days > 0) duration.push(`${days}d`);
        if (hours > 0) duration.push(`${hours}h`);
        if (minutes > 0 && days < 1) duration.push(`${minutes}m`);
        if (duration.length === 0 && end) return '<1m';
        if (duration.length === 0 && !end) return 'In Progress';
        return duration.join(' ');
    },

    populateUserFilter: async function() {
        const userFilter = document.getElementById('trip-user-filter');
        if (userFilter && userFilter.options.length > 1) return;
        const { data: users, error } = await client.from('users').select('id, full_name').order('full_name');
        if (error) { app.showToast('Could not load user list.', 'error'); return; }
        if(userFilter) users.forEach(user => userFilter.innerHTML += `<option value="${user.id}">${user.full_name}</option>`);
    },

    clearFilters: function() {
        document.getElementById('trip-user-filter').value = '';
        document.getElementById('trip-status-filter').value = 'Pending';
        document.getElementById('trip-search-input').value = '';
        this.loadTrips();
    }
};