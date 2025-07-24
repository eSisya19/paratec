// js/users.js

window.users = {
    // The HTML structure for the Manage Users page
    html: `
        <div class="card">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h2>Manage Users</h2>
                <button id="add-user-btn" class="btn">+ Add New User</button>
            </div>
            
            <!-- Filter Controls -->
            <div id="user-filters" style="display:flex; gap: 15px; margin-top: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border-color);">
                <input type="text" id="user-search-input" placeholder="Search by name or email..." style="flex-grow: 1; padding: 8px;">
                <select id="role-filter" style="padding: 8px;">
                    <option value="">All Roles</option>
                    <option value="Admin">Admin</option>
                    <option value="Employee">Employee</option>
                </select>
                <select id="status-filter" style="padding: 8px;">
                    <option value="">All Statuses</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
            </div>

            <table id="users-table">
                <thead>
                    <tr>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="users-table-body">
                    <!-- User rows will be dynamically inserted here -->
                </tbody>
            </table>
        </div>
    `,

    // The init function runs when the page is loaded
    init: function() {
        // Ensure only Admins can see this page
        if (app.currentUser.role !== 'Admin') {
            app.navigateTo('dashboard'); // Redirect if not admin
            app.showToast("Access Denied", "error");
            return;
        }

        this.loadUsers();

        // --- Event Listeners ---
        document.getElementById('add-user-btn').addEventListener('click', () => this.showAddUserModal());
        
        // Use event delegation for dynamic action buttons
        document.getElementById('users-table-body').addEventListener('click', (e) => {
            const target = e.target;
            const userId = target.closest('tr')?.dataset.userId;

            if (!userId) return;

            if (target.classList.contains('edit-btn')) {
                this.handleEditClick(userId);
            } else if (target.classList.contains('deactivate-btn')) {
                const isActive = target.dataset.isActive === 'true';
                this.handleDeactivateClick(userId, isActive);
            }
        });

        // Event listeners for filters
        document.getElementById('user-search-input').addEventListener('input', () => this.loadUsers());
        document.getElementById('role-filter').addEventListener('change', () => this.loadUsers());
        document.getElementById('status-filter').addEventListener('change', () => this.loadUsers());
    },

    // Fetches users from Supabase and populates the table
    loadUsers: async function() {
        const tableBody = document.getElementById('users-table-body');
        tableBody.innerHTML = '<tr><td colspan="5">Loading users...</td></tr>';
        
        // Build query based on filters
        const searchTerm = document.getElementById('user-search-input').value;
        const role = document.getElementById('role-filter').value;
        const status = document.getElementById('status-filter').value;

        let query = `${SUPABASE_URL}/rest/v1/users?select=*&order=full_name.asc`;
        
        if (searchTerm) {
            // Search in both name and email columns
            query += `&or=(full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%)`;
        }
        if (role) {
            query += `&role=eq.${role}`;
        }
        if (status) {
            query += `&is_active=eq.${status}`;
        }

        try {
            const response = await fetch(query, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });

            if (!response.ok) throw new Error('Failed to fetch users.');

            const users = await response.json();
            tableBody.innerHTML = ''; // Clear loading message

            if (users.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
                return;
            }

            users.forEach(user => {
                const row = document.createElement('tr');
                row.dataset.userId = user.id; // Store user ID on the row
                row.innerHTML = `
                    <td>${user.full_name}</td>
                    <td>${user.email}</td>
                    <td>${user.role}</td>
                    <td><span class="status ${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn-small edit-btn">Edit</button>
                        <button class="btn-small deactivate-btn ${user.is_active ? 'btn-danger' : 'btn-success'}" data-is-active="${user.is_active}">
                            ${user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });

        } catch (error) {
            app.showToast(error.message, 'error');
            tableBody.innerHTML = `<tr><td colspan="5">Error loading users.</td></tr>`;
        }
    },

    // --- Modal and Form Handlers ---

    showAddUserModal: function() {
        const formHtml = `
            <form id="add-user-form">
                <label for="full_name">Full Name:</label>
                <input type="text" id="full_name" required>
                <label for="email">Email:</label>
                <input type="email" id="email" required>
                <label for="password">Password:</label>
                <input type="password" id="password" required>
                <label for="role">Role:</label>
                <select id="role" required>
                    <option value="Employee">Employee</option>
                    <option value="Admin">Admin</option>
                </select>
            </form>
        `;
        app.showModal('Add New User', formHtml, () => this.handleAddUser());
    },

    handleAddUser: async function() {
        const fullName = document.getElementById('full_name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;

        if (!fullName || !email || !password || !role) {
            app.showToast("All fields are required.", "error");
            return;
        }

        // IMPORTANT: Hash the password before sending to DB
        const hashedPassword = sha256(password);

        const newUser = {
            full_name: fullName,
            email: email,
            password: hashedPassword,
            role: role,
            is_active: true
        };

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(newUser)
            });

            if (response.status === 409) throw new Error("User with this email already exists.");
            if (!response.ok) throw new Error("Failed to create user.");
            
            app.showToast("User created successfully!");
            app.hideModal();
            this.loadUsers(); // Refresh the table
        } catch (error) {
            app.showToast(error.message, "error");
        }
    },

    handleEditClick: async function(userId) {
        try {
            // Fetch the latest user data first
            const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=*`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            const userData = await response.json();
            const user = userData[0];

            if (!user) throw new Error("User not found.");

            const formHtml = `
                <form id="edit-user-form">
                    <label for="edit_full_name">Full Name:</label>
                    <input type="text" id="edit_full_name" value="${user.full_name}" required>
                    
                    <label for="edit_email">Email:</label>
                    <input type="email" id="edit_email" value="${user.email}" readonly>
                    <small>Email cannot be changed.</small>

                    <label for="edit_role">Role:</label>
                    <select id="edit_role" required>
                        <option value="Employee" ${user.role === 'Employee' ? 'selected' : ''}>Employee</option>
                        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </form>
            `;
            app.showModal('Edit User', formHtml, () => this.handleUpdateUser(userId));

        } catch (error) {
            app.showToast(error.message, "error");
        }
    },

    handleUpdateUser: async function(userId) {
        const fullName = document.getElementById('edit_full_name').value;
        const role = document.getElementById('edit_role').value;

        const updateData = {
            full_name: fullName,
            role: role
        };

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) throw new Error("Failed to update user.");

            app.showToast("User updated successfully!");
            app.hideModal();
            this.loadUsers();
        } catch (error) {
            app.showToast(error.message, "error");
        }
    },
    
    handleDeactivateClick: async function(userId, isActive) {
        const action = isActive ? "deactivate" : "activate";
        if (!confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ is_active: !isActive })
            });

            if (!response.ok) throw new Error(`Failed to ${action} user.`);

            app.showToast(`User ${action}d successfully!`);
            this.loadUsers();
        } catch (error) {
            app.showToast(error.message, "error");
        }
    }
};