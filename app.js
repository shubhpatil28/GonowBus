// --------------- FIREBASE CONFIGURATION --------------- //
// Replace these with your actual Firebase Project Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Global Variables
const SEAT_HOLD_TIME_MS = 5 * 60 * 1000; // 5 minutes

// --------------- UTILITY FUNCTIONS --------------- //

function generatePNR() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pnr = 'GNB';
    for (let i = 0; i < 6; i++) {
        pnr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pnr;
}

function formatDate(dateStr) {
    if(!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// --------------- 1. HOMEPAGE LOGIC ---------------+ //

if (document.getElementById('searchBusForm')) {
    const sourceInput = document.getElementById('sourceCity');
    const destInput = document.getElementById('destCity');
    const sourceSuggestions = document.getElementById('sourceSuggestions');
    const destSuggestions = document.getElementById('destSuggestions');

    async function handleCityAutocomplete(inputElement, suggestionsElement) {
        inputElement.addEventListener('input', async (e) => {
            const query = e.target.value.trim().toLowerCase();
            suggestionsElement.innerHTML = '';
            
            if (query.length < 1) {
                suggestionsElement.style.display = 'none';
                return;
            }

            try {
                // Fetch cities starting with query
                const snapshot = await db.collection("cities")
                    .where("name_lower", ">=", query)
                    .where("name_lower", "<=", query + '\uf8ff')
                    .limit(5)
                    .get();

                if (!snapshot.empty) {
                    suggestionsElement.style.display = 'block';
                    snapshot.forEach(doc => {
                        const cityName = doc.data().name;
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.textContent = cityName;
                        item.onclick = () => {
                            inputElement.value = cityName;
                            suggestionsElement.style.display = 'none';
                        };
                        suggestionsElement.appendChild(item);
                    });
                } else {
                    suggestionsElement.style.display = 'none';
                }
            } catch (error) {
                console.error("Error fetching cities:", error);
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target !== inputElement && e.target !== suggestionsElement) {
                suggestionsElement.style.display = 'none';
            }
        });
    }

    if(sourceInput && sourceSuggestions) handleCityAutocomplete(sourceInput, sourceSuggestions);
    if(destInput && destSuggestions) handleCityAutocomplete(destInput, destSuggestions);

    document.getElementById('searchBusForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const source = document.getElementById('sourceCity').value.trim().toLowerCase();
        const dest = document.getElementById('destCity').value.trim().toLowerCase();
        const date = document.getElementById('travelDate').value;

        if (!source || !dest || !date) {
            alert("Please fill all fields");
            return;
        }

        const container = document.getElementById('busListContainer');
        const header = document.getElementById('resultHeader');
        
        container.innerHTML = '<div class="text-center py-5"><i class="fa-solid fa-spinner fa-spin fs-2"></i><p class="mt-2">Searching for buses...</p></div>';
        header.style.display = 'block';

        try {
            // Fetch buses from firestore
            const busesSnapshot = await db.collection("buses")
                                        .where("from", "==", source)
                                        .where("to", "==", dest)
                                        .get();
            
            container.innerHTML = '';
            
            if (busesSnapshot.empty) {
                container.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="fa-solid fa-bus-slash fs-1 mb-3"></i>
                        <h4>No buses found</h4>
                        <p>We couldn't find any buses for this route. Try different cities.</p>
                    </div>`;
                return;
            }

            busesSnapshot.forEach(doc => {
                const bus = doc.data();
                const busId = doc.id;
                
                // Construct query params for seat selection
                const searchParams = new URLSearchParams({
                    busId: busId,
                    date: date,
                    busName: bus.name,
                    route: `${bus.from.toUpperCase()} to ${bus.to.toUpperCase()}`,
                    price: bus.price
                });

                const cardHtml = `
                    <div class="col-12 bus-list-item">
                        <div class="bus-card d-flex flex-column flex-md-row justify-content-between align-items-md-center">
                            <div class="mb-3 mb-md-0">
                                <h4 class="bus-title">${bus.name}</h4>
                                <span class="bus-type">${bus.type}</span>
                                <div class="bus-time-location mt-3">
                                    <div class="text-center">
                                        <div class="time">${bus.departure}</div>
                                        <div class="location">${bus.from.toUpperCase()}</div>
                                    </div>
                                    <div class="duration px-4">
                                        <i class="fa-solid fa-clock opacity-50"></i>
                                        <div class="mt-1 fw-semibold text-dark">${bus.duration || 'Dir'}</div>
                                    </div>
                                    <div class="text-center">
                                        <div class="time">${bus.arrival}</div>
                                        <div class="location">${bus.to.toUpperCase()}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-md-end d-flex flex-row flex-md-column justify-content-between align-items-center align-items-md-end">
                                <div class="bus-price mb-md-3">₹${bus.price}</div>
                                <a href="seat.html?${searchParams.toString()}" class="btn btn-danger fw-bold px-4 py-2">VIEW SEATS</a>
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML += cardHtml;
            });

        } catch (error) {
            console.error("Error fetching buses:", error);
            container.innerHTML = '<div class="alert alert-danger">Error fetching buses. Please try again later.</div>';
        }
    });

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('travelDate');
    if (dateInput) dateInput.min = today;
}

