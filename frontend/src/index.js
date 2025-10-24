import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Fix for case sensitivity: Ensure 'App' matches the filename 'app.jsx'
import App from './app'; 

// Find the root element defined in index.html
const rootElement = document.getElementById('root');

// Check if the root element exists before attempting to render
if (rootElement) {
    // Create a React root and render the App component
    // Note: BrowserRouter is included inside app.jsx;
    // Given the single-file jsx structure, this is the correct entry point.
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            {/* The BrowserRouter is now inside App, as required for the useAuth hook setup */}
            <App />
        </React.StrictMode>
    );
} else {
    // Log an error if the #root element is missing.
    console.error("Root element with ID 'root' not found in the HTML document.");
}
