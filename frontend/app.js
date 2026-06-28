const API_BASE = 'http://localhost:3000/api';
let map;
let employeeMarkers = {}; 
let mapPolylines = []; 

// UI Elements
const btnLive = document.getElementById('btn-live');
const btnReports = document.getElementById('btn-reports');
const liveSection = document.getElementById('employee-list-section');
const reportSection = document.getElementById('report-section');
const employeeListContainer = document.getElementById('employee-list');
const reportSelect = document.getElementById('report-employee');
const btnGenerateReport = document.getElementById('btn-generate-report');
const reportResults = document.getElementById('report-results');

const statActive = document.getElementById('stat-active');
const statPing = document.getElementById('stat-ping');

// Init application
function init() {
    initMap();
    setupEventListeners();
    fetchLatestLocations(); 
    
    // Poll for live updates every 5 seconds
    setInterval(fetchLatestLocations, 5000);
}

// Initialize Leaflet Map
function initMap() {
    // Patia, Bhubaneswar, Odisha
    map = L.map('map', {
        zoomControl: false 
    }).setView([20.3533, 85.8266], 14);
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Premium Dark Base Map (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
}

function setupEventListeners() {
    btnLive.addEventListener('click', () => {
        btnLive.classList.add('active');
        btnReports.classList.remove('active');
        liveSection.classList.add('active');
        reportSection.classList.remove('active');
        clearMapLines();
    });

    btnReports.addEventListener('click', () => {
        btnReports.classList.add('active');
        btnLive.classList.remove('active');
        reportSection.classList.add('active');
        liveSection.classList.remove('active');
        populateReportDropdown();
    });

    btnGenerateReport.addEventListener('click', generateReport);
}

// Create Advanced Pulsing Marker
const createAdvancedIcon = () => {
    return L.divIcon({
        className: 'custom-advanced-icon',
        html: `
            <div class="user-marker">
                <div class="marker-pulse"></div>
                <div class="marker-core"></div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
};

async function fetchLatestLocations() {
    try {
        const response = await fetch(`${API_BASE}/locations/latest`);
        const data = await response.json();
        
        renderEmployeeList(data);
        updateMapMarkers(data);
        updateStats(data);
    } catch (error) {
        console.error("Error fetching locations:", error);
    }
}

function updateStats(data) {
    statActive.innerText = data.length;
    statPing.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
}

function renderEmployeeList(employees) {
    if (employees.length === 0) {
        employeeListContainer.innerHTML = '<div class="loading-state">No operatives active</div>';
        return;
    }

    employeeListContainer.innerHTML = '';
    
    employees.forEach(emp => {
        const date = new Date(emp.timestamp);
        const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Extract Initials
        const initials = emp.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2);
        
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.innerHTML = `
            <div class="employee-header">
                <div class="avatar">${initials}</div>
                <div class="emp-info">
                    <h4>${emp.name}</h4>
                    <span class="id">${emp.employeeId}</span>
                </div>
            </div>
            <div class="employee-details">
                <div class="detail-row">
                    <i data-lucide="map-pin"></i> 
                    <span>${emp.lat.toFixed(4)}, ${emp.lng.toFixed(4)}</span>
                </div>
                <div class="detail-row">
                    <i data-lucide="clock"></i>
                    <span>Updated at ${timeString}</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            map.flyTo([emp.lat, emp.lng], 16, { duration: 1.5 });
        });
        
        employeeListContainer.appendChild(card);
    });
    lucide.createIcons();
}

function updateMapMarkers(employees) {
    const activeIds = new Set();
    
    employees.forEach(emp => {
        activeIds.add(emp.employeeId);
        const latLng = [emp.lat, emp.lng];
        const timeString = new Date(emp.timestamp).toLocaleTimeString();
        
        const popupContent = `
            <div style="text-align: center;">
                <h3 style="margin-bottom: 4px; font-weight: 600; font-size: 1.1rem;">${emp.name}</h3>
                <span style="font-size: 0.8rem; color: #94a3b8; font-family: monospace;">${emp.employeeId}</span>
                <div style="margin-top: 10px; font-size: 0.85rem; color: #10b981; font-weight: 500;">
                    <i data-lucide="radio" style="width:14px; height:14px; vertical-align: middle;"></i> Live
                </div>
            </div>
        `;

        if (employeeMarkers[emp.employeeId]) {
            employeeMarkers[emp.employeeId].setLatLng(latLng);
            employeeMarkers[emp.employeeId].getPopup().setContent(popupContent);
        } else {
            const marker = L.marker(latLng, { icon: createAdvancedIcon() }).addTo(map);
            marker.bindPopup(popupContent, { minWidth: 150 });
            employeeMarkers[emp.employeeId] = marker;
        }
    });

    for (let id in employeeMarkers) {
        if (!activeIds.has(id)) {
            map.removeLayer(employeeMarkers[id]);
            delete employeeMarkers[id];
        }
    }
    setTimeout(() => lucide.createIcons(), 100);
}

