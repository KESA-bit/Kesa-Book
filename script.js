// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAldkKl1rlGjs-amA8rUADDW4vXczckNfs",
    authDomain: "kesa-c9fd6.firebaseapp.com",
    databaseURL: "https://kesa-c9fd6-default-rtdb.firebaseio.com",
    projectId: "kesa-c9fd6",
    storageBucket: "kesa-c9fd6.firebasestorage.app",
    messagingSenderId: "1006282632848",
    appId: "1:1006282632848:web:d8606db435e9292fb8f215",
    measurementId: "G-D2PD70BRB4"
};

// Cloudinary Unsigned Configuration
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dnxyhv8v2/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "teifjsyk";

let db;
let allProducts = [];
let cart = [];
let currentSliderIndex = 0;
let selectedProductForOrder = null;
let logoClickCount = 0;
let logoClickTimeout;
let isZoomed = false;
let initialLoadComplete = false;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        loadProducts();
        listenToOrders();
        listenForNewProductsNotification();
    }

    // Secret Admin Panel Trigger (5 quick clicks on logo)
    document.getElementById("kesa-logo").addEventListener("click", () => {
        logoClickCount++;
        clearTimeout(logoClickTimeout);
        logoClickTimeout = setTimeout(() => { logoClickCount = 0; }, 3000);
        if (logoClickCount === 5) {
            logoClickCount = 0; 
            openAdminWithPassword();
        }
    });

    document.getElementById("order-form").addEventListener("submit", handleOrderSubmit);
    document.getElementById("admin-add-product-form").addEventListener("submit", handleProductUpload);
});

// 1. New Product Publish Global Push Alert Feature
function listenForNewProductsNotification() {
    db.ref("products").limitToLast(1).on("child_added", (snapshot) => {
        if (!initialLoadComplete) return; // Ignore records present before session open
        const prod = snapshot.val();
        const bar = document.getElementById("global-announcement-bar");
        const txt = document.getElementById("announcement-text");
        if (bar && txt) {
            txt.innerHTML = `🔔 <b>New Launch Alert:</b> "${prod.title}" is now available for ₹${prod.price}! Click to check out.`;
            bar.style.display = "flex";
        }
    });
}

function closeAnnouncement() {
    document.getElementById("global-announcement-bar").style.display = "none";
}

// 2. Fetch Inventory Engine supporting Multi-Image and Live Manage Panel
function loadProducts() {
    const productsGrid = document.getElementById("products-grid");
    const adminProductsList = document.getElementById("admin-products-list");

    db.ref("products").on("value", (snapshot) => {
        productsGrid.innerHTML = "";
        if (adminProductsList) adminProductsList.innerHTML = "";
        
        const data = snapshot.val();
        allProducts = [];

        if (!data) {
            productsGrid.innerHTML = "<div class='loading'>No books listed yet. Use Admin dashboard.</div>";
            initialLoadComplete = true;
            return;
        }

        for (let id in data) {
            const prod = data[id];
            prod.id = id;
            allProducts.push(prod);

            const firstImage = prod.images && prod.images.length > 0 ? prod.images[0] : "";

            // Custom multi-image grid dots inside homepage cards
            let thumbnailsHTML = "";
            if (prod.images && prod.images.length > 1) {
                thumbnailsHTML = `<div style="display:flex; gap:4px; margin-top:5px; overflow-x:auto;">`;
                prod.images.forEach((imgUrl) => {
                    thumbnailsHTML += `
                        <img src="${imgUrl}" style="width:30px; height:30px; object-fit:contain; border:1px solid #333; border-radius:3px; background:#000;" 
                             onclick="event.stopPropagation(); changeCardImage('${id}', '${imgUrl}')">
                    `;
                });
                thumbnailsHTML += `</div>`;
            }

            // Customer facing cards
            const card = document.createElement("div");
            card.className = "product-card";
            card.innerHTML = `
                <img src="${firstImage}" id="main-img-${id}" class="product-image" onclick="openOrderModal('${prod.id}')">
                ${thumbnailsHTML}
                <div>
                    <div class="product-title">${prod.title}</div>
                    <div class="product-price">₹${prod.price}</div>
                    <button class="btn-primary" onclick="addToCart('${prod.id}')">Add to Cart</button>
                </div>
            `;
            productsGrid.appendChild(card);

            // ADMIN CONTROL MANAGER GRID (Edit Images, Price, Delete completely)
            if (adminProductsList) {
                const adminCard = document.createElement("div");
                adminCard.className = "admin-item-card";
                adminCard.innerHTML = `
                    <p><strong>Title:</strong> ${prod.title}</p>
                    <p><strong>Current Pricing Structure:</strong> ₹${prod.price}</p>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button class="btn-secondary" style="font-size:12px;" onclick="editProductPrice('${prod.id}')">✏️ Edit Price</button>
                        <button class="btn-secondary" style="font-size:12px;" onclick="replaceProductImages('${prod.id}')">🖼️ Replace Photos</button>
                        <button class="btn-secondary" style="font-size:12px; background:${varPrior = '#cc0c39'}; border-color:#cc0c39; color:white;" onclick="deleteProduct('${prod.id}')">🗑️ Delete Product</button>
                    </div>
                `;
                adminProductsList.appendChild(adminCard);
            }
        }
        initialLoadComplete = true;
    });
}

