import React, { useState } from 'react';
import ChefDashboard from './ChefDashboard'; 
import ChefLoginPage from './pages/ChefLoginPage'; 

export default function App() {
    // Check for existing token on initial load
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('chefToken'));

    // Function to handle successful login (passed to ChefLoginPage)
    const handleLoginSuccess = (token) => {
        localStorage.setItem('chefToken', token);
        setIsAuthenticated(true);
    };

    // Function to handle logout (passed to ChefDashboard)
    const handleLogout = () => {
        localStorage.removeItem('chefToken');
        setIsAuthenticated(false);
    };

    // --- Render Logic ---
    if (isAuthenticated) {
        // If authenticated, show the Dashboard
        return <ChefDashboard handleLogout={handleLogout} />;
    } else {
        // If not authenticated, show the Login Page, passing the success handler
        return <ChefLoginPage onLoginSuccess={handleLoginSuccess} />;
    }
}