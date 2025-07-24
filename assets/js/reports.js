// js/reports.js

window.reports = {
    // The HTML structure is now enhanced with a container for admin filters, hidden by default.
    html: `
        <div class="card">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h2 id="reports-title">My Activity Reports</h2>
                <button id="add-report-btn" class="btn">Submit New Report</button>
            </div>

            <!-- Admin Filter Controls - Hidden by default, shown only for Admins -->
            <div id="admin-report-filters" class="hidden" style="display:flex; flex-wrap: wrap; gap: 15px; margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
                <select id="report-user-filter" class="filter-input"><option value="">All Employees</option></select>
                <select id="report-type-filter" class="filter-input">
                    <option value="">All Types</option>
                    <option>Office</option>
                    <option>Marketing</option>
                    <option>Technical</option>
                    <option>Complaints</option>
                </select>
                <input type="text" id="report-search-input" placeholder="Search in description..." class="filter-input" style="flex-grow: 1;">
                <input type="date" id="report-start-date" class="filter-input" title="Start Date">
                <input type="date" id="report-end-date" class="filter-input" title="End Date">
                <button id="clear-filters-btn" class="btn-secondary">Clear</button>
            </div>

            <table id="reports-table">
                <thead>
                    <tr id="reports-table-header">
                        <!-- Header content is now built dynamically -->
                    </tr>
                </thead>
                <tbody id="reports-table-body">
                    <!-- Report rows will be inserted here -->
                </tbody>
            </table>
        </div>
    `,

    // The init function now sets up the view based on the user's role.
    init: function() {
        document.getElementById('add-report-btn').addEventListener('click', () => this.showAddReportModal());

        if (app.currentUser.role === 'Admin') {
            this.setupAdminView();
        } else {
            this.setupEmployeeView();
        }

        this.loadReports();
    },

    // Sets up the view for a standard employee.
    setupEmployeeView: function() {
        document.getElementById('reports-table-header').innerHTML = `
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Photo</th>
        `;
    },

    // Sets up the more complex view for an Admin.
    setupAdminView: function() {
        document.getElementById('reports-title').textContent = 'All Activity Reports';
        document.getElementById('add-report-btn').style.display = 'none'; // Admins don't submit reports here.
        document.getElementById('admin-report-filters').classList.remove('hidden');

        // Populate the table header for the admin view
        document.getElementById('reports-table-header').innerHTML = `
            <th>Employee</th>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Photo</th>
        `;

        this.populateUserFilter();

        // Add event listeners for all filter controls
        document.getElementById('report-user-filter').addEventListener('change', () => this.loadReports());
        document.getElementById('report-type-filter').addEventListener('change', () => this.loadReports());
        document.getElementById('report-search-input').addEventListener('input', () => this.loadReports());
        document.getElementById('report-start-date').addEventListener('change', () => this.loadReports());
        document.getElementById('report-end-date').addEventListener('change', () => this.loadReports());
        document.getElementById('clear-filters-btn').addEventListener('click', () => this.clearFilters());
    },

    // Fetches all users and populates the user filter dropdown for admins.
    populateUserFilter: async function() {
        try {
            const { data: users, error } = await client.from('users').select('id, full_name').order('full_name');
            if (error) throw error;

            const userFilter = document.getElementById('report-user-filter');
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.full_name;
                userFilter.appendChild(option);
            });
        } catch (error) {
            app.showToast('Could not load user list for filtering.', 'error');
        }
    },
    
    // The core function to load reports, now builds the query dynamically.
    loadReports: async function() {
        const tableBody = document.getElementById('reports-table-body');
        tableBody.innerHTML = '<tr><td colspan="5">Loading reports...</td></tr>';

        try {
            let query = client.from('reports').select('*, users(full_name)'); // Join with users table to get name

            // Apply filters based on role and UI controls
            if (app.currentUser.role === 'Admin') {
                const userId = document.getElementById('report-user-filter').value;
                const type = document.getElementById('report-type-filter').value;
                const searchTerm = document.getElementById('report-search-input').value;
                const startDate = document.getElementById('report-start-date').value;
                const endDate = document.getElementById('report-end-date').value;

                if (userId) query = query.eq('user_id', userId);
                if (type) query = query.eq('activity_type', type);
                if (searchTerm) query = query.ilike('description', `%${searchTerm}%`); // Case-insensitive search
                if (startDate) query = query.gte('date', startDate);
                if (endDate) query = query.lte('date', endDate);
                
            } else {
                // If not an admin, only fetch reports for the current user
                query = query.eq('user_id', app.currentUser.id);
            }

            // Finalize query and fetch data
            const { data, error } = await query.order('date', { ascending: false });
            if (error) throw error;

            tableBody.innerHTML = '';
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">No reports found.</td></tr>';
                return;
            }

            data.forEach(report => {
                const row = document.createElement('tr');
                const employeeName = report.users ? report.users.full_name : 'Unknown User';
                const photoLink = report.photo_url ? `<a href="${report.photo_url}" target="_blank">View</a>` : 'N/A';
                
                let rowContent = `
                    <td>${new Date(report.date).toLocaleDateString()}</td>
                    <td>${report.activity_type}</td>
                    <td>${report.description || ''}</td>
                    <td>${photoLink}</td>
                `;

                // Prepend the employee name column only for Admins
                if (app.currentUser.role === 'Admin') {
                    rowContent = `<td>${employeeName}</td>` + rowContent;
                }
                
                row.innerHTML = rowContent;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading reports:', error);
            app.showToast('Failed to load reports.', 'error');
            tableBody.innerHTML = '<tr><td colspan="5">An error occurred while loading reports.</td></tr>';
        }
    },

    clearFilters: function() {
        document.getElementById('report-user-filter').value = '';
        document.getElementById('report-type-filter').value = '';
        document.getElementById('report-search-input').value = '';
        document.getElementById('report-start-date').value = '';
        document.getElementById('report-end-date').value = '';
        this.loadReports();
    },

    // The functions for submitting reports remain largely the same.
    showAddReportModal: function() {
        const formHtml = `
            <form id="new-report-form">
                <label for="report-date">Date:</label>
                <input type="date" id="report-date" required value="${new Date().toISOString().slice(0,10)}">
                <label for="report-type">Activity Type:</label>
                <select id="report-type" required>
                    <option>Office</option>
                    <option>Marketing</option>
                    <option>Technical</option>
                    <option>Complaint</option>
                </select>
                <label for="report-desc">Description:</label>
                <textarea id="report-desc" rows="4" required></textarea>
                <label for="report-photo">Optional Photo:</label>
                <input type="file" id="report-photo" accept="image/*">
            </form>
        `;
        app.showModal('Submit New Report', formHtml, {
            onSave: () => this.handleReportSubmit(),
            saveText: 'Submit'
        });
    },

    handleReportSubmit: async function() {
        const date = document.getElementById('report-date').value;
        const type = document.getElementById('report-type').value;
        const description = document.getElementById('report-desc').value;
        const photoFile = document.getElementById('report-photo').files[0];
        let photoUrl = null;

        // --- Photo Upload Logic ---
        if (photoFile) {
            try {
                const fileName = `${app.currentUser.id}-${Date.now()}-${photoFile.name}`;
                // This assumes you have a public Supabase Storage bucket named 'report-photos'
                const { data: uploadData, error: uploadError } = await client.storage
                    .from('report-photos')
                    .upload(fileName, photoFile);
                
                if (uploadError) throw uploadError;
                
                // Get the public URL of the uploaded file
                const { data: urlData } = client.storage.from('report-photos').getPublicUrl(fileName);
                photoUrl = urlData.publicUrl;

            } catch (error) {
                console.error("Photo upload error:", error);
                app.showToast('Could not upload photo.', 'error');
                return; // Stop submission if photo upload fails
            }
        }
        
        const reportData = {
            user_id: app.currentUser.id,
            date: date,
            activity_type: type,
            description: description,
            photo_url: photoUrl
        };

        try {
            const { error } = await client.from('reports').insert(reportData);
            if (error) throw error;
            
            app.showToast('Report submitted successfully!');
            app.hideModal();
            this.loadReports();
        } catch (error) {
            console.error("Report submission error:", error);
            app.showToast('Failed to submit report.', 'error');
        }
    }
};