function changeCardImage(productId, newImageUrl) {
    const mainImg = document.getElementById(`main-img-${productId}`);
    if (mainImg) mainImg.src = newImageUrl;
}

// 3. Admin Catalog Master Actions Engine (Price Edit, Photo Swap, Complete Delete)
function editProductPrice(id) {
    const newPrice = prompt("Enter new price structure amount (₹):");
    if (newPrice) {
        db.ref("products/" + id).update({ price: newPrice })
            .then(() => alert("Pricing logic updated successfully!"));
    }
}

async function replaceProductImages(id) {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.accept = "image/*";
    input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if(files.length === 0) return;
        alert(`Replacing media assets. Uploading ${files.length} images...`);
        let newUrls = [];
        for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
            try {
                const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
                const data = await res.json();
                if (data.secure_url) newUrls.push(data.secure_url);
            } catch (err) { console.error(err); }
        }
        if(newUrls.length > 0) {
            db.ref("products/" + id).update({ images: newUrls })
                .then(() => alert("Product images swapped successfully!"));
        }
    };
    input.click();
}

function deleteProduct(id) {
    if (confirm("🚨 Are you absolutely sure you want to permanently delete this product from database?")) {
        db.ref("products/" + id).remove().then(() => alert("Product deleted from catalog."));
    }
}

// 4. Customer Live Logistics Tracker Logic
function toggleTrackingModal() {
    const modal = document.getElementById("tracking-modal");
    modal.style.display = modal.style.display === "flex" ? "none" : "flex";
}

function trackCustomerOrders() {
    const phone = document.getElementById("track-phone-input").value.trim();
    const container = document.getElementById("tracking-results-container");
    if (!phone) { alert("Please enter your registered phone number."); return; }

    container.innerHTML = "<p style='color:#aaa;'>Searching logistics logs...</p>";

    db.ref("orders").once("value", (snapshot) => {
        container.innerHTML = "";
        const data = snapshot.val();
        let found = false;

        for (let id in data) {
            const order = data[id];
            if (order.customerPhone === phone) {
                found = true;
                const card = document.createElement("div");
                card.className = "tracking-card";
                
                let badgeClass = "status-pending";
                if(order.status === "Shipped") badgeClass = "status-shipped";
                if(order.status === "Out For Delivery") badgeClass = "status-out";
                if(order.status === "Delivered") badgeClass = "status-delivered";

                const itemsOrdered = order.items.map(i => `${i.title} (x${i.quantity || 1})`).join(", ");

                card.innerHTML = `
                    <p><strong>Package Content:</strong> ${itemsOrdered}</p>
                    <p><strong>Order Timestamp:</strong> ${order.timestamp}</p>
                    <p><strong>Live Logistics Status:</strong> <span class="status-badge ${badgeClass}">${order.status}</span></p>
                `;
                container.appendChild(card);
            }
        }
        if (!found) container.innerHTML = "<p style='color:#cc0c39;'>No active profile order matches this mobile entry line.</p>";
    });
}

