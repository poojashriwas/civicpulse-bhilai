// CivicPulse Bhilai Configuration
// NOTE: Replace these with your actual keys
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "civicpulse-bhilai.firebaseapp.com",
    projectId: "civicpulse-bhilai",
    storageBucket: "civicpulse-bhilai.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

const mapStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
    },
];

// Initialize Firebase
// firebase.initializeApp(firebaseConfig);
// const db = firebase.firestore();

// Map Variables
let map;
let infoWindow;
let geocoder;
let markers = [];
let complaintsData = []; // Store full complaint objects

let myChart; // Chart instance
let heatmap; // Heatmap layer
const bhilai = { lat: 21.1938, lng: 81.3509 };

function initMap() {
    console.log("Map Initialized");
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 13,
        center: bhilai,
        styles: mapStyle,
        disableDefaultUI: true, // Clean look
        zoomControl: true,
    });

    infoWindow = new google.maps.InfoWindow();
    geocoder = new google.maps.Geocoder();

    // Init Heatmap
    heatmap = new google.maps.visualization.HeatmapLayer({
        data: [],
        map: map,
        radius: 30
    });

    // Attempt to get user location on load
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                map.setCenter(pos);
                map.setZoom(15);

                // Add a "You are here" marker
                new google.maps.Marker({
                    position: pos,
                    map: map,
                    title: "Your Location",
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: "#4285F4",
                        fillOpacity: 1,
                        strokeColor: "white",
                        strokeWeight: 2,
                    },
                });
            },
            () => {
                handleLocationError(true, infoWindow, map.getCenter());
            }
        );
    } else {
        // Browser doesn't support Geolocation
        handleLocationError(false, infoWindow, map.getCenter());
    }
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
    console.warn(browserHasGeolocation ? "Error: The Geolocation service failed." : "Error: Your browser doesn't support geolocation.");
}