// --------------- 2. SEAT SELECTION LOGIC --------------- //

let selectedSeatsArr = [];
let maxSeats = 6;
let currentBusPrice = 0;
let seatUnsubscribe = null;

function initSeatPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const busId = urlParams.get('busId');
    const date = urlParams.get('date');
    const busName = urlParams.get('busName');
    const route = urlParams.get('route');
    currentBusPrice = parseFloat(urlParams.get('price'));

    if (!busId || !date) {
        alert("Invalid access. Redirecting to home.");
        window.location.href = "index.html";
        return;
    }

    // Set Header
    document.getElementById('busInfoHeader').innerHTML = `
        <h4 class="fw-bold mb-1">${busName}</h4>
        <p class="mb-0 text-muted">${route} | ${formatDate(date)}</p>
    `;

    document.getElementById('seatPrice').textContent = `₹${currentBusPrice}`;

    renderSeatGrid();
    listenToScats(busId, date);

    document.getElementById('proceedToBookBtn').addEventListener('click', async () => {
        if (selectedSeatsArr.length === 0) return;
        
        const btn = document.getElementById('proceedToBookBtn');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> HOLDING...';
        btn.disabled = true;

        try {
            // Create a hold booking record in firestore
            const holdRef = await db.collection('bookings').add({
                busId: busId,
                date: date,
                seats: selectedSeatsArr,
                status: 'held',
                holdExpiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + SEAT_HOLD_TIME_MS),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                busName: busName,
                route: route,
                pricePerSeat: currentBusPrice,
                totalAmount: currentBusPrice * selectedSeatsArr.length
            });

            // Redirect to booking completion page
            const bookingParams = new URLSearchParams({
                bookingId: holdRef.id
            });
            window.location.href = `booking.html?${bookingParams.toString()}`;
            
        } catch (error) {
            console.error("Error holding seats:", error);
            alert("Failed to hold seats. They might have been booked by someone else.");
            btn.innerHTML = 'PROCEED TO BOOK';
            btn.disabled = false;
        }
    });
}

