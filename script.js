import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";


// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAgBUaMIawsOqMbLpju2mrd6kMaranT2rI",
  authDomain: "sgresolve-login-register.firebaseapp.com",
  projectId: "sgresolve-login-register",
  storageBucket: "sgresolve-login-register.firebasestorage.app",
  messagingSenderId: "564104431729",
  appId: "1:564104431729:web:57557b54673a8c18d973d0",
  measurementId: "G-R3QDN8V84C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
document.addEventListener('DOMContentLoaded', () => {
    // Singapore's Geographical Boundaries
    const SINGAPORE_BOUNDS = {
        latMin: 1.15,
        latMax: 1.47,
        lonMin: 103.6,
        lonMax: 104.0
    };
    const singaporeLatLngBounds = L.latLngBounds(
        [SINGAPORE_BOUNDS.latMin, SINGAPORE_BOUNDS.lonMin],
        [SINGAPORE_BOUNDS.latMax, SINGAPORE_BOUNDS.lonMax]
    );

    // Initialize Maps
    let reportingMap = L.map('map').setView([1.3521, 103.8198], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(reportingMap);

    let adminMap = L.map('admin-map').setView([1.3521, 103.8198], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(adminMap);

    // Global Variables
    let tempMarker;
    let reportMarkers = [];
    let imageDataUrl = null;
    let currentUser = null;
    let forumPosts = [];
    let forumPostIdCounter = 1;

    // Page Elements
    const pages = {
        landing: document.getElementById('landing-page'),
        login: document.getElementById('login-page'),
        register: document.getElementById('register-page'),
        admin: document.getElementById('admin-page'),
        reporting: document.getElementById('reporting-page'),
        myReports: document.getElementById('my-reports-page'),
        community: document.getElementById('community-forum-page'),
        about: document.getElementById('about-page'),

    };
    const navbar = document.getElementById('navbar');

    // Auth State Listener
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateNavbar();
        
        if (user) {
            if (user.email === 'admin@sgresolve.com') {
                console.log('Admin detected, rendering reports');
                renderAdminReports();
                showPage(pages.admin);
            } else {
                showPage(pages.reporting);
            }
        } else {
            showPage(pages.landing);
        }
    });

    // Helper Functions
    function hideAllPages() {
        Object.values(pages).forEach(page => {
            page.style.display = 'none';
            page.classList.remove('show');
        });
    }

    function showPage(page) {
        hideAllPages();
        page.classList.add('show');
        page.style.display = 'block';
        if (page === pages.reporting) reportingMap.invalidateSize();
        else if (page === pages.admin) {
            adminMap.invalidateSize();
            renderAdminReports();  // No arguments needed
        }
    }
    function updateNavbar() {
        navbar.style.display = currentUser ? 'block' : 'none';
    }

    function createStatusDropdown(currentStatus, reportId) {
        return `
            <select class="status-update" data-report-id="${reportId}">
                <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${currentStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Resolved" ${currentStatus === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>
            <button class="update-status-btn">Update Status</button>
        `;
    }

    // Rendering Functions
    function deleteReport(reportId) {
        if (confirm('Are you sure you want to delete this report?')) {
            const index = reports.findIndex(report => report.id === reportId);
            if (index !== -1) {
                reports.splice(index, 1);
                const filteredReports = getFilteredReports();
                renderAdminReports(filteredReports);
            }
        }
    }

    //delete functions
    document.getElementById('admin-reports-container').addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-report-btn')) {
            const reportId = e.target.getAttribute('data-report-id');
            if (confirm('Are you sure you want to delete this report?')) {
                try {
                    await deleteDoc(doc(db, "reports", reportId));
                    await renderAdminReports();
                } catch (error) {
                    console.error('Error deleting report:', error);
                    alert('Failed to delete report. Please try again.');
                }
            }
        }
    });

    function renderAdminReports(filteredReports) {
        const adminReportsContainer = document.getElementById('admin-reports-container');
        adminReportsContainer.innerHTML = '';
        filteredReports.forEach(report => {
            const li = document.createElement('li');
            li.setAttribute('data-report-id', report.id);
            li.innerHTML = `
                <p><strong>Location:</strong> ${report.locationName}</p>
                <p><strong>Category:</strong> ${report.category}</p>
                <p><strong>Description:</strong> ${report.description}</p>
                <p><strong>Urgency:</strong> ${report.urgency}</p>
                <p><strong>Threat:</strong> ${report.threat}</p>
                <p><strong>Status:</strong> <span class="report-status">${report.status}</span></p>
                ${report.imageDataUrl ? `<img src="${report.imageDataUrl}" alt="Report Image">` : ''}
                ${createStatusDropdown(report.status)}
                <button class="button danger-button delete-report-btn" data-report-id="${report.id}">Delete</button>
            `;
            adminReportsContainer.appendChild(li);
        });
        renderAdminMap(filteredReports);
    }

    function applyFilters(reports) {
        const imageFilter = document.getElementById('image-filter').value;
        const categoryFilter = document.getElementById('category-filter').value;
        const urgencyFilter = document.getElementById('urgency-filter').value;
        const threatFilter = document.getElementById('threat-filter').value;
    
        let filteredReports = reports.slice();
    
        if (imageFilter !== 'all') {
            filteredReports = filteredReports.filter(report => 
                imageFilter === 'with' ? report.imageUrl : !report.imageUrl
            );
        }
    
        if (categoryFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.category === categoryFilter);
        }
    
        if (urgencyFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.urgency === urgencyFilter);
        }
    
        if (threatFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.threat === threatFilter);
        }
    
        return filteredReports;
    }

    function renderAdminMap(reports) {
        // Clear existing markers from the adminMap
        reportMarkers.forEach(marker => adminMap.removeLayer(marker));
        reportMarkers = []; // Reset the global reportMarkers array
    
        // Add new markers for each report
        reports.forEach(report => {
            const marker = L.marker([report.latitude, report.longitude]).addTo(adminMap);
            marker.bindPopup(`
                <strong>Location:</strong> ${report.locationName}<br>
                <strong>Category:</strong> ${report.category}<br>
                <strong>Description:</strong> ${report.description}<br>
                <strong>Urgency:</strong> ${report.urgency}<br>
                <strong>Threat:</strong> ${report.threat}<br>
                <strong>Status:</strong> ${report.status}
            `);
            reportMarkers.push(marker); // Store the marker in the global array
        });
    }
    
    async function renderAdminReports() {
        const adminReportsContainer = document.getElementById('admin-reports-container');
        adminReportsContainer.innerHTML = '<p>Loading reports...</p>';
        
        try {
            const allReports = await fetchReports();
            const filteredReports = applyFilters(allReports);
            adminReportsContainer.innerHTML = '';
            if (filteredReports.length === 0) {
                adminReportsContainer.innerHTML = '<p>No reports found.</p>';
                return;
            }
            filteredReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                li.innerHTML = `
                    <p><strong>Location:</strong> ${report.locationName}</p>
                    <p><strong>Category:</strong> ${report.category}</p>
                    <p><strong>Description:</strong> ${report.description}</p>
                    <p><strong>Urgency:</strong> ${report.urgency}</p>
                    <p><strong>Threat:</strong> ${report.threat}</p>
                    <p><strong>Status:</strong> <span class="report-status">${report.status}</span></p>
                    ${report.imageUrl ? `<img src="${report.imageUrl}" alt="Report Image">` : ''}
                    ${createStatusDropdown(report.status)}
                    <button class="button danger-button delete-report-btn" data-report-id="${report.id}">Delete</button>
                `;
                adminReportsContainer.appendChild(li);
            });
            renderAdminMap(filteredReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
            adminReportsContainer.innerHTML = '<p>Error loading reports. Please try again later.</p>';
        }
    }

    async function renderUserReports() {
        if (!currentUser) return;
        const userReportsContainer = document.getElementById('user-reports-container');
        userReportsContainer.innerHTML = '<p>Loading reports...</p>';
    
        try {
            const userReports = await fetchReports(currentUser.uid);
            userReportsContainer.innerHTML = '';
            if (userReports.length === 0) {
                userReportsContainer.innerHTML = 'No reports submitted yet.';
                return;
            }
            userReports.forEach(report => {
                const li = document.createElement('li');
                li.setAttribute('data-report-id', report.id);
                li.innerHTML = `
                    <p><strong>Location:</strong> ${report.locationName}</p>
                    <p><strong>Category:</strong> ${report.category}</p>
                    <p><strong>Description:</strong> ${report.description}</p>
                    <p><strong>Urgency:</strong> ${report.urgency}</p>
                    <p><strong>Threat:</strong> ${report.threat}</p>
                    <p><strong>Status:</strong> ${report.status}</p>
                    ${report.imageUrl ? `<img src="${report.imageUrl}" alt="Report Image">` : ''}
                `;
                userReportsContainer.appendChild(li);
            });
        } catch (error) {
            userReportsContainer.innerHTML = '<p>Error loading reports. Please try again later.</p>';
        }
    }
    function renderForumPosts() {
        const forumPostsContainer = document.getElementById('forum-posts');
        forumPostsContainer.innerHTML = forumPosts.length === 0 ? 'No posts yet. Be the first to post!' : '';
        forumPosts.forEach(post => {
            const postDiv = document.createElement('div');
            postDiv.classList.add('forum-post');
            postDiv.setAttribute('data-post-id', post.id);
            postDiv.innerHTML = `
                <h3>${post.title}</h3>
                <p>${post.content}</p>
                <p>Posted by ${post.author} on ${post.date}</p>
            `;
            forumPostsContainer.appendChild(postDiv);
        });
    }

    // Filter Function
    function getFilteredReports() {
        const imageFilter = document.getElementById('image-filter').value;
        const categoryFilter = document.getElementById('category-filter').value;
        const urgencyFilter = document.getElementById('urgency-filter').value;
        const threatFilter = document.getElementById('threat-filter').value;
        
        let filteredReports = reports.slice();
        
        if (imageFilter !== 'all') {
            filteredReports = filteredReports.filter(report => {
                return imageFilter === 'with' ? report.imageDataUrl : !report.imageDataUrl;
            });
        }
        
        if (categoryFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.category === categoryFilter);
        }
        
        if (urgencyFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.urgency === urgencyFilter);
        }
        
        if (threatFilter !== 'all') {
            filteredReports = filteredReports.filter(report => report.threat === threatFilter);
        }
        
        return filteredReports;
    }

    // Event Listeners
    document.getElementById('nav-home').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            currentUser.email === 'admin@sgresolve.com' ? showPage(pages.admin) : showPage(pages.reporting);
        } else {
            showPage(pages.landing);
        }
    });

    document.getElementById('nav-my-reports').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            renderUserReports();
            showPage(pages.myReports);
        }
    });

    document.getElementById('nav-community').addEventListener('click', (e) => {
        e.preventDefault();
        renderForumPosts();
        showPage(pages.community);
    });

    document.getElementById('nav-about').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.about);
    });


    document.getElementById('hero-report-issue').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.login);
    });

    document.getElementById('hero-learn-more').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.about);
    });

    document.getElementById('cta-register').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.register);
    });

    document.getElementById('cta-login').addEventListener('click', (e) => {
        e.preventDefault();
        showPage(pages.login);
    });

    // Login Form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                let message = 'Login failed. ';
                switch (error.code) {
                    case 'auth/invalid-email':
                        message += 'Invalid email format';
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        message += 'Invalid email or password';
                        break;
                    default:
                        message += error.message;
                }
                errorDiv.textContent = message;
            });
    });

    // Registration Form
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value.trim();
        const errorDiv = document.getElementById('register-error');
        
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                return updateProfile(userCredential.user, {
                    displayName: name
                });
            })
            .catch((error) => {
                let message = 'Registration failed. ';
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        message += 'Email already registered';
                        break;
                    case 'auth/invalid-email':
                        message += 'Invalid email format';
                        break;
                    case 'auth/weak-password':
                        message += 'Password should be at least 6 characters';
                        break;
                    default:
                        message += error.message;
                }
                errorDiv.textContent = message;
            });
    });

    document.getElementById('go-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-error').textContent = '';
        showPage(pages.register);
    });

    document.getElementById('go-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-error').textContent = '';
        showPage(pages.login);
    });

    // Logout
    document.getElementById('nav-logout').addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth);
    });

    document.getElementById('logout-admin').addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth);
    });

    // Map and Reporting Functionality
    reportingMap.on('click', function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        if (lat < SINGAPORE_BOUNDS.latMin || lat > SINGAPORE_BOUNDS.latMax ||
            lon < SINGAPORE_BOUNDS.lonMin || lon > SINGAPORE_BOUNDS.lonMax) {
            alert('Please select a location within Singapore.');
            return;
        }
        if (tempMarker) reportingMap.removeLayer(tempMarker);
        tempMarker = L.marker([lat, lon]).addTo(reportingMap);
        document.getElementById('latitude').value = lat.toFixed(4);
        document.getElementById('longitude').value = lon.toFixed(4);
    });

    document.getElementById('detectLocation').addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                if (lat < SINGAPORE_BOUNDS.latMin || lat > SINGAPORE_BOUNDS.latMax ||
                    lon < SINGAPORE_BOUNDS.lonMin || lon > SINGAPORE_BOUNDS.lonMax) {
                    alert('Your current location is not within Singapore.');
                    return;
                }
                if (tempMarker) reportingMap.removeLayer(tempMarker);
                tempMarker = L.marker([lat, lon]).addTo(reportingMap);
                document.getElementById('latitude').value = lat.toFixed(4);
                document.getElementById('longitude').value = lon.toFixed(4);
                reportingMap.setView([lat, lon], 14);
            }, function(error) {
                alert('Error retrieving location: ' + error.message);
            });
        } else alert('Geolocation is not supported by your browser.');
    });

    // Image Upload Preview
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    imageUpload.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imageDataUrl = e.target.result;
                imagePreview.innerHTML = `<img src="${imageDataUrl}" alt="Image Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
            imageDataUrl = null;
            imagePreview.innerHTML = '';
        }
    });

    // Auto Detect Feature
    const autoDetectButton = document.getElementById('autoDetect');
    const problemDesc = document.getElementById('problemDesc');
    const categorySelect = document.getElementById('category');
    const urgencySelect = document.getElementById('urgency');
    const threatSelect = document.getElementById('threat');
    const reportError = document.getElementById('report-error');

    problemDesc.addEventListener('input', () => {
        autoDetectButton.disabled = !problemDesc.value.trim();
    });

    autoDetectButton.addEventListener('click', async () => {
        const description = problemDesc.value.trim();
        if (!description) {
            reportError.textContent = 'Please enter a description before using auto detect.';
            return;
        }

        reportError.textContent = '';
        autoDetectButton.disabled = true;
        autoDetectButton.textContent = 'Detecting...';


    try {
        console.log('Sending request with:', description);
        const response = await fetch('https://auto-detect-model-production.up.railway.app/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: description })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        categorySelect.value = data.category;
        urgencySelect.value = data.urgency;
        threatSelect.value = data.threat;
    } catch (error) {
        console.error('Error:', error);
        reportError.textContent = 'Failed to auto detect. Please try again.';
    } finally {
        autoDetectButton.disabled = false;
        autoDetectButton.textContent = 'Auto Detect';
    }
});

// Report Submission
document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const locationName = document.getElementById('locationName').value.trim();
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    const description = document.getElementById('problemDesc').value.trim();
    const category = document.getElementById('category').value;
    const urgency = document.getElementById('urgency').value;
    const threat = document.getElementById('threat').value;
    const errorDiv = document.getElementById('report-error');
    errorDiv.textContent = '';

    // Validation
    if (!locationName || isNaN(latitude) || isNaN(longitude) || !description || !category || !urgency || !threat) {
        errorDiv.textContent = 'Please fill in all required fields.';
        return;
    }

    if (latitude < SINGAPORE_BOUNDS.latMin || latitude > SINGAPORE_BOUNDS.latMax ||
        longitude < SINGAPORE_BOUNDS.lonMin || longitude > SINGAPORE_BOUNDS.lonMax) {
        errorDiv.textContent = 'The selected location is not within Singapore.';
        return;
    }

    // Handle image upload to ImgBB
    let imageUrl = null;
    if (imageDataUrl) {
        try {
            const formData = new FormData();
            formData.append('image', imageDataUrl.split(',')[1]); // Extract base64 data
            formData.append('key', '8c3ac5bab399ca801e354b900052510d');

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!data.success) throw new Error('ImgBB upload failed');
            imageUrl = data.data.url;
        } catch (error) {
            console.error('Error uploading image:', error);
            errorDiv.textContent = 'Error uploading image. Please try again.';
            return;
        }
    }
    // Create report object
    const report = {
        userId: currentUser.uid,
        locationName,
        latitude,
        longitude,
        description,
        category,
        urgency,
        threat,
        imageUrl, // Store the download URL instead of imageDataUrl
        status: 'Pending',
        timestamp: new Date() // Add timestamp for sorting
    };

    // Save to Firestore
    try {
        const docRef = await addDoc(collection(db, "reports"), report);
        console.log('Report added with ID:', docRef.id);

        // Reset form
        document.getElementById('report-form').reset();
        imageDataUrl = null;
        imagePreview.innerHTML = '';
        if (tempMarker) {
            reportingMap.removeLayer(tempMarker);
            tempMarker = null;
        }

        alert('Report submitted successfully!');
        await renderUserReports();
        if (currentUser.email === 'admin@sgresolve.com') {
            await renderAdminReports();
        }
    } catch (error) {
        console.error('Error adding report:', error);
        errorDiv.textContent = 'Error submitting report. Please try again.';
    }
});

//Fetch Reports
async function fetchReports(userId = null) {
    try {
        let q;
        if (userId) {
            q = query(collection(db, "reports"), where("userId", "==", userId));
        } else {
            q = collection(db, "reports");
        }
        const querySnapshot = await getDocs(q);
        const reports = [];
        querySnapshot.forEach((doc) => {
            reports.push({ id: doc.id, ...doc.data() });
        });
        return reports;
    } catch (error) {
        console.error('Error fetching reports:', error);
        throw error;
    }
}

// Admin Status Updates


document.getElementById('admin-reports-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('update-status-btn')) {
        const li = e.target.closest('li');
        const reportId = li.getAttribute('data-report-id');
        const select = li.querySelector('.status-update');
        const newStatus = select.value;
        try {
            await updateDoc(doc(db, "reports", reportId), { status: newStatus });
            await renderAdminReports();
            if (currentUser && currentUser.email !== 'admin@sgresolve.com') await renderUserReports();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status. Please try again.');
        }
    }
});

document.getElementById('refresh-reports').addEventListener('click', (e) => {
    e.preventDefault();
    renderAdminReports();
});
// Forum Post Submission
document.getElementById('forum-post-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    if (!title || !content) {
        alert('Please provide both a title and content for your post.');
        return;
    }
    const post = {
        id: forumPostIdCounter++,
        title,
        content,
        author: currentUser.displayName || 'Anonymous',
        date: new Date().toLocaleDateString()
    };
    forumPosts.push(post);
    document.getElementById('forum-post-form').reset();
    renderForumPosts();
});

// Export Reports as CSV
async function exportReports() {
    try {
        const allReports = await fetchReports();
        const csvRows = [];
        const headers = ['ID', 'User ID', 'Location Name', 'Latitude', 'Longitude', 'Description', 'Category', 'Urgency', 'Threat', 'Image URL', 'Status', 'Timestamp'];
        csvRows.push(headers.join(','));
        allReports.forEach(report => {
            const row = [
                report.id,
                report.userId,
                report.locationName,
                report.latitude,
                report.longitude,
                `"${report.description.replace(/"/g, '""')}"`,
                report.category,
                report.urgency,
                report.threat,
                report.imageUrl || '',
                report.status,
                report.timestamp.toDate().toISOString()
            ];
            csvRows.push(row.join(','));
        });
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sgresolve-reports.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error exporting reports:', error);
        alert('Failed to export reports. Please try again.');
    }
}