// Marker Logic
function addMarker(complaint) {
    const icons = {
        "Water Supply": { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" }, // Red
        "Power Cut": { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }, // Blue
        "Drain Overflow": { url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" } // Green
    };

    const marker = new google.maps.Marker({
        position: { lat: complaint.lat, lng: complaint.lng },
        map: map,
        title: complaint.type,
        icon: icons[complaint.type] ? icons[complaint.type].url : null,
        animation: google.maps.Animation.DROP
    });

    const contentString = `
        <div class="info-window-content" style="color: black; padding: 5px;">
            <h4 style="margin-bottom: 5px;">${complaint.type}</h4>
            <p><strong>Area:</strong> ${complaint.area}</p>
            <p><strong>Time:</strong> ${new Date(complaint.timestamp).toLocaleTimeString()}</p>
            <p>${complaint.description}</p>
        </div>
    `;

    const infowindow = new google.maps.InfoWindow({
        content: contentString,
    });

    marker.addListener("click", () => {
        infowindow.open({
            anchor: marker,
            map,
            shouldFocus: false,
        });
    });

    markers.push(marker);
    if (heatmap) {
        heatmap.getData().push(new google.maps.LatLng(complaint.lat, complaint.lng));
    }
}

// Geocoding Logic (Reverse Geocoding)
function detectLocationForForm() {
    const areaInput = document.getElementById('area-input');
    const detectBtn = document.getElementById('detect-loc-btn');

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    detectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    navigator.geolocation.getCurrentPosition((position) => {
        const latlng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        geocoder.geocode({ location: latlng })
            .then((response) => {
                if (response.results[0]) {
                    // Try to find a locality or sublocality
                    let areaName = response.results[0].formatted_address;
                    // Simplify: Get 2nd part of address (often area name) or just use full
                    // Improvements can be made to regex parsing
                    areaInput.value = areaName;

                    // Also center map there
                    map.setCenter(latlng);
                    map.setZoom(16);
                } else {
                    areaInput.value = "Location found (Exact address unknown)";
                }
                detectBtn.innerHTML = '<i class="fas fa-check"></i>';
            })
            .catch((e) => {
                console.error("Geocoder failed due to: " + e);
                areaInput.value = "Lat: " + latlng.lat.toFixed(4) + ", Lng: " + latlng.lng.toFixed(4);
                detectBtn.innerHTML = '<i class="fas fa-exclamation"></i>';
            });
    }, () => {
        alert("Unable to retrieve your location.");
        detectBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
    });
}


// AI Analysis & Logic
function detectIssueType(description) {
    const text = description.toLowerCase();
    if (text.includes('water') || text.includes('pipe') || text.includes('leak') || text.includes('supply')) {
        return 'Water Supply';
    } else if (text.includes('power') || text.includes('light') || text.includes('electricity') || text.includes('current') || text.includes('cut')) {
        return 'Power Cut';
    } else if (text.includes('drain') || text.includes('sewage') || text.includes('overflow') || text.includes('gutter') || text.includes('clog')) {
        return 'Drain Overflow';
    }
    return null; // Could not auto-detect
}

function checkForRepeatedIssues(newComplaint) {
    // Simple client-side clustering for demo
    const REPEAT_THRESHOLD_METERS = 1000; // 1km radius
    const COUNT_THRESHOLD = 3; // More than 3 reports triggers alert

    let similarCount = 0;

    complaintsData.forEach(c => {
        if (c.type === newComplaint.type && c.area === newComplaint.area) { // Simplified "Same Area" check
            similarCount++;
        }
    });

    if (similarCount >= COUNT_THRESHOLD) {
        showAlert(newComplaint.type, newComplaint.area, similarCount);
    }
}

function showAlert(type, area, count) {
    const banner = document.getElementById('alert-banner');
    document.getElementById('alert-title').innerText = `High Alert: ${type}`;
    document.getElementById('alert-message').innerText = `Repeated issue detected in ${area} (${count} reports recently).`;

    banner.classList.remove('hidden');

    // Auto-hide after 10 seconds
    setTimeout(() => {
        banner.classList.add('hidden');
    }, 10000);
}

// Form Handling
function handleFormSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Submitting...';
    btn.disabled = true;

    // 1. Get Values
    const typeInput = document.querySelector('input[name="type"]:checked');
    const areaInput = document.getElementById('area-input');
    const descInput = document.getElementById('desc-input');

    // 2. AI Analysis (Auto-correct type if user didn't explicitly change it, or just tag it)
    let issueType = typeInput.value;
    const detectedType = detectIssueType(descInput.value);

    if (detectedType && detectedType !== issueType) {
        // In a real app, we might ask user "Did you mean...?"
        // For now, we'll just log it or trust the user's selection
        console.log(`AI detected ${detectedType} but user selected ${issueType}`);
    }

    const complaint = {
        type: issueType,
        area: areaInput.value || "Unknown Location",
        description: descInput.value,
        lat: map.getCenter().lat(), // Assumes map is centered on location
        lng: map.getCenter().lng(),
        timestamp: new Date().toISOString()
    };

    // 3. Save to Firebase (or simulate)
    saveComplaint(complaint).then(() => {
        // 4. UI Updates
        addMarker(complaint);
        complaintsData.push(complaint);
        checkForRepeatedIssues(complaint);
        updateDashboard(complaint);
        updateChart(complaint); // added chart update call

        // Reset Form
        e.target.reset();
        document.getElementById('report-modal').classList.add('hidden');

        btn.innerHTML = originalText;
        btn.disabled = false;

        alert("Complaint Submitted Successfully!");
    }).catch(err => {
        console.error(err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert("Error submitting complaint. Check console.");
    });
}

function saveComplaint(complaint) {
    return new Promise((resolve, reject) => {
        // check if firebase is loaded and configured
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            const db = firebase.firestore();
            db.collection('complaints').add(complaint)
                .then(docRef => {
                    console.log("Document written with ID: ", docRef.id);
                    resolve();
                })
                .catch(error => {
                    console.error("Error adding document: ", error);
                    reject(error);
                });
        } else {
            console.warn("Firebase not connected. Simulating success.");
            // Simulate network delay
            setTimeout(resolve, 800);
        }
    });
}

function updateDashboard(complaint) {
    // Increment Total
    const totalEl = document.getElementById('total-reports');
    if (totalEl) totalEl.innerText = parseInt(totalEl.innerText) + 1;

    // Add to Recent Activity
    const list = document.getElementById('activity-feed');
    const item = document.createElement('li');
    item.style.padding = "10px";
    item.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
    item.innerHTML = `<strong>${complaint.type}</strong> in ${complaint.area} <br> <span style="font-size:0.8rem; opacity:0.7">${new Date().toLocaleTimeString()}</span>`;
    list.prepend(item);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const reportBtn = document.getElementById('report-btn');
    const reportModal = document.getElementById('report-modal');
    const closeModal = document.querySelector('.close-modal');
    const dashboardBtn = document.getElementById('toggle-dashboard');
    const dashboardOverlay = document.getElementById('dashboard-overlay');
    const closeDashboard = document.getElementById('close-dashboard');
    const detectLocBtn = document.getElementById('detect-loc-btn');
    const complaintForm = document.getElementById('complaint-form');
    const closeAlert = document.getElementById('close-alert');

    // Button Listeners
    if (reportBtn) reportBtn.addEventListener('click', () => reportModal.classList.remove('hidden'));
    if (closeModal) closeModal.addEventListener('click', () => reportModal.classList.add('hidden'));
    if (dashboardBtn) dashboardBtn.addEventListener('click', () => dashboardOverlay.classList.remove('hidden'));
    if (closeDashboard) closeDashboard.addEventListener('click', () => dashboardOverlay.classList.add('hidden'));
    if (closeAlert) closeAlert.addEventListener('click', () => document.getElementById('alert-banner').classList.add('hidden'));

    // Logic Listeners
    if (detectLocBtn) detectLocBtn.addEventListener('click', detectLocationForForm);
    if (complaintForm) complaintForm.addEventListener('submit', handleFormSubmit);

    // AI Badge Logic: Show badge if description matches a type
    const descInput = document.getElementById('desc-input');
    const aiBadge = document.getElementById('ai-badge');
    if (descInput && aiBadge) {
        descInput.addEventListener('input', (e) => {
            const detected = detectIssueType(e.target.value);
            if (detected) {
                aiBadge.classList.remove('hidden');
                // Auto-select the radio button
                const radios = document.getElementsByName('type');
                for (let r of radios) {
                    if (r.value === detected) r.checked = true;
                }
            } else {
                aiBadge.classList.add('hidden');
            }
        });
    }

    // Chart & Demo
    setupChart();
    const demoBtn = document.getElementById('load-demo-btn');
    if (demoBtn) demoBtn.addEventListener('click', loadDemoData);
});

