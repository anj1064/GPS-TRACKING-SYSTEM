const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory data store for the mock implementation
// For production, a database like MongoDB or PostgreSQL would be used.
let employeeLocations = [];

const dataFile = path.join(__dirname, 'data.json');

// Load initial data if exists
if (fs.existsSync(dataFile)) {
    try {
        const rawData = fs.readFileSync(dataFile);
        employeeLocations = JSON.parse(rawData);
    } catch (err) {
        console.error("Error reading data.json", err);
    }
}

// Helper to save data to file
const saveData = () => {
    fs.writeFileSync(dataFile, JSON.stringify(employeeLocations, null, 2));
};

// IoT Endpoint: Receive GPS data from microcontroller
app.post('/api/location', (req, res) => {
    const { employeeId, name, lat, lng, timestamp } = req.body;
    
    if (!employeeId || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'Missing required fields: employeeId, lat, lng' });
    }

    const locationData = {
        employeeId,
        name: name || `Employee ${employeeId}`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        timestamp: timestamp || new Date().toISOString()
    };

    employeeLocations.push(locationData);
    saveData();
    
    console.log(`Received location for ${locationData.name}: ${lat}, ${lng}`);
    res.status(200).json({ success: true, message: 'Location updated' });
});

// Frontend Endpoint: Get latest location for all employees
app.get('/api/locations/latest', (req, res) => {
    const latestLocations = {};
    
    // Get the most recent location for each employee
    employeeLocations.forEach(loc => {
        if (!latestLocations[loc.employeeId] || new Date(loc.timestamp) > new Date(latestLocations[loc.employeeId].timestamp)) {
            latestLocations[loc.employeeId] = loc;
        }
    });

    res.json(Object.values(latestLocations));
});

// Frontend Endpoint: Get travel report (history) for an employee
app.get('/api/reports/:employeeId', (req, res) => {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query; // Optional filters

    let history = employeeLocations.filter(loc => loc.employeeId === employeeId);

    if (startDate) {
        history = history.filter(loc => new Date(loc.timestamp) >= new Date(startDate));
    }
    if (endDate) {
        history = history.filter(loc => new Date(loc.timestamp) <= new Date(endDate));
    }

    // Sort chronologically
    history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(history);
});

app.listen(PORT, () => {
    console.log(`GPS Tracking Backend running on http://localhost:${PORT}`);
});