function renderSeatGrid() {
    const grid = document.getElementById('seatGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // 40 Seats: 10 rows, 4 seats per row (2+2 layout)
    let seatNum = 1;
    for (let row = 1; row <= 10; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';
        
        for (let col = 1; col <= 5; col++) {
            if (col === 3) {
                // Aisle
                const aisle = document.createElement('div');
                aisle.className = 'aisle';
                rowDiv.appendChild(aisle);
            } else {
                const seat = document.createElement('div');
                seat.className = 'seat';
                seat.id = `seat-${seatNum}`;
                seat.textContent = seatNum;
                seat.dataset.seatNo = seatNum;
                
                seat.addEventListener('click', () => toggleSeatSelection(seat));
                
                rowDiv.appendChild(seat);
                seatNum++;
            }
        }
        grid.appendChild(rowDiv);
    }
}

function listenToScats(busId, date) {
    // Listen for all bookings for this bus on this date that are NOT cancelled
    seatUnsubscribe = db.collection("bookings")
        .where("busId", "==", busId)
        .where("date", "==", date)
        .where("status", "in", ["confirmed", "held"])
        .onSnapshot((snapshot) => {
            
            // First, reset all seat statuses visually except 'selected' by current user
            const allSeats = document.querySelectorAll('.seat');
            allSeats.forEach(s => {
                s.classList.remove('booked', 'held');
            });

            const now = Date.now();
            let bookedSeats = [];
            let heldSeats = [];

            snapshot.forEach(doc => {
                const b = doc.data();
                
                if (b.status === 'confirmed') {
                    bookedSeats = bookedSeats.concat(b.seats);
                } else if (b.status === 'held') {
                    // Check if hold is expired
                    if (b.holdExpiresAt && b.holdExpiresAt.toMillis() > now) {
                        heldSeats = heldSeats.concat(b.seats);
                    } else {
                        // Optionally trigger a cleanup function here for expired holds
                    }
                }
            });

            // Update UI
            bookedSeats.forEach(seatNo => {
                const el = document.getElementById(`seat-${seatNo}`);
                if(el) {
                    el.classList.add('booked');
                    el.classList.remove('selected');
                    // Remove from selection if user had it selected but it got booked
                    const idx = selectedSeatsArr.indexOf(seatNo.toString());
                    if (idx > -1) {
                        selectedSeatsArr.splice(idx, 1);
                        updateSummaryPanel();
                    }
                }
            });

            heldSeats.forEach(seatNo => {
                // Don't mark as held if it's currently selected by THIS user session 
                // Note: robust implementation requires tracking sessionId
                const el = document.getElementById(`seat-${seatNo}`);
                if(el && !el.classList.contains('selected')) {
                    el.classList.add('held');
                    el.classList.add('booked'); // Treat held as booked visually to prevent clicks
                }
            });

        }, (error) => {
            console.error("Error listening to seats:", error);
        });
}

function toggleSeatSelection(seatEl) {
    if (seatEl.classList.contains('booked') || seatEl.classList.contains('held')) return;

    const seatNo = seatEl.dataset.seatNo;
    
    if (seatEl.classList.contains('selected')) {
        seatEl.classList.remove('selected');
        selectedSeatsArr = selectedSeatsArr.filter(s => s !== seatNo);
    } else {
        if (selectedSeatsArr.length >= maxSeats) {
            alert(`You can only select up to ${maxSeats} seats.`);
            return;
        }
        seatEl.classList.add('selected');
        selectedSeatsArr.push(seatNo);
    }
    
    updateSummaryPanel();
}

function updateSummaryPanel() {
    const seatsSpan = document.getElementById('selectedSeats');
    const amountSpan = document.getElementById('totalAmount');
    const btn = document.getElementById('proceedToBookBtn');
    
    if (selectedSeatsArr.length > 0) {
        seatsSpan.textContent = selectedSeatsArr.join(', ');
        amountSpan.textContent = `₹${selectedSeatsArr.length * currentBusPrice}`;
        btn.disabled = false;
    } else {
        seatsSpan.textContent = '-';
        amountSpan.textContent = '₹0';
        btn.disabled = true;
    }
}

// --------------- 3. BOOKING COMPLETION LOGIC --------------- //

let bookingHoldInterval = null;

function initBookingPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('bookingId');

    if (!bookingId) {
        window.location.href = "index.html";
        return;
    }

    const backBtn = document.getElementById('backToSeatsBtn');

    // Fetch booking details
    db.collection('bookings').doc(bookingId).get().then(doc => {
        if (!doc.exists) {
            alert("Booking session not found.");
            window.location.href = "index.html";
            return;
        }

        const bData = doc.data();

        // Check if expired
        const now = Date.now();
        const expiresAt = bData.holdExpiresAt.toMillis();
        
        if (bData.status !== 'held' || expiresAt <= now) {
            alert("This booking session has expired or is invalid.");
            window.location.href = "index.html";
            return;
        }

        // Populate UI
        document.getElementById('bookBusName').textContent = bData.busName;
        document.getElementById('bookRoute').textContent = bData.route;
        document.getElementById('bookDate').textContent = formatDate(bData.date);
        document.getElementById('bookTotal').textContent = `₹${bData.totalAmount}`;
        document.getElementById('bookSeats').textContent = `Seats: ${bData.seats.join(', ')}`;
        
        if(backBtn) {
            // Re-construct params for back button
            const searchParams = new URLSearchParams({
                busId: bData.busId,
                date: bData.date,
                busName: bData.busName,
                route: bData.route,
                price: bData.pricePerSeat
            });
            backBtn.href = `seat.html?${searchParams.toString()}`;
        }

        // Start timer
        startBookingTimer(expiresAt, bookingId);

    }).catch(err => {
        console.error("Error fetching hold record:", err);
    });

    // Form Submission
    const form = document.getElementById('bookingForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
                e.stopPropagation();
                form.classList.add('was-validated');
                return;
            }

            const btn = document.getElementById('confirmBookingBtn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESSING PAYMENT...';
            btn.disabled = true;

            const name = document.getElementById('passengerName').value;
            const phone = document.getElementById('passengerPhone').value;
            const email = document.getElementById('passengerEmail').value;
            const age = document.getElementById('passengerAge').value;
            const pnr = generatePNR();

            try {
                // Confirm Booking
                await db.collection('bookings').doc(bookingId).update({
                    status: 'confirmed',
                    pnr: pnr,
                    passenger: {
                        name: name,
                        phone: phone,
                        email: email,
                        age: age
                    },
                    confirmedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                clearInterval(bookingHoldInterval);
                document.getElementById('bookingTimerAlert').classList.add('d-none');
                
                // Show Success
                document.getElementById('successPnr').textContent = pnr;
                document.getElementById('successSms').textContent = phone;
                
                const successModal = new bootstrap.Modal(document.getElementById('successModal'));
                successModal.show();

            } catch (error) {
                console.error("Error confirming booking:", error);
                alert("Payment processing failed. Please try again.");
                btn.innerHTML = 'PAY & CONFIRM BOOKING';
                btn.disabled = false;
            }
        });
    }
}