// Chart & Demo Data Logic
function setupChart() {
    const ctx = document.getElementById('complaintsChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Water Supply', 'Power Cut', 'Drain Overflow'],
            datasets: [{
                label: '# of Reports',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)', // Red
                    'rgba(54, 162, 235, 0.7)', // Blue
                    'rgba(75, 192, 192, 0.7)'  // Green
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'white' } },
                x: { grid: { display: false }, ticks: { color: 'white' } }
            },
            plugins: {
                legend: { labels: { color: 'white' } }
            }
        }
    });
}

function updateChart(complaint) {
    if (!myChart) return;

    // 0: Water, 1: Power, 2: Drain
    let index = -1;
    if (complaint.type === 'Water Supply') index = 0;
    if (complaint.type === 'Power Cut') index = 1;
    if (complaint.type === 'Drain Overflow') index = 2;

    if (index !== -1) {
        myChart.data.datasets[0].data[index]++;
        myChart.update();

        // Use this to update "Top Issue" in stats
        const data = myChart.data.datasets[0].data;
        const max = Math.max(...data);
        const maxIndex = data.indexOf(max);
        const labels = ['Water Supply', 'Power Cut', 'Drain Overflow'];
        const topIssueEl = document.getElementById('top-issue');
        if (topIssueEl) topIssueEl.innerText = labels[maxIndex];
    }
}

function loadDemoData() {
    const demoComplaints = [
        { type: "Water Supply", area: "Supela", description: "No water since 2 days", offset: { lat: 0.001, lng: 0.001 } },
        { type: "Water Supply", area: "Supela", description: "Dirty water coming", offset: { lat: 0.0012, lng: 0.0008 } },
        { type: "Water Supply", area: "Supela", description: "Low pressure", offset: { lat: 0.0008, lng: 0.0012 } },
        { type: "Power Cut", area: "Nehru Nagar", description: "Transformer sparked", offset: { lat: -0.002, lng: -0.002 } },
        { type: "Drain Overflow", area: "Sector 6", description: "Smelling bad", offset: { lat: 0.003, lng: -0.001 } }
    ];

    const baseLat = 21.1938;
    const baseLng = 81.3509;

    demoComplaints.forEach((c, i) => {
        setTimeout(() => {
            const complaint = {
                type: c.type,
                area: c.area,
                description: c.description,
                lat: baseLat + c.offset.lat,
                lng: baseLng + c.offset.lng,
                timestamp: new Date().toISOString()
            };

            saveComplaint(complaint).then(() => {
                addMarker(complaint);
                complaintsData.push(complaint);
                checkForRepeatedIssues(complaint);
                updateDashboard(complaint);
                updateChart(complaint);
            });

        }, i * 300);
    });

    alert("Loading 5 demo complaints...");
}
