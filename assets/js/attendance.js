// js/attendance.js

window.attendance = {
    html: `
        <div id="employee-attendance-view">
            <div class="card"><div class="card-header"><h2>Daily Attendance</h2></div><div style="padding: 20px; text-align: center;"><p id="attendance-status" style="font-size: 1.2em; margin-bottom: 20px;">Loading status...</p><button id="attendance-action-btn" class="btn btn-large" style="padding: 15px 30px; font-size: 18px;" disabled>Please wait</button><div id="location-info" style="margin-top: 15px; font-size: 0.9em; color: #666;"></div></div></div>
            <div class="card"><div class="card-header"><h3>My Attendance History</h3></div><table id="attendance-history-table"><thead><tr><th>Date</th><th>Check-in Time</th><th>Check-out Time</th><th>Check-in Location</th><th>Check-out Location</th><th>Accuracy</th></tr></thead><tbody id="attendance-history-body"></tbody></table></div>
        </div>
        <div id="admin-attendance-view" class="hidden">
             <div class="card"><div class="card-header" style="display:flex; justify-content:space-between; align-items:center;"><h2>All Employee Attendance</h2></div><div id="admin-attendance-filters" style="display:flex; flex-wrap: wrap; gap: 15px; margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;"><select id="attendance-user-filter" class="filter-input"><option value="">All Employees</option></select><input type="date" id="attendance-start-date" class="filter-input" title="Start Date"><input type="date" id="attendance-end-date" class="filter-input" title="End Date"><button id="clear-attendance-filters-btn" class="btn-secondary">Clear</button><button id="whos-in-btn" class="btn">Who's In Now?</button></div><table id="admin-attendance-table"><thead><tr><th>Employee</th><th>Date</th><th>Check-in Time</th><th>Check-out Time</th><th>Check-in Location</th><th>Check-out Location</th><th>Accuracy</th></tr></thead><tbody id="admin-attendance-body"></tbody></table></div>
        </div>
    `,

    currentAttendanceRecord: null,

    init: function() {
        if (app.currentUser.role === 'Admin') {
            this.setupAdminView();
        } else {
            this.setupEmployeeView();
        }
    },

    setupEmployeeView: function() {
        document.getElementById('admin-attendance-view').classList.add('hidden');
        document.getElementById('employee-attendance-view').classList.remove('hidden');
        this.actionBtn = document.getElementById('attendance-action-btn');
        this.statusText = document.getElementById('attendance-status');
        this.locationInfo = document.getElementById('location-info');
        this.actionBtn.addEventListener('click', () => this.handleActionClick());
        this.checkCurrentUserState();
        this.loadAttendanceHistory();
    },

    setupAdminView: function() {
        document.getElementById('employee-attendance-view').classList.add('hidden');
        document.getElementById('admin-attendance-view').classList.remove('hidden');
        this.populateUserFilter();
        document.getElementById('attendance-user-filter').addEventListener('change', () => this.loadAdminAttendance());
        document.getElementById('attendance-start-date').addEventListener('change', () => this.loadAdminAttendance());
        document.getElementById('attendance-end-date').addEventListener('change', () => this.loadAdminAttendance());
        document.getElementById('clear-attendance-filters-btn').addEventListener('click', () => this.clearFilters());
        document.getElementById('whos-in-btn').addEventListener('click', () => this.loadWhosInNow());
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('attendance-start-date').value = today;
        document.getElementById('attendance-end-date').value = today;
        this.loadAdminAttendance();
    },

    checkCurrentUserState: async function() {
        this.updateUI('processing');
        try {
            const { data, error } = await client.rpc('get_all_attendance');
            if (error) throw error;
            const today = new Date().toISOString().slice(0, 10);
            const openRecord = data.find(rec => rec.user_id === app.currentUser.id && rec.check_out_time === null && rec.check_in_time.startsWith(today));
            this.currentAttendanceRecord = openRecord ? { ...openRecord, id: openRecord.id } : null;
            this.updateUI(this.currentAttendanceRecord ? 'checked_in' : 'checked_out');
        } catch (error) {
            console.error("Error checking attendance state:", error);
            this.updateUI('error');
        }
    },

    loadAttendanceHistory: async function() {
        const tableBody = document.getElementById('attendance-history-body');
        try {
            const { data, error } = await client.rpc('get_all_attendance');
            if (error) throw error;
            const userHistory = data.filter(rec => rec.user_id === app.currentUser.id).sort((a, b) => new Date(b.check_in_time) - new Date(a.check_in_time)).slice(0, 30);
            this.renderTable(tableBody, userHistory, false);
        } catch (error) {
            console.error('Error loading history:', error);
            tableBody.innerHTML = `<tr><td colspan="6">Could not load history.</td></tr>`;
        }
    },

    loadAdminAttendance: async function(whosInMode = false) {
        const tableBody = document.getElementById('admin-attendance-body');
        try {
            const { data, error } = await client.rpc('get_all_attendance');
            if (error) throw error;
            let filteredData = data;
            if (whosInMode) {
                filteredData = filteredData.filter(rec => rec.check_out_time === null);
            } else {
                const userId = document.getElementById('attendance-user-filter').value;
                const startDate = document.getElementById('attendance-start-date').value;
                const endDate = document.getElementById('attendance-end-date').value;
                if (userId) filteredData = filteredData.filter(rec => rec.user_id === userId);
                if (startDate) filteredData = filteredData.filter(rec => rec.check_in_time >= `${startDate}T00:00:00`);
                if (endDate) filteredData = filteredData.filter(rec => rec.check_in_time <= `${endDate}T23:59:59`);
            }
            const sortedData = filteredData.sort((a, b) => new Date(b.check_in_time) - new Date(a.check_in_time));
            this.renderTable(tableBody, sortedData, true);
        } catch (error) {
            console.error("Admin load error:", error);
            app.showToast('Failed to load records.', 'error');
        }
    },

    updateUI: function(state) {
        if (!this.actionBtn) return;
        switch (state) {
            case 'checked_in': 
                this.actionBtn.textContent = 'Check Out'; 
                this.actionBtn.className = 'btn btn-large btn-danger'; 
                this.statusText.textContent = `Checked In (since ${new Date(this.currentAttendanceRecord.check_in_time).toLocaleTimeString()})`; 
                this.actionBtn.disabled = false; 
                break;
            case 'checked_out': 
                this.actionBtn.textContent = 'Check In'; 
                this.actionBtn.className = 'btn btn-large'; 
                this.statusText.textContent = 'Checked Out'; 
                this.actionBtn.disabled = false; 
                break;
            case 'processing': 
                this.actionBtn.textContent = 'Working...'; 
                this.statusText.textContent = 'Processing...'; 
                this.actionBtn.disabled = true; 
                break;
            case 'error': 
                this.actionBtn.textContent = 'Error'; 
                this.statusText.textContent = 'Could not retrieve status.'; 
                this.actionBtn.disabled = true; 
                break;
        }
    },

    handleActionClick: function() {
        if (this.currentAttendanceRecord) this.handleCheckOut(); else this.handleCheckIn();
    },

    handleCheckIn: async function() {
        this.updateUI('processing');
        if (this.locationInfo) this.locationInfo.textContent = 'Getting precise location...';
        try {
            const locationData = await this.getHighAccuracyGeolocation();
            await client.from('attendance').insert({ 
                user_id: app.currentUser.id, 
                check_in_location: locationData.locationString,
                check_in_accuracy: locationData.accuracy
            });
            app.showToast('Checked in!', 'success');
            this.checkCurrentUserState(); 
            this.loadAttendanceHistory();
            if (this.locationInfo) this.locationInfo.textContent = `GPS location captured: ±${locationData.accuracy}m (${locationData.source})`;
        } catch (error) { 
            app.showToast(error.message, 'error'); 
            this.updateUI('checked_out'); 
            if (this.locationInfo) this.locationInfo.textContent = 'GPS location failed';
        }
    },

    handleCheckOut: async function() {
        this.updateUI('processing');
        if (this.locationInfo) this.locationInfo.textContent = 'Getting precise location...';
        try {
            const locationData = await this.getHighAccuracyGeolocation();
            await client.from('attendance').update({ 
                check_out_time: new Date().toISOString(), 
                check_out_location: locationData.locationString,
                check_out_accuracy: locationData.accuracy
            }).eq('id', this.currentAttendanceRecord.id);
            app.showToast('Checked out!', 'success');
            this.checkCurrentUserState(); 
            this.loadAttendanceHistory();
            if (this.locationInfo) this.locationInfo.textContent = `GPS location captured: ±${locationData.accuracy}m (${locationData.source})`;
        } catch (error) { 
            app.showToast(error.message, 'error'); 
            this.updateUI('checked_in'); 
            if (this.locationInfo) this.locationInfo.textContent = 'GPS location failed';
        }
    },

    getHighAccuracyGeolocation: function() {
        return new Promise(async (resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error('HTML5 Geolocation is not supported by your browser. Please use a modern browser with GPS capabilities.'));
            }

            // Check device capabilities
            const hasGPS = 'geolocation' in navigator;
            const isSecureContext = window.isSecureContext || location.protocol === 'https:';
            
            if (!isSecureContext) {
                console.warn('Geolocation requires HTTPS for optimal GPS accuracy');
            }

            // Optimized GPS settings for maximum accuracy
            const gpsOptions = {
                enableHighAccuracy: true,    // Force GPS usage over network location
                timeout: 30000,              // 30 seconds - allow time for GPS lock
                maximumAge: 0                // Always get fresh GPS reading
            };

            let positionAttempts = 0;
            const maxAttempts = 3;
            let bestPosition = null;
            let bestAccuracy = Infinity;

            const attemptGPSLocation = () => {
                positionAttempts++;
                
                if (this.locationInfo) {
                    this.locationInfo.textContent = `Getting GPS location... (attempt ${positionAttempts}/${maxAttempts})`;
                }

                console.log(`GPS attempt ${positionAttempts} - Using HTML5 Geolocation API with high accuracy`);

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const accuracy = position.coords.accuracy;
                        const hasGPSAccuracy = accuracy <= 50; // Likely GPS if accuracy ≤ 50m
                        
                        console.log(`GPS Position received:`, {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: accuracy,
                            altitude: position.coords.altitude,
                            altitudeAccuracy: position.coords.altitudeAccuracy,
                            heading: position.coords.heading,
                            speed: position.coords.speed,
                            timestamp: new Date(position.timestamp).toISOString(),
                            isLikelyGPS: hasGPSAccuracy
                        });

                        // Keep track of the most accurate position
                        if (accuracy < bestAccuracy) {
                            bestPosition = position;
                            bestAccuracy = accuracy;
                        }

                        // Accept immediately if we get excellent GPS accuracy
                        if (accuracy <= 10) {
                            console.log('Excellent GPS accuracy achieved:', accuracy + 'm');
                            const locationData = this.formatLocationData(position);
                            locationData.source = 'GPS';
                            resolve(locationData);
                            return;
                        }

                        // Accept good GPS accuracy (typical for outdoor GPS)
                        if (accuracy <= 20 && hasGPSAccuracy) {
                            console.log('Good GPS accuracy achieved:', accuracy + 'm');
                            const locationData = this.formatLocationData(position);
                            locationData.source = 'GPS';
                            resolve(locationData);
                            return;
                        }

                        // If we've tried multiple times, use the best we have
                        if (positionAttempts >= maxAttempts) {
                            if (bestPosition) {
                                console.log('Using best available position:', bestAccuracy + 'm');
                                const locationData = this.formatLocationData(bestPosition);
                                locationData.source = bestAccuracy <= 50 ? 'GPS' : 'Network/WiFi';
                                resolve(locationData);
                            } else {
                                reject(new Error('Could not achieve acceptable GPS accuracy after multiple attempts.'));
                            }
                            return;
                        }

                        // Try again for better accuracy
                        console.log(`GPS accuracy ${accuracy}m - trying again for better precision...`);
                        setTimeout(attemptGPSLocation, 2000); // Wait 2 seconds between attempts
                    },
                    (error) => {
                        console.error(`GPS attempt ${positionAttempts} failed:`, error);
                        
                        let errorMessage = "GPS location failed. ";
                        switch (error.code) {
                            case error.PERMISSION_DENIED:
                                errorMessage += "Please allow location access and ensure GPS is enabled on your device.";
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMessage += "GPS signal unavailable. Please move to an area with clearer sky view or near a window.";
                                break;
                            case error.TIMEOUT:
                                errorMessage += "GPS timeout. Please ensure GPS is enabled and try moving to an area with better signal.";
                                break;
                            default:
                                errorMessage += "An unknown GPS error occurred.";
                                break;
                        }

                        // Try again if we haven't exhausted attempts
                        if (positionAttempts < maxAttempts) {
                            console.log(`Retrying GPS in 3 seconds... (${maxAttempts - positionAttempts} attempts remaining)`);
                            setTimeout(attemptGPSLocation, 3000);
                            return;
                        }

                        // All GPS attempts failed - use best position if available
                        if (bestPosition) {
                            console.log('GPS failed, using best attempt position');
                            const locationData = this.formatLocationData(bestPosition);
                            locationData.source = 'Best GPS Attempt';
                            resolve(locationData);
                        } else {
                            reject(new Error(errorMessage + " No GPS location could be obtained."));
                        }
                    },
                    gpsOptions
                );
            };

            // Start GPS location attempts
            attemptGPSLocation();
        });
    },

    formatLocationData: function(position) {
        const locationString = `POINT(${position.coords.longitude} ${position.coords.latitude})`;
        const accuracy = Math.round(position.coords.accuracy || 999);
        
        // GPS metadata
        const gpsData = {
            locationString: locationString,
            accuracy: accuracy,
            timestamp: position.timestamp || Date.now(),
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            source: 'GPS' // Default, can be overridden
        };
        
        console.log('GPS Location formatted:', gpsData);
        return gpsData;
    },

    formatLocation: function(locationString, accuracy, source) {
        if (!locationString || typeof locationString !== 'string') return 'N/A';
        try {
            const match = locationString.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
            if (!match) return 'Invalid Format';
            const [longitude, latitude] = [match[1], match[2]];
            
            // Create detailed location info
            let accuracyText = '';
            if (accuracy) {
                accuracyText = ` (±${accuracy}m`;
                if (source) {
                    accuracyText += ` - ${source}`;
                }
                accuracyText += ')';
            }
            
            return `<a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank" title="View GPS location on map: ${latitude}, ${longitude}">GPS Map${accuracyText}</a>`;
        } catch (e) { 
            return 'Parse Error'; 
        }
    },

    renderTable: function(tableBody, data, isAdminView) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${isAdminView ? 7 : 6}">No records found.</td></tr>`;
            return;
        }
        data.forEach(record => {
            const row = document.createElement('tr');
            let rowContent = `
                <td>${new Date(record.check_in_time).toLocaleDateString()}</td>
                <td>${new Date(record.check_in_time).toLocaleTimeString()}</td>
                <td>${record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : '<em>Still clocked in</em>'}</td>
                <td>${this.formatLocation(record.check_in_location_text, record.check_in_accuracy)}</td>
                <td>${this.formatLocation(record.check_out_location_text, record.check_out_accuracy)}</td>
                <td>${record.check_in_accuracy ? `±${record.check_in_accuracy}m` : 'N/A'}</td>
            `;
            if (isAdminView) {
                rowContent = `<td>${record.employee_name || 'Unknown User'}</td>` + rowContent;
            }
            row.innerHTML = rowContent;
            tableBody.appendChild(row);
        });
    },

    populateUserFilter: async function() {
        try {
            const { data: users, error } = await client.from('users').select('id, full_name').order('full_name');
            if (error) throw error;
            const userFilter = document.getElementById('attendance-user-filter');
            users.forEach(user => userFilter.innerHTML += `<option value="${user.id}">${user.full_name}</option>`);
        } catch (error) { 
            app.showToast('Could not load user list.', 'error'); 
        }
    },

    loadWhosInNow: function() {
        document.getElementById('attendance-start-date').value = '';
        document.getElementById('attendance-end-date').value = '';
        this.loadAdminAttendance(true);
    },

    clearFilters: function() {
        document.getElementById('attendance-user-filter').value = '';
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('attendance-start-date').value = today;
        document.getElementById('attendance-end-date').value = today;
        this.loadAdminAttendance();
    }
};