document.getElementById('export-data').addEventListener('click', (e) => {
    e.preventDefault();
    exportReports();
});

document.getElementById('export-data').addEventListener('click', (e) => {
    e.preventDefault();
    exportReports();
});

// Filter Controls
document.getElementById('apply-filters').addEventListener('click', (e) => {
    e.preventDefault();
    const filteredReports = getFilteredReports();
    renderAdminReports(filteredReports);
});

document.getElementById('reset-filters').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('image-filter').value = 'all';
    document.getElementById('category-filter').value = 'all';
    document.getElementById('urgency-filter').value = 'all';
    document.getElementById('threat-filter').value = 'all';
    renderAdminReports(reports);
});

// Initialize the App
updateNavbar();
hideAllPages();
showPage(pages.landing);
});

// Chatbot Functions
function toggleChat() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.classList.toggle('active');
}

// Add this line to attach the event listener
document.getElementById('chat-icon').addEventListener('click', toggleChat);

async function sendMessage() {
    const userInput = document.getElementById("user-input").value;
    if (!userInput) return;
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<div class="message user"><strong>You:</strong> ${userInput}</div>`;
    const response = await fetch("https://chatbot-server-production-da96.up.railway.app/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput })
    });
    const data = await response.json();
    chatBox.innerHTML += `<div class="message bot"><strong>SGResolve Bot:</strong> ${data.response}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
    document.getElementById("user-input").value = "";
}

document.getElementById('chat-icon').addEventListener('click', toggleChat);
document.querySelector('.send-button').addEventListener('click', sendMessage);

document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.about-section');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 }); // Trigger when 10% of the section is visible
    sections.forEach(section => {
      observer.observe(section);
    });
  });