function startBookingTimer(expireTimeMs, bookingId) {
    const timerEl = document.getElementById('bookingHoldTimer');
    
    bookingHoldInterval = setInterval(() => {
        const now = Date.now();
        const diff = expireTimeMs - now;

        if (diff <= 0) {
            clearInterval(bookingHoldInterval);
            timerEl.textContent = "00:00";
            alert("Session Expired. Seats have been released.");
            // Mark as cancelled in DB
            db.collection('bookings').doc(bookingId).update({ status: 'cancelled' }).then(()=>{
                window.location.href = "index.html";
            });
            return;
        }

        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        timerEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
    }, 1000);
}

// --------------- 4. PNR STATUS PAGE LOGIC --------------- //

let currentFetchedBookingId = null;

function initStatusPage() {
    const form = document.getElementById('pnrForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pnr = document.getElementById('pnrInput').value.trim().toUpperCase();
            
            const btn = document.getElementById('checkStatusBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;

            const resContainer = document.getElementById('ticketResultContainer');
            const notFoundMsg = document.getElementById('notFoundMsg');
            resContainer.classList.add('d-none');
            notFoundMsg.classList.add('d-none');

            try {
                const snapshot = await db.collection('bookings').where('pnr', '==', pnr).get();
                
                if (snapshot.empty) {
                    notFoundMsg.classList.remove('d-none');
                } else {
                    const doc = snapshot.docs[0];
                    const data = doc.data();
                    currentFetchedBookingId = doc.id;

                    // Populate Ticket
                    document.getElementById('showPnr').textContent = data.pnr;
                    
                    const statusBadge = document.getElementById('showStatus');
                    statusBadge.textContent = data.status.toUpperCase();
                    statusBadge.className = 'badge mt-2 fw-bold ';
                    if(data.status === 'confirmed') statusBadge.classList.add('bg-success');
                    else if(data.status === 'cancelled') statusBadge.classList.add('bg-danger');
                    else statusBadge.classList.add('bg-warning', 'text-dark');

                    document.getElementById('showBusName').textContent = data.busName;
                    
                    // Split route
                    const routeParts = data.route.split(' to ');
                    document.getElementById('showSource').textContent = routeParts[0] || '-';
                    document.getElementById('showDest').textContent = routeParts[1] || '-';
                    document.getElementById('showDate').textContent = formatDate(data.date);
                    
                    document.getElementById('showPassenger').textContent = data.passenger ? data.passenger.name : '-';
                    document.getElementById('showSeats').textContent = data.seats.join(', ');
                    document.getElementById('showPrice').textContent = `₹${data.totalAmount}`;

                    const cancelBtn = document.getElementById('cancelBookingBtn');
                    if(data.status === 'confirmed') {
                        cancelBtn.style.display = 'inline-block';
                    } else {
                        cancelBtn.style.display = 'none';
                    }

                    // Set map tracking URL if needed later
                    if (data.status === 'confirmed' || data.status === 'held') {
                        document.getElementById('trackingContainer').style.display = 'block';
                        initMapForBus(data.busId);
                    } else {
                        document.getElementById('trackingContainer').style.display = 'none';
                        if (mapUnsubscribe) {
                            mapUnsubscribe();
                            mapUnsubscribe = null;
                        }
                    }

                    resContainer.classList.remove('d-none');
                }
            } catch (error) {
                console.error("Error fetching PNR:", error);
                alert("An error occurred. Please try again later.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    const cancelBtn = document.getElementById('cancelBookingBtn');
    if(cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            if(!currentFetchedBookingId) return;
            
            if(confirm("Are you sure you want to cancel this booking? This action cannot be undone.")) {
                try {
                    await db.collection('bookings').doc(currentFetchedBookingId).update({
                        status: 'cancelled',
                        cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert("Booking cancelled successfully.");
                    // Re-trigger search to update UI
                    document.getElementById('pnrForm').dispatchEvent(new Event('submit'));
                } catch(err) {
                    console.error("Error cancelling:", err);
                    alert("Failed to cancel booking.");
                }
            }
        });
    }
}

// Leaflet tracking logic
let trackingMap = null;
let busMarker = null;
let mapUnsubscribe = null;

function initMapForBus(busId) {
    if (!trackingMap) {
        trackingMap = L.map('map').setView([20.5937, 78.9629], 5); // Default to India center
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(trackingMap);
    }

    if (mapUnsubscribe) {
        mapUnsubscribe();
    }

    mapUnsubscribe = db.collection('buses').doc(busId).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data.location && data.location.lat && data.location.lng) {
                const latLng = [data.location.lat, data.location.lng];
                
                if (!busMarker) {
                    // Create an icon or use default
                    busMarker = L.marker(latLng).addTo(trackingMap)
                        .bindPopup(`<b>${data.name}</b><br>Currently tracking`);
                } else {
                    busMarker.setLatLng(latLng);
                }
                
                // Fly to bus location
                trackingMap.flyTo(latLng, 12, { animate: true });
            }
        }
    });
}

