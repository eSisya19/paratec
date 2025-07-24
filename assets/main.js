// main.js

// Define a single global 'app' instance variable. It will be created once the DOM is ready.
let app;

// This is the correct way to start the app.
// It ensures that the HTML is fully loaded before any JavaScript that interacts with it runs.
document.addEventListener('DOMContentLoaded', () => {
    // Create the new App instance and assign it to our global variable.
    app = new App();
    app.init();
});

class App {
    constructor() {
        this.currentUser = null;

        // The pages object maps a string (from the nav link) to the actual JS object
        this.pages = {
            'dashboard': window.dashboard,
            'reports': window.reports,
            'requests': window.requests,
            'users': window.users,
            'attendance': window.attendance,
            'trips': window.trips,
            'bulletins': window.bulletins,
            'assets': window.assets,
            'performance_reviews': window.performance_reviews,
            'servicedesk': window.servicedesk,
            'products': window.products,
            'works': window.works
            // Add other page modules here as you create them
        };

        // Initialize properties to null. They will be assigned in init().
        this.loginScreen = null;
        this.mainApp = null;
        this.appContent = null;
        this.navLinks = null;
        this.logoutBtn = null;
        this.loginForm = null;
    }

    init() {
        // --- DOM Element Querying ---
        // This is where we find our HTML elements and store them in the class.
        // This must happen after the DOM is loaded.
        this.loginScreen = document.getElementById('login-screen');
        this.mainApp = document.getElementById('main-app');
        this.appContent = document.getElementById('app-content');
        this.navLinks = document.getElementById('nav-links');
        this.logoutBtn = document.getElementById('logout-btn');
        this.loginForm = document.getElementById('login-form');
        

        // Check if all elements were found. If not, there's a typo in index.html.
        if (!this.loginScreen || !this.mainApp || !this.loginForm) {
            console.error("Critical Error: A required DOM element was not found. Check IDs in index.html.");
            return;
        }
        
        // --- Event Listeners ---
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            // We call the global auth object's login method
            window.auth.login(email, password);
        });

        this.logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.auth.logout();
        });

        this.navLinks.addEventListener('click', (e) => {
            // Use .closest('a') to handle clicks on icons inside the link
            const link = e.target.closest('a');
            if (link) {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) this.navigateTo(page);
            }
        });

        // --- Initial State Check ---
        this.checkLoginState();
    }

    checkLoginState() {
        const user = sessionStorage.getItem('currentUser');
        if (user) {
            this.currentUser = JSON.parse(user);
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        this.mainApp.classList.add('hidden');
        this.mainApp.classList.remove('visible');
        this.loginScreen.classList.add('visible');
        this.loginScreen.classList.remove('hidden');
    }

    showMainApp() {
        this.loginScreen.classList.add('hidden');
        this.loginScreen.classList.remove('visible');
        this.mainApp.classList.add('visible');
        this.mainApp.classList.remove('hidden');
        document.getElementById('current-user-name').textContent = app.currentUser.full_name;
        this.buildNav();
        this.navigateTo('dashboard'); // Default page after login
    }

    buildNav() {
        this.navLinks.innerHTML = '';
        let links = [
            { page: 'dashboard', text: 'Dashboard' , icon: 'fa-solid fa-chart-pie' },
            { page: 'reports', text: 'My Reports' , icon: 'fa-solid fa-file-lines' },
            { page: 'requests', text: 'My Requests', icon: 'fa-solid fa-inbox' },
            { page: 'attendance', text: 'Attendance' , icon: 'fa-solid fa-clock' },
            { page: 'trips', text: 'Trips', icon: 'fa-solid fa-plane-departure' },
            { page: 'bulletins', text: 'Notices', icon: 'fa-solid fa-bullhorn' },
            { page: 'assets', text: 'Manage Assets', icon: 'fa-solid fa-box-archive' },
            { page: 'performance_reviews', text: 'Reviews', icon: 'fa-solid fa-user-check' },
            { page: 'servicedesk', text: 'Service Desk', icon: 'fa-solid fa-headset' },
            { page: 'products', text: 'Product Mgmt', icon: 'fa-solid fa-microchip' },
            { page: 'works', text: 'Audit Logs', icon: 'fa-solid fa-clipboard-list' }
            
        ];

        if (this.currentUser.role === 'Admin') {
            links.push(
                { page: 'users', text: 'Manage Users' },
                // ... add other admin-only links here (e.g., assets, bulletins)
            );
        }
        
        links.forEach(link => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-page="${link.page}"><span>${link.text}</span></a>`;
            this.navLinks.appendChild(li);
        });
    }

    navigateTo(page) {
        if (this.pages[page] && typeof this.pages[page].init === 'function') {
            // Update active link in the navigation
            this.navLinks.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            const activeLink = this.navLinks.querySelector(`a[data-page="${page}"]`);
            if (activeLink) activeLink.classList.add('active');

            // Render page content by setting the innerHTML and then running its init function
            this.appContent.innerHTML = this.pages[page].html;
            this.pages[page].init();
        } else {
            this.appContent.innerHTML = `<h2>Error: Page module for "${page}" not found or is invalid.</h2>`;
            console.error(`Failed to navigate to page: "${page}". Check if window.${page} is defined and has an init method.`);
        }
    }

    // --- UTILITY FUNCTIONS ---
    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showModal(title, content, options = {}) {
        const { onSave, saveText = 'Save', closeText = 'Close' } = options;
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        let footerButtons = `<button id="modal-close-btn" class="btn btn-secondary">${closeText}</button>`;
        if (onSave) {
            footerButtons += `<button id="modal-save-btn" class="btn">${saveText}</button>`;
        }
        
        // We add a new '.modal-wrapper' div here
        modalContainer.innerHTML = `
            <div class="modal-wrapper"> 
                <div class="modal-content">
                    <button class="modal-close-icon">×</button>
                    <div class="modal-header"><h3>${title}</h3></div>
                    <div class="modal-body">${content}</div>
                    <div class="modal-footer">${footerButtons}</div>
                </div>
            </div>
        `;

        modalContainer.classList.remove('hidden');
        modalContainer.classList.add('visible');

        modalContainer.querySelector('.modal-close-icon').addEventListener('click', () => this.hideModal());
        modalContainer.querySelector('#modal-close-btn').addEventListener('click', () => this.hideModal());
        if (onSave) {
            modalContainer.querySelector('#modal-save-btn').addEventListener('click', onSave);
        }
    }

    hideModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            modalContainer.classList.add('hidden');
            modalContainer.classList.remove('visible');
            modalContainer.innerHTML = '';
        }
    }
}