// 5. Admin Tab Operations Switcher
function switchAdminTab(type) {
    document.getElementById("admin-section-add").style.display = type === 'add' ? 'block' : 'none';
    document.getElementById("admin-section-manage").style.display = type === 'manage' ? 'block' : 'none';
    document.getElementById("admin-section-orders").style.display = type === 'orders' ? 'block' : 'none';
    
    document.getElementById("tab-add-btn").classList.toggle("active", type === 'add');
    document.getElementById("tab-manage-btn").classList.toggle("active", type === 'manage');
    document.getElementById("tab-orders-btn").classList.toggle("active", type === 'orders');
}

// 6. Admin Panel Order Logistics and Delivery Updates Management Dashboard
function listenToOrders() {
    const list = document.getElementById("orders-list");
    db.ref("orders").on("value", (snapshot) => {
        if (!list) return;
        list.innerHTML = "";
        const data = snapshot.val();
        if (!data) { list.innerHTML = "<p style='color: #888;'>No customer orders active currently.</p>"; return; }

        for (let id in data) {
            const order = data[id];
            const itemNames = order.items.map(i => `${i.title} (x${i.quantity || 1})`).join(", ");
                
            const div = document.createElement("div");
            div.className = "order-card";
            div.innerHTML = `
                <p><strong>Books:</strong> <span style="color:#ff9900;">${itemNames}</span></p>
                <p><strong>Customer Details:</strong> ${order.customerName} (${order.customerPhone})</p>
                <p><strong>Ship Info Address:</strong> ${order.customerAddress}</p>
                <p><strong>Logged Time:</strong> ${order.timestamp}</p>
                
                <div style="margin-top: 10px;">
                    <label style="font-size:12px; color:#aaa; display:block; margin-bottom:4px;">Update Shipment / Delivery Track Alert:</label>
                    <select onchange="updateLogisticsStatus('${id}', this.value)" style="padding:6px; margin-bottom:0; font-size:12px;">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>⏳ Pending Review</option>
                        <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>🚢 Shipped (Dispatched)</option>
                        <option value="Out For Delivery" ${order.status === 'Out For Delivery' ? 'selected' : ''}>🛵 Out For Delivery</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>✅ Delivered Successfully</option>
                    </select>
                </div>
            `;
            list.appendChild(div);
        }
    });
}

function updateLogisticsStatus(orderId, nextStatus) {
    db.ref("orders/" + orderId).update({ status: nextStatus })
        .then(() => alert(`Status alert broadcasted to customer profile: ${nextStatus}`));
}

// 7. Shopping Cart Module Processing Essentials
function addToCart(productId) {
    const prod = allProducts.find(p => p.id === productId);
    if (!prod) return;
    cart.push(prod);
    updateCartUI();
    alert(`"${prod.title}" added to your shopping cart!`);
}

function updateCartUI() {
    document.getElementById("cart-count").innerText = cart.length;
    const list = document.getElementById("cart-items-list");
    list.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
        total += parseInt(item.price);
        const div = document.createElement("div");
        div.style.display = "flex"; div.style.justifyContent = "space-between"; div.style.margin = "10px 0";
        div.innerHTML = `<span>${item.title} - ₹${item.price}</span><span style="color:#cc0c39; cursor:pointer;" onclick="removeFromCart(${index})">Remove</span>`;
        list.appendChild(div);
    });
    document.getElementById("cart-total-price").innerText = "Total: ₹" + total;
}

function removeFromCart(index) { cart.splice(index, 1); updateCartUI(); }
function toggleCartModal() { const m = document.getElementById("cart-modal"); m.style.display = m.style.display === "flex" ? "none" : "flex"; }
function checkoutCart() { if (cart.length === 0) { alert("Your cart is empty!"); return; } toggleCartModal(); openOrderModal(cart[0].id); }

// 8. Controlled Lock Zoom and Details View Slider Framework Modal
function openOrderModal(productId) {
    const prod = allProducts.find(p => p.id === productId);
    if (!prod) return;
    selectedProductForOrder = prod; currentSliderIndex = 0; resetZoomState();
    const slider = document.getElementById("modal-slider"); slider.innerHTML = "";
    if (prod.images) {
        prod.images.forEach(imgUrl => {
            const img = document.createElement("img"); img.src = imgUrl; slider.appendChild(img);
        });
    }
    document.getElementById("product-detail-info").innerHTML = `<h2 style="color:#ff9900; margin-top:10px; font-size:18px;">${prod.title}</h2><h3 style="margin-bottom:15px; font-weight:600; font-size:16px;">Price per copy: ₹${prod.price}</h3>`;
    document.getElementById("prod-qty").value = 1;
    const savedUser = localStorage.getItem("kesa_user_details");
    if (savedUser) {
        const u = JSON.parse(savedUser);
        document.getElementById("user-details-section").style.display = "none";
        document.getElementById("returning-user-msg").style.display = "block";
        document.getElementById("cust-name").value = u.name; document.getElementById("cust-phone").value = u.phone; document.getElementById("cust-address").value = u.address;
    } else {
        document.getElementById("user-details-section").style.display = "block"; document.getElementById("returning-user-msg").style.display = "none";
    }
    document.getElementById("order-modal").style.display = "flex"; updateSlider();
}

