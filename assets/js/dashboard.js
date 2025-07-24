// js/dashboard.js
window.dashboard = {
    html: `
        <div class="card">
            <div class="card-header">Dashboard</div>
            <div id="dashboard-stats" style="display: flex; gap: 20px;">
                <div class="stat-card"><h4>Total Employees</h4><p id="total-employees">--</p></div>
                <div class="stat-card"><h4>Pending Requests</h4><p id="pending-requests">--</p></div>
                <div class="stat-card"><h4>Today's Attendance</h4><p id="today-attendance">--</p></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">Recent Bulletins</div>
            <div id="bulletins-list">Loading bulletins...</div>
        </div>
    `,
    
    init: async function() {
        console.log("Dashboard Initializing...");
        if (app.currentUser.role === 'Admin') {
            this.fetchAdminStats();
        } else {
            this.fetchEmployeeStats();
        }
        // Fetch bulletins for all
        this.fetchBulletins();
    },
    
    fetchAdminStats: async function() {
        // Fetch total employees
        const empRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=count`, { headers: { apikey: SUPABASE_ANON_KEY } });
        const empData = await empRes.json();
        document.getElementById('total-employees').textContent = empData[0].count;

        // Fetch pending requests
        const reqRes = await fetch(`${SUPABASE_URL}/rest/v1/requests?status=eq.Pending&select=count`, { headers: { apikey: SUPABASE_ANON_KEY } });
        const reqData = await reqRes.json();
        document.getElementById('pending-requests').textContent = reqData[0].count;
    },

    fetchEmployeeStats: function() {
        // Employee stats are more limited
        document.getElementById('total-employees').parentElement.style.display = 'none'; // Hide admin-only stat
        // etc.
    },
    
    fetchBulletins: function() {
        // Placeholder for bulletin logic
        document.getElementById('bulletins-list').innerHTML = "<li>No new bulletins.</li>";
    }
};