// --------------- 5. ADMIN DASHBOARD LOGIC --------------- //

function initAdminPage() {
    loadAdminStats();
    loadBusesList();
    loadBookingsList();

    // Add Bus Form
    const addBusForm = document.getElementById('addBusForm');
    if (addBusForm) {
        addBusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = addBusForm.querySelector('button[type="submit"]');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            btn.disabled = true;

            const busData = {
                name: document.getElementById('formBusName').value,
                type: document.getElementById('formBusType').value,
                from: document.getElementById('formSource').value.trim().toLowerCase(),
                to: document.getElementById('formDest').value.trim().toLowerCase(),
                departure: document.getElementById('formDepTime').value,
                arrival: document.getElementById('formArrTime').value,
                duration: document.getElementById('formDuration').value,
                price: parseFloat(document.getElementById('formPrice').value),
                location: { lat: 0, lng: 0 },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('buses').add(busData);
                
                const modalEl = document.getElementById('addBusModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                addBusForm.reset();
                
                alert("Bus added successfully!");
                loadBusesList(); // refresh count
                loadAdminStats();
            } catch (error) {
                console.error("Error adding bus:", error);
                alert("Failed to add bus.");
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-save"></i> Save Bus';
                btn.disabled = false;
            }
        });
    }

    // Update Location Form
    const locForm = document.getElementById('updateLocationForm');
    if(locForm) {
        locForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const busId = document.getElementById('locBusId').value;
            const lat = parseFloat(document.getElementById('locLat').value);
            const lng = parseFloat(document.getElementById('locLng').value);

            try {
                await db.collection('buses').doc(busId).update({
                    location: { lat, lng }
                });
                const modal = bootstrap.Modal.getInstance(document.getElementById('updateLocationModal'));
                modal.hide();
                alert("Location updated successfully.");
                loadBusesList();
            } catch(err) {
                console.error("Error updating location:", err);
                alert("Failed to update location.");
            }
        });
    }
}