function toggleZoomMode() {
    const s = document.getElementById("modal-slider"); const i = document.getElementById("zoom-icon"); const t = document.getElementById("zoom-text");
    isZoomed = !isZoomed;
    if (isZoomed) { s.classList.add("zoomed"); i.innerText = "🔒"; t.innerText = "Zoom Locked (Click to Out)"; }
    else { s.classList.remove("zoomed"); i.innerText = "🔍"; t.innerText = "Click to Zoom"; }
}
function resetZoomState() { isZoomed = false; const s = document.getElementById("modal-slider"); if(s) s.classList.remove("zoomed"); }
function moveSlider(dir) { if (isZoomed) resetZoomState(); const s = document.getElementById("modal-slider"); const total = s.children.length; if (total <= 1) return; currentSliderIndex += dir; if (currentSliderIndex >= total) currentSliderIndex = 0; if (currentSliderIndex < 0) currentSliderIndex = total - 1; updateSlider(); }
function updateSlider() { document.getElementById("modal-slider").style.transform = `translateX(-${currentSliderIndex * 100}%)`; }
function closeOrderModal() { document.getElementById("order-modal").style.display = "none"; }
function enableEditDetails() { document.getElementById("user-details-section").style.display = "block"; document.getElementById("returning-user-msg").style.display = "none"; }

// 9. Process Client Order Payload Submission Line
function handleOrderSubmit(e) {
    e.preventDefault();
    const userData = { name: document.getElementById("cust-name").value, phone: document.getElementById("cust-phone").value, address: document.getElementById("cust-address").value };
    localStorage.setItem("kesa_user_details", JSON.stringify(userData));
    const qty = parseInt(document.getElementById("prod-qty").value) || 1;
    const items = cart.length > 0 ? cart.map(i => ({ title: i.title, price: i.price, quantity: 1 })) : [{ title: selectedProductForOrder.title, price: selectedProductForOrder.price, quantity: qty }];
    
    const orderData = { items, customerName: userData.name, customerPhone: userData.phone, customerAddress: userData.address, timestamp: new Date().toLocaleString(), status: "Pending" };
    db.ref("orders").push(orderData).then(() => { alert("Success! Your order is placed."); cart = []; updateCartUI(); closeOrderModal(); });
}

// 10. Open Admin Modality Gateway Engine
function openAdminWithPassword() {
    const pass = prompt("Enter Book Store Admin Passcode:");
    if (pass === "kesa123") { document.getElementById("admin-modal").style.display = "flex"; switchAdminTab('add'); }
    else if (pass !== null) { alert("Access Denied!"); }
}
function closeAdminPanel() { document.getElementById("admin-modal").style.display = "none"; }

// 11. Multi-Media Cloud Asset Pipeline Uploader
async function handleProductUpload(e) {
    e.preventDefault();
    const title = document.getElementById("prod-title").value;
    const price = document.getElementById("prod-price").value;
    const files = Array.from(document.getElementById("prod-images").files);
    if (files.length === 0) return;
    
    alert(`Uploading ${files.length} images to Cloudinary server...`);
    let uploadedUrls = [];
    for (const file of files) {
        const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        try {
            const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
            const data = await res.json();
            if (data.secure_url) uploadedUrls.push(data.secure_url);
        } catch (err) { console.error(err); }
    }
    if (uploadedUrls.length > 0) {
        db.ref("products").push({ title, price, images: uploadedUrls }).then(() => {
            alert(`"${title}" published successfully! Notification broadcasted to all active browsers.`);
            document.getElementById("admin-add-product-form").reset();
        });
    }
}