function populateReportDropdown() {
    reportSelect.innerHTML = '<option value="">-- Select Operative --</option>';
    for (let id in employeeMarkers) {
        // Parse name safely from popup
        const content = employeeMarkers[id].getPopup().getContent();
        const match = content.match(/<h3[^>]*>(.*?)<\/h3>/);
        const name = match ? match[1] : id;
        
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        reportSelect.appendChild(option);
    }
}

function clearMapLines() {
    mapPolylines.forEach(line => map.removeLayer(line));
    mapPolylines = [];
}

async function generateReport() {
    const employeeId = reportSelect.value;
    const date = document.getElementById('report-date').value;
    
    if (!employeeId) {
        alert("Please select an operative first");
        return;
    }

    const btnHtml = btnGenerateReport.innerHTML;
    btnGenerateReport.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Computing...';
    lucide.createIcons();

    try {
        let url = `${API_BASE}/reports/${employeeId}`;
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            url += `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
        }

        const response = await fetch(url);
        const historyData = await response.json();
        
        drawReportOnMap(historyData);
        displayReportStats(historyData);
    } catch (error) {
        console.error("Error generating report", error);
        reportResults.innerHTML = `<div style="color: var(--danger-color); padding: 16px; text-align: center;">Simulation Data Fetch Failed</div>`;
    } finally {
        btnGenerateReport.innerHTML = btnHtml;
        lucide.createIcons();
    }
}

function drawReportOnMap(historyData) {
    clearMapLines();
    if (historyData.length < 2) return;

    const latlngs = historyData.map(loc => [loc.lat, loc.lng]);
    
    const polyline = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
        className: 'route-line'
    }).addTo(map);
    
    mapPolylines.push(polyline);
    map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

    // Custom Start/End Dots
    const createDot = (color) => L.divIcon({
        className: 'route-dot',
        html: `<div style="width: 14px; height: 14px; background: ${color}; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [14, 14], iconAnchor: [7,7]
    });

    const startMarker = L.marker(latlngs[0], {icon: createDot('#10b981')}).addTo(map).bindPopup("<b>Route Start</b>");
    const endMarker = L.marker(latlngs[latlngs.length - 1], {icon: createDot('#ef4444')}).addTo(map).bindPopup("<b>Route End</b>");
    
    mapPolylines.push(startMarker, endMarker);
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
}

function displayReportStats(historyData) {
    if (historyData.length === 0) {
        reportResults.innerHTML = `
            <div class="report-card" style="text-align: center; color: var(--text-secondary);">
                <i data-lucide="ghost" style="width: 32px; height: 32px; margin-bottom: 12px; opacity: 0.5;"></i>
                <p>No telemetry data logged for this date.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let totalDistance = 0;
    for (let i = 1; i < historyData.length; i++) {
        totalDistance += getDistance(
            historyData[i-1].lat, historyData[i-1].lng,
            historyData[i].lat, historyData[i].lng
        );
    }

    const startTime = new Date(historyData[0].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const endTime = new Date(historyData[historyData.length - 1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    reportResults.innerHTML = `
        <div class="report-card">
            <h4 style="font-size: 1rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="bar-chart-2" style="color: var(--accent-color);"></i> Route Analytics
            </h4>
            <div class="stat-grid">
                <div class="stat-box">
                    <div class="val">${totalDistance.toFixed(2)}</div>
                    <div class="lbl">Kilometers</div>
                </div>
                <div class="stat-box">
                    <div class="val">${historyData.length}</div>
                    <div class="lbl">Data Points</div>
                </div>
            </div>
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary);">
                <span><i data-lucide="clock" style="width: 14px; height:14px; vertical-align:-2px;"></i> ${startTime}</span>
                <span><i data-lucide="flag" style="width: 14px; height:14px; vertical-align:-2px;"></i> ${endTime}</span>
            </div>
        </div>
    `;
    lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);