async function loadAdminStats() {
    try {
        // Buses Count
        const busesSnap = await db.collection('buses').get();
        document.getElementById('totalBuses').textContent = busesSnap.size;

        // Bookings & Revenue
        const bookingsSnap = await db.collection('bookings').where('status', '==', 'confirmed').get();
        document.getElementById('totalBookings').textContent = bookingsSnap.size;
        
        let rev = 0;
        bookingsSnap.forEach(doc => {
            if(doc.data().totalAmount) {
                rev += doc.data().totalAmount;
            }
        });
        document.getElementById('totalRevenue').textContent = `₹${rev}`;

        // Active Users (Dummy metric for now, could be active sessions)
        document.getElementById('activeUsers').textContent = Math.floor(Math.random() * 50) + 10;

    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

async function loadBusesList() {
    const tbody = document.getElementById('busTableBody');
    if(!tbody) return;

    try {
        const snap = await db.collection('buses').orderBy('createdAt', 'desc').get();
        tbody.innerHTML = '';
        
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No buses found. Add one!</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const b = doc.data();
            const id = doc.id;
            const locStr = b.location ? `${b.location.lat}, ${b.location.lng}` : 'Not set';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-bold">${b.name}</div>
                    <small class="text-muted">${b.type}</small>
                </td>
                <td>
                    <div class="fw-semibold text-primary text-uppercase">${b.from} <i class="fa-solid fa-arrow-right mx-1 text-muted"></i> ${b.to}</div>
                </td>
                <td>${b.departure} - ${b.arrival}</td>
                <td class="fw-bold">₹${b.price}</td>
                <td><span class="badge bg-light text-dark border"><i class="fa-solid fa-location-dot text-danger"></i> ${locStr}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openLocationModal('${id}', ${b.location?.lat||0}, ${b.location?.lng||0})">
                        <i class="fa-solid fa-location-crosshairs"></i> Update Loc
                    </button>
                    <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteBus('${id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error loading buses:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error loading data.</td></tr>';
    }
}

// Global function for onclick in html string
window.openLocationModal = function(id, lat, lng) {
    document.getElementById('locBusId').value = id;
    document.getElementById('locLat').value = lat !== 0 ? lat : '';
    document.getElementById('locLng').value = lng !== 0 ? lng : '';
    const m = new bootstrap.Modal(document.getElementById('updateLocationModal'));
    m.show();
};

window.deleteBus = async function(id) {
    if(confirm("Delete this bus?")) {
        try {
            await db.collection('buses').doc(id).delete();
            loadBusesList();
            loadAdminStats();
        } catch(e) {
            console.error(e);
            alert("Error deleting bus.");
        }
    }
};

async function loadBookingsList() {
    const tbody = document.getElementById('bookingTableBody');
    if(!tbody) return;

    try {
        const snap = await db.collection('bookings').orderBy('createdAt', 'desc').get();
        tbody.innerHTML = '';
        
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No bookings yet.</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const b = doc.data();
            const id = doc.id;
            
            let badgeClass = 'bg-warning text-dark';
            if(b.status === 'confirmed') badgeClass = 'bg-success';
            if(b.status === 'cancelled') badgeClass = 'bg-danger';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fw-bold text-primary">${b.pnr || 'N/A'}</td>
                <td>
                    <div class="fw-semibold">${b.passenger ? b.passenger.name : '-'}</div>
                    <small class="text-muted">${b.passenger ? b.passenger.phone : '-'}</small>
                </td>
                <td>
                    <div>${b.busName}</div>
                    <small class="text-muted">${b.route} | ${b.date}</small>
                </td>
                <td class="fw-bold">${b.seats.join(', ')}</td>
                <td class="fw-bold text-success">₹${b.totalAmount}</td>
                <td><span class="badge ${badgeClass}">${b.status.toUpperCase()}</span></td>
                <td>
                    ${b.status === 'confirmed' ? `<button class="btn btn-sm btn-outline-danger" onclick="cancelBookingAdmin('${id}')">Cancel</button>` : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error loading bookings:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Error loading data.</td></tr>';
    }
}

window.cancelBookingAdmin = async function(id) {
    if(confirm("Cancel this booking?")) {
        try {
            await db.collection('bookings').doc(id).update({
                status: 'cancelled',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            loadBookingsList();
            loadAdminStats();
        } catch(e) {
            console.error("Error cancelling:", e);
        }
    }
}

// --------------- INITIALIZATION --------------- //
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('seat.html')) {
        initSeatPage();
    } else if (path.includes('booking.html')) {
        initBookingPage();
    } else if (path.includes('status.html')) {
        initStatusPage();
    } else if (path.includes('admin.html')) {
        initAdminPage();
    }
});
