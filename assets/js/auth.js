// js/auth.js

window.auth = {
    /**
     * Handles the user login process.
     * 1. Signs in the user using Supabase Auth.
     * 2. If successful, fetches the user's profile (role, full name) from the public 'users' table.
     * 3. Stores the combined user info in the session and updates the app state.
     * @param {string} email - The user's email.
     * @param {string} password - The user's password.
     */
    async login(email, password) {
        try {
            // Use the 'client' variable from config.js to call Supabase Auth
            const { data, error } = await client.auth.signInWithPassword({
                email: email,
                password: password,
            });

            // If Supabase Auth returns an error (e.g., wrong password), throw it
            if (error) throw error;

            // If login is successful, fetch the user's profile from our 'users' table
            // This is how we get custom data like the user's role
            const { data: userProfile, error: profileError } = await client
                .from('users')
                .select('role, full_name, id') // Select the columns we need
                .eq('id', data.user.id)       // Match the user ID from the successful login
                .single();                    // We expect only one profile per user

            // If there's an error fetching the profile (e.g., profile doesn't exist), throw it
            if (profileError) {
                // Log out the user to prevent a partial login state
                await client.auth.signOut();
                throw new Error("Login successful, but profile not found. Please contact an admin.");
            }
            
            // Combine the secure auth user data with our public profile data
            const currentUser = { ...data.user, ...userProfile };
            
            // Store the user's info in the browser's session storage for persistence
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Update the main app's state
            app.currentUser = currentUser;
            
            // Transition from the login screen to the main application
            app.showMainApp();
            app.showToast('Login successful!');

        } catch (error) {
            // Log the detailed error to the console for debugging
            console.error('Login Error:', error);
            // Show a user-friendly error message
            app.showToast(error.message, 'error');
        }
    },

    /**
     * Handles the user logout process.
     * 1. Signs the user out of Supabase Auth, invalidating their session.
     * 2. Clears the user data from session storage.
     * 3. Resets the app state to the login screen.
     */
    async logout() {
        try {
            // Use the 'client' variable to sign the user out
            await client.auth.signOut();
            
            // Clear the session storage
            sessionStorage.removeItem('currentUser');
            
            // Reset the main app's state
            app.currentUser = null;
            
            // Show the login screen
            app.showLoginScreen();
            app.showToast('You have been logged out.');

        } catch (error) {
            console.error('Logout Error:', error);
            app.showToast(error.message, 'error');
        }
    }
};