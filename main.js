document.addEventListener("DOMContentLoaded", () => {
    // Register Service Worker for PWA / iOS standalone webapp support
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js")
            .then(reg => {
                console.log("Service Worker registered successfully:", reg.scope);
                // Listen for Service Worker updates to auto-refresh the browser cache
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log("New version detected, auto-reloading...");
                                window.location.reload();
                            }
                        }
                    };
                };
            })
            .catch(err => console.log("Service Worker registration failed:", err));
    }

    // DOM Elements
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const fileDetails = document.getElementById("file-details");
    const fileNameLabel = document.getElementById("file-name-label");
    const fileSizeLabel = document.getElementById("file-size-label");
    const removeFileBtn = document.getElementById("remove-file-btn");
    
    const manualCategoryInput = document.getElementById("manual-category-input");
    const addCategoryBtn = document.getElementById("add-category-btn");
    const categorySearchInput = document.getElementById("category-search-input");
    const selectAllCats = document.getElementById("select-all-cats");
    const deselectAllCats = document.getElementById("deselect-all-cats");
    const categoryList = document.getElementById("category-list");
    const categoryCount = document.getElementById("category-count");
    
    const startCrawlBtn = document.getElementById("start-crawl-btn");
    const stopCrawlBtn = document.getElementById("stop-crawl-btn");
    const headedToggle = document.getElementById("headed-toggle");
    
    const terminalConsole = document.getElementById("terminal-console");
    const globalStatusDot = document.getElementById("global-status-dot");
    const globalStatusText = document.getElementById("global-status-text");
    
    const tableSearch = document.getElementById("table-search");
    const filterBtns = document.querySelectorAll(".filter-btn");
    const exportExcelBtn = document.getElementById("export-excel-btn");
    const exportHtmlBtn = document.getElementById("export-html-btn");
    const tableBody = document.getElementById("table-body");
    const resultsSummary = document.getElementById("results-summary");
    
    // Tab Elements
    const tabBtnSetup = document.getElementById("tab-btn-setup");
    const tabBtnResults = document.getElementById("tab-btn-results");
    const setupPage = document.getElementById("setup-page");
    const resultsPage = document.getElementById("results-page");
    
    // Tab Navigation Logic
    tabBtnSetup.addEventListener("click", () => {
        tabBtnSetup.classList.add("active");
        tabBtnResults.classList.remove("active");
        setupPage.classList.remove("hide");
        setupPage.classList.add("active");
        resultsPage.classList.add("hide");
        resultsPage.classList.remove("active");
    });
    
    tabBtnResults.addEventListener("click", () => {
        tabBtnResults.classList.add("active");
        tabBtnSetup.classList.remove("active");
        resultsPage.classList.remove("hide");
        resultsPage.classList.add("active");
        setupPage.classList.add("hide");
        setupPage.classList.remove("active");
    });

    // Internal State: targetCategories stores objects: { name: string, checked: boolean }
    let targetCategories = [];
    let crawledBids = [];
    let activeFilter = "all";
    let eventSource = null;

    // Helper: Determine API URL (Absolute localhost if opened locally/GitHub Pages, otherwise relative)
    function getApiUrl(path) {
        const storedUrl = localStorage.getItem("backend_url");
        if (storedUrl) {
            const base = storedUrl.endsWith("/") ? storedUrl.slice(0, -1) : storedUrl;
            return `${base}${path}`;
        }
        
        // If opened from GitHub Pages or as a local static file (file://), default to localhost:8000
        if (window.location.hostname.endsWith(".github.io") || window.location.protocol === "file:") {
            return `http://127.0.0.1:8000${path}`;
        }
        
        // If opened from local IP or local server hostname (like localhost:8000), use relative paths
        return path;
    }

    // --- drag and drop Excel handlers ---
    
    dropZone.addEventListener("click", () => fileInput.click());
    
    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("dragover");
        }, false);
    });

    dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleUploadedFile(files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFile(e.target.files[0]);
        }
    });

    removeFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.value = "";
        fileDetails.classList.add("hide");
        dropZone.classList.remove("hide");
        targetCategories = [];
        renderCategoryList();
        logToConsole("Excel file removed. Awaiting target categories...", "system");
    });

    async function handleUploadedFile(file) {
        const ext = file.name.split(".").pop().toLowerCase();
        if (ext !== "xlsx" && ext !== "xls") {
            logToConsole(`Error: File '${file.name}' is not an Excel spreadsheet.`, "alert");
            alert("Please upload a valid Excel spreadsheet (.xlsx or .xls)");
            return;
        }

        fileNameLabel.textContent = file.name;
        fileSizeLabel.textContent = formatBytes(file.size);
        dropZone.classList.add("hide");
        fileDetails.classList.remove("hide");

        const isOffline = globalStatusText.textContent === "Standalone Mode";
        
        if (isOffline) {
            logToConsole(`Parsing '${file.name}' client-side (Standalone)...`, "system");
            parseExcelClientSide(file);
            return;
        }

        logToConsole(`Uploading '${file.name}'...`, "system");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(getApiUrl("/api/upload"), {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            
            if (data.success && data.categories.length > 0) {
                // Initialize all as checked: false
                targetCategories = data.categories.map(cat => ({ name: cat, checked: false }));
                logToConsole(`Successfully loaded ${targetCategories.length} categories from Excel file.`, "success");
                renderCategoryList();
            } else {
                logToConsole(`Failed to extract categories: ${data.error || "No categories found in file."}`, "alert");
                alert(data.error || "No categories found. Ensure the Excel sheet contains category rows.");
            }
        } catch (err) {
            logToConsole(`Error communicating with backend: ${err.message}`, "alert");
        }
    }

    // --- category list interactions (Search, select all, manual add) ---
    
    addCategoryBtn.addEventListener("click", () => {
        const cat = manualCategoryInput.value.trim();
        if (cat) {
            targetCategories.push({ name: cat, checked: true });
            manualCategoryInput.value = "";
            logToConsole(`Added category: '${cat}'`, "log");
            renderCategoryList();
        }
    });

    manualCategoryInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            addCategoryBtn.click();
        }
    });

    // Select / Deselect All
    selectAllCats.addEventListener("click", () => {
        targetCategories.forEach(c => c.checked = true);
        renderCategoryList();
    });

    deselectAllCats.addEventListener("click", () => {
        targetCategories.forEach(c => c.checked = false);
        renderCategoryList();
    });

    // Live search in category list
    categorySearchInput.addEventListener("input", () => {
        renderCategoryList();
    });

    function deleteCategory(index) {
        const removed = targetCategories.splice(index, 1);
        logToConsole(`Removed category: '${removed[0].name}'`, "log");
        renderCategoryList();
    }

    function renderCategoryList() {
        const query = categorySearchInput.value.toLowerCase().trim();
        
        // Filter categories based on search input
        const filtered = targetCategories.filter(cat => cat.name.toLowerCase().includes(query));
        const checkedCount = targetCategories.filter(c => c.checked).length;
        
        categoryCount.textContent = `${checkedCount} / ${targetCategories.length} Selected`;
        categoryList.innerHTML = "";

        if (targetCategories.length === 0) {
            categoryList.innerHTML = '<li class="empty-list-msg">No categories loaded. Upload an Excel file or add one manually.</li>';
            startCrawlBtn.disabled = true;
            return;
        }

        if (filtered.length === 0) {
            categoryList.innerHTML = '<li class="empty-list-msg">No categories match the search query.</li>';
            startCrawlBtn.disabled = checkedCount === 0;
            return;
        }

        filtered.forEach((cat) => {
            // Find absolute index in targetCategories array for deleting
            const originalIndex = targetCategories.indexOf(cat);
            
            const li = document.createElement("li");
            li.innerHTML = `
                <input type="checkbox" class="category-checkbox" data-index="${originalIndex}" ${cat.checked ? 'checked' : ''}>
                <span class="category-text" title="${cat.name}">${cat.name}</span>
                <div class="category-actions">
                    <button class="crawl-item-btn" data-name="${encodeURIComponent(cat.name)}" title="Crawl only this category">▶</button>
                    <button class="delete-item-btn" data-index="${originalIndex}" title="Delete">&times;</button>
                </div>
            `;
            categoryList.appendChild(li);
        });

        // Event listeners for checkboxes
        categoryList.querySelectorAll(".category-checkbox").forEach(cb => {
            cb.addEventListener("change", (e) => {
                const idx = parseInt(e.target.getAttribute("data-index"));
                targetCategories[idx].checked = e.target.checked;
                // Update selection badge and start button state without re-rendering everything to preserve cursor scroll
                const cCount = targetCategories.filter(c => c.checked).length;
                categoryCount.textContent = `${cCount} / ${targetCategories.length} Selected`;
                startCrawlBtn.disabled = cCount === 0;
            });
        });

        // Event listeners for individual crawl play buttons
        categoryList.querySelectorAll(".crawl-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const name = decodeURIComponent(e.target.getAttribute("data-name"));
                triggerCrawlStream([name]);
            });
        });

        // Event listeners for delete buttons
        categoryList.querySelectorAll(".delete-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.target.getAttribute("data-index"));
                deleteCategory(idx);
            });
        });

        startCrawlBtn.disabled = checkedCount === 0;
    }

    // --- crawl trigger logic ---
    
    startCrawlBtn.addEventListener("click", () => {
        const selected = targetCategories.filter(c => c.checked).map(c => c.name);
        if (selected.length === 0) return;
        triggerCrawlStream(selected);
    });

    function triggerCrawlStream(categoriesToCrawl) {
        const isOffline = globalStatusText.textContent === "Standalone Mode";
        
        if (isOffline) {
            triggerMockCrawl(categoriesToCrawl);
            return;
        }

        // UI lockups
        startCrawlBtn.disabled = true;
        startCrawlBtn.classList.add("hide");
        stopCrawlBtn.classList.remove("hide");
        addCategoryBtn.disabled = true;
        manualCategoryInput.disabled = true;
        removeFileBtn.disabled = true;
        headedToggle.disabled = true;
        selectAllCats.disabled = true;
        deselectAllCats.disabled = true;
        categorySearchInput.disabled = true;
        
        tableSearch.disabled = true;
        filterBtns.forEach(btn => btn.disabled = true);
        exportExcelBtn.disabled = true;
        exportHtmlBtn.disabled = true;
        
        // Reset state
        crawledBids = [];
        renderResultsTable();
        
        globalStatusDot.className = "status-indicator running";
        globalStatusText.textContent = "Crawling GeM...";
        
        // Setup SSE connection
        const categoriesQuery = encodeURIComponent(categoriesToCrawl.join(","));
        const headlessQuery = !headedToggle.checked;
        const streamUrl = getApiUrl(`/api/crawl-stream?categories=${categoriesQuery}&headless=${headlessQuery}`);
        
        logToConsole("Establishing real-time stream connection...", "system");
        
        eventSource = new EventSource(streamUrl);
        
        eventSource.onmessage = (event) => {
            const payload = JSON.parse(event.data);
            
            if (payload.type === "log") {
                logToConsole(`> ${payload.message}`, "log");
            } else if (payload.type === "bid_result") {
                const bid = payload.data;
                crawledBids.push(bid);
                
                logToConsole(`SUCCESS: Extracted Bid ${bid.bid_number} for '${bid.search_category}' (Startup: ${bid.startup_relaxation})`, "success");
                
                appendBidToTable(bid);
                updateResultsSummary();
            } else if (payload.type === "complete") {
                logToConsole(`FINISHED: ${payload.message}`, "success");
                closeStream();
            }
        };
        
        eventSource.onerror = (err) => {
            logToConsole("Stream connection lost or completed.", "system");
            closeStream();
        };
    }

    function closeStream() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        
        // Restore controls
        startCrawlBtn.disabled = false;
        startCrawlBtn.classList.remove("hide");
        stopCrawlBtn.classList.add("hide");
        addCategoryBtn.disabled = false;
        manualCategoryInput.disabled = false;
        removeFileBtn.disabled = false;
        headedToggle.disabled = false;
        selectAllCats.disabled = false;
        deselectAllCats.disabled = false;
        categorySearchInput.disabled = false;
        
        const isOffline = offlineBanner && !offlineBanner.classList.contains("hide");
        if (isOffline) {
            globalStatusDot.className = "status-indicator idle";
            globalStatusText.textContent = "Standalone Mode";
        } else {
            globalStatusDot.className = "status-indicator online";
            globalStatusText.textContent = "Backend Connected";
        }
        
        if (crawledBids.length > 0) {
            tableSearch.disabled = false;
            filterBtns.forEach(btn => btn.disabled = false);
            exportExcelBtn.disabled = false;
            exportHtmlBtn.disabled = false;
            
            // Auto switch to Parsed Tender Results tab upon completion
            tabBtnResults.click();
        }
        
        updateResultsSummary();
    }

    // --- table rendering and search filters ---
    
    function isCategoryMatching(target, extracted) {
        if (!target || !extracted) return false;
        const clean = (s) => s.toLowerCase()
            .replace(/\(q\d+\)/g, "") // remove (Q1), (Q2) etc.
            .replace(/[^a-z0-9]/g, "") // remove all non-alphanumeric
            .trim();
        const t = clean(target);
        const e = clean(extracted);
        return t.includes(e) || e.includes(t);
    }
    
    function renderResultsTable() {
        tableBody.innerHTML = "";
        
        const filtered = applyFilters(crawledBids);
        
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="no-data-cell">
                        ${crawledBids.length === 0 ? "No tenders crawled yet. Upload and execute a crawl to view data." : "No tenders match active filters."}
                    </td>
                </tr>
            `;
            return;
        }
        
        filtered.forEach(bid => {
            const tr = document.createElement("tr");
            const startupClass = bid.startup_relaxation.toLowerCase() === "yes" ? "yes" : "no";
            const mseClass = bid.mse_relaxation.toLowerCase() === "yes" ? "yes" : "no";
            
            const isMatch = isCategoryMatching(bid.search_category, bid.item_category);
            const warningBadge = isMatch ? "" : `<span class="mismatch-badge" title="Extracted category does not match target category. Please verify manually.">⚠️ Mismatch</span>`;
            
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--accent);">${bid.bid_number}</td>
                <td style="color: var(--text-muted); font-size: 11px;" title="${bid.search_category}">${bid.search_category}</td>
                <td>${bid.item_category}${warningBadge}</td>
                <td>${bid.location || "Unknown"}</td>
                <td style="text-align: center; font-weight: 600;">${bid.quantity || "Unknown"}</td>
                <td><span class="status-pill ${startupClass}">${bid.startup_relaxation}</span></td>
                <td><span class="status-pill ${mseClass}">${bid.mse_relaxation}</span></td>
                <td style="white-space: nowrap;">${bid.end_date}</td>
                <td style="font-size: 12px;">${bid.ministry}</td>
                <td>
                    <a href="${bid.url}" target="_blank" class="doc-link-btn" title="View GeM Bid Document">
                        📄
                    </a>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function appendBidToTable(bid) {
        if (tableBody.querySelector(".no-data-cell")) {
            tableBody.innerHTML = "";
        }
        
        if (activeFilter === "startup-yes" && bid.startup_relaxation.toLowerCase() !== "yes") return;
        if (activeFilter === "mse-yes" && bid.mse_relaxation.toLowerCase() !== "yes") return;
        
        const tr = document.createElement("tr");
        const startupClass = bid.startup_relaxation.toLowerCase() === "yes" ? "yes" : "no";
        const mseClass = bid.mse_relaxation.toLowerCase() === "yes" ? "yes" : "no";
        
        const isMatch = isCategoryMatching(bid.search_category, bid.item_category);
        const warningBadge = isMatch ? "" : `<span class="mismatch-badge" title="Extracted category does not match target category. Please verify manually.">⚠️ Mismatch</span>`;
        
        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--accent);">${bid.bid_number}</td>
            <td style="color: var(--text-muted); font-size: 11px;" title="${bid.search_category}">${bid.search_category}</td>
            <td>${bid.item_category}${warningBadge}</td>
            <td>${bid.location || "Unknown"}</td>
            <td style="text-align: center; font-weight: 600;">${bid.quantity || "Unknown"}</td>
            <td><span class="status-pill ${startupClass}">${bid.startup_relaxation}</span></td>
            <td><span class="status-pill ${mseClass}">${bid.mse_relaxation}</span></td>
            <td style="white-space: nowrap;">${bid.end_date}</td>
            <td style="font-size: 12px;">${bid.ministry}</td>
            <td>
                <a href="${bid.url}" target="_blank" class="doc-link-btn" title="View GeM Bid Document">
                    📄
                </a>
            </td>
        `;
        tableBody.appendChild(tr);
    }

    function updateResultsSummary() {
        if (crawledBids.length === 0) {
            resultsSummary.textContent = "No active crawl results loaded.";
            return;
        }
        const startupRelaxed = crawledBids.filter(b => b.startup_relaxation.toLowerCase() === "yes").length;
        resultsSummary.textContent = `Extracted ${crawledBids.length} bids across targets. ${startupRelaxed} match Startup Relaxation criteria.`;
    }

    function applyFilters(bids) {
        let list = [...bids];
        const query = tableSearch.value.toLowerCase().trim();
        
        if (query) {
            list = list.filter(b => 
                b.bid_number.toLowerCase().includes(query) ||
                b.search_category.toLowerCase().includes(query) ||
                b.item_category.toLowerCase().includes(query) ||
                (b.location && b.location.toLowerCase().includes(query)) ||
                (b.quantity && String(b.quantity).toLowerCase().includes(query)) ||
                b.ministry.toLowerCase().includes(query)
            );
        }
        
        if (activeFilter === "startup-yes") {
            list = list.filter(b => b.startup_relaxation.toLowerCase() === "yes");
        } else if (activeFilter === "mse-yes") {
            list = list.filter(b => b.mse_relaxation.toLowerCase() === "yes");
        }
        
        return list;
    }

    filterBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            filterBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeFilter = e.target.getAttribute("data-filter");
            renderResultsTable();
        });
    });

    tableSearch.addEventListener("input", () => {
        renderResultsTable();
    });

    // --- file exports (Excel & HTML) ---
    
    exportExcelBtn.addEventListener("click", () => {
        if (crawledBids.length === 0) return;
        logToConsole("Exporting compiled results to Excel sheet...", "system");
        
        const isOffline = globalStatusText.textContent === "Standalone Mode";
        if (isOffline) {
            try {
                const worksheet = XLSX.utils.json_to_sheet(crawledBids);
                const workbook = XLSX.utils.book_new();
                XLSX.book_append_sheet(workbook, worksheet, "Crawled Tenders");
                XLSX.writeFile(workbook, "crawled_tenders.xlsx");
                logToConsole("Successfully exported Excel sheet client-side.", "success");
            } catch (err) {
                logToConsole(`Error exporting Excel client-side: ${err.message}`, "alert");
            }
        } else {
            window.location.href = getApiUrl("/api/export");
        }
    });

    exportHtmlBtn.addEventListener("click", () => {
        if (crawledBids.length === 0) return;
        logToConsole("Exporting beautiful interactive HTML report...", "system");
        
        const isOffline = globalStatusText.textContent === "Standalone Mode";
        if (isOffline) {
            try {
                let rowsHtml = "";
                crawledBids.forEach(b => {
                    const startupClass = b.startup_relaxation.toLowerCase() === "yes" ? "yes" : "no";
                    const mseClass = b.mse_relaxation.toLowerCase() === "yes" ? "yes" : "no";
                    const isMatch = isCategoryMatching(b.search_category, b.item_category);
                    const warningBadge = isMatch ? "" : `<span class="mismatch-badge">⚠️ Mismatch</span>`;
                    
                    rowsHtml += `
                        <tr>
                            <td style="font-weight: 600; color: var(--accent); font-family: monospace;">${b.bid_number}</td>
                            <td style="color: var(--text-muted); font-size: 11px;">${b.search_category}</td>
                            <td>${b.item_category}${warningBadge}</td>
                            <td>${b.location || "Unknown"}</td>
                            <td style="text-align: center; font-weight: 600;">${b.quantity || "Unknown"}</td>
                            <td><span class="status-pill ${startupClass}">${b.startup_relaxation}</span></td>
                            <td><span class="status-pill ${mseClass}">${b.mse_relaxation}</span></td>
                            <td style="white-space: nowrap;">${b.end_date}</td>
                            <td>${b.ministry}</td>
                            <td><a href="${b.url}" target="_blank">View PDF</a></td>
                        </tr>
                    `;
                });
                
                const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GeM Bid Analyzer Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0b0c10;
            --card-bg: rgba(26, 29, 38, 0.95);
            --border-color: rgba(255, 255, 255, 0.08);
            --primary: #8a2be2;
            --accent: #00f5ff;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --success: #00ff87;
            --success-bg: rgba(0, 255, 135, 0.12);
            --warning: #ffb703;
            --radius: 12px;
        }
        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: 'Outfit', sans-serif;
            margin: 0;
            padding: 24px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
        }
        h1 {
            margin: 0;
            font-size: 24px;
            background: linear-gradient(135deg, var(--text-main) 30%, var(--accent) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        th, td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            text-align: left;
        }
        th {
            color: var(--text-muted);
            font-weight: 600;
            background: rgba(0, 0, 0, 0.2);
        }
        .status-pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
        }
        .status-pill.yes {
            background-color: var(--success-bg);
            color: var(--success);
            border: 1px solid rgba(0, 255, 135, 0.25);
        }
        .status-pill.no {
            background-color: rgba(255, 255, 255, 0.04);
            color: var(--text-muted);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }
        a {
            color: var(--accent);
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>GeM Bid Intelligence - Exported Report</h1>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Generated Client-Side Standalone</p>
        </header>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>Bid Number</th>
                        <th>Search Category</th>
                        <th>Item Category</th>
                        <th>Location</th>
                        <th>Quantity Required</th>
                        <th>Startup Relaxation</th>
                        <th>MSE Relaxation</th>
                        <th>End Date</th>
                        <th>Ministry / Dept</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
                    \${rowsHtml}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;
                
                const blob = new Blob([htmlContent], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "crawled_tenders_report.html";
                a.click();
                URL.revokeObjectURL(url);
                logToConsole("Successfully exported HTML report client-side.", "success");
            } catch (err) {
                logToConsole(`Error exporting HTML client-side: ${err.message}`, "alert");
            }
        } else {
            window.location.href = getApiUrl("/api/export-html");
        }
    });

    // --- helper loggers ---
    
    function logToConsole(text, type = "log") {
        const line = document.createElement("div");
        
        // Dynamic color coding based on message content keywords
        let dynamicType = type;
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes("failed") || lowerText.includes("error") || lowerText.includes("exception") || lowerText.includes("lost") || lowerText.includes("discarded")) {
            dynamicType = "failed";
        } else if (lowerText.includes("timed out") || lowerText.includes("timeout") || lowerText.includes("warning")) {
            dynamicType = "timeout";
        } else if (lowerText.includes("downloading") || lowerText.includes("downloaded") || lowerText.includes("saved successfully") || lowerText.includes("uploading") || lowerText.includes("loaded")) {
            dynamicType = "download";
        } else if (lowerText.includes("success") || lowerText.includes("finished") || lowerText.includes("complete") || lowerText.includes("found")) {
            dynamicType = "success";
        } else if (lowerText.includes("starting") || lowerText.includes("establishing") || lowerText.includes("navigating") || lowerText.includes("submitting")) {
            dynamicType = "info";
        }
        
        line.className = `console-line ${dynamicType}-msg`;
        line.textContent = text;
        terminalConsole.appendChild(line);
        terminalConsole.scrollTop = terminalConsole.scrollHeight;
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    // --- Backend Connection Checking & Polling ---
    const offlineBanner = document.getElementById("offline-banner");
    
    async function checkBackendStatus() {
        const isRunning = globalStatusDot.classList.contains("running");
        try {
            // Ping the backend using a simple HEAD fetch to styles.css
            const response = await fetch(getApiUrl("/styles.css"), { method: "HEAD" });
            if (!isRunning) {
                globalStatusDot.className = "status-indicator online";
                globalStatusText.textContent = "Backend Connected";
            }
            if (offlineBanner) {
                offlineBanner.classList.add("hide");
            }
            return true;
        } catch (err) {
            if (!isRunning) {
                globalStatusDot.className = "status-indicator idle";
                globalStatusText.textContent = "Standalone Mode";
            }
            if (offlineBanner) {
                offlineBanner.classList.remove("hide");
                offlineBanner.classList.add("info-mode");
            }
            return false;
        }
    }

    // Initial check
    checkBackendStatus();
    
    // Poll connection status every 5 seconds
    setInterval(checkBackendStatus, 5000);

    // --- Backend Configuration Dropdown UI handlers ---
    const configBtn = document.getElementById("configure-backend-btn");
    const configDropdown = document.getElementById("backend-config-dropdown");
    const configInput = document.getElementById("config-dropdown-input");
    const saveConfigBtn = document.getElementById("save-config-dropdown-btn");
    const resetConfigBtn = document.getElementById("reset-config-dropdown-btn");

    if (configBtn && configDropdown) {
        // Toggle dropdown visibility
        configBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = configDropdown.classList.contains("hide");
            if (isHidden) {
                // Populate current URL
                const currentUrl = localStorage.getItem("backend_url") || (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? "http://127.0.0.1:8000" : window.location.origin);
                configInput.value = currentUrl;
                configDropdown.classList.remove("hide");
            } else {
                configDropdown.classList.add("hide");
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
            if (configDropdown && !configDropdown.classList.contains("hide") && !configDropdown.contains(e.target) && e.target !== configBtn) {
                configDropdown.classList.add("hide");
            }
        });

        // Save custom backend URL
        saveConfigBtn.addEventListener("click", () => {
            let val = configInput.value.trim();
            if (val) {
                if (!val.startsWith("http://") && !val.startsWith("https://")) {
                    val = "http://" + val;
                }
                localStorage.setItem("backend_url", val);
                logToConsole(`Updated backend API endpoint to: ${val}`, "system");
                configDropdown.classList.add("hide");
                checkBackendStatus();
            }
        });

        // Reset custom backend URL to default
        resetConfigBtn.addEventListener("click", () => {
            localStorage.removeItem("backend_url");
            logToConsole("Reset backend API endpoint to default localhost", "system");
            configDropdown.classList.add("hide");
            checkBackendStatus();
        });
    }

    // --- Mobile QR Code Loader ---
    async function loadMobileQR() {
        const qrCard = document.getElementById("mobile-qr-card");
        const qrImg = document.getElementById("qr-code-img");
        const qrLink = document.getElementById("mobile-url-link");
        
        if (!qrCard || !qrImg || !qrLink) return;
        
        // Only display the QR Code if on PC (localhost or file path)
        const isPC = window.location.hostname === "localhost" || 
                     window.location.hostname === "127.0.0.1" || 
                     window.location.protocol === "file:";
                     
        if (!isPC) {
            qrCard.classList.add("hide");
            return;
        }
        
        try {
            const res = await fetch(getApiUrl("/api/network-info"));
            const data = await res.json();
            if (data.success && data.ips.length > 0) {
                // Find primary IP or fallback
                const hostIp = data.ips[0];
                const mobileUrl = `http://${hostIp}:${data.port}/`;
                
                // Set text and href links
                qrLink.textContent = mobileUrl;
                qrLink.href = mobileUrl;
                
                // Request free QR code image from qrserver API
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mobileUrl)}`;
                
                qrCard.classList.remove("hide");
            }
        } catch (err) {
            console.log("Failed to load network info for QR code", err);
            qrCard.classList.add("hide");
        }
    }
    
    // Load QR Code on startup
    loadMobileQR();

    // --- Standalone Mode Helper: Client-Side Excel Parsing (SheetJS) ---
    function parseExcelClientSide(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (json.length === 0) {
                    logToConsole("Error: The Excel file is empty.", "alert");
                    return;
                }
                
                // Find category column dynamically
                const headers = json[0];
                let targetColIdx = 0;
                for (let i = 0; i < headers.length; i++) {
                    const h = String(headers[i]).toLowerCase();
                    if (h.includes("category") || h.includes("name") || h.includes("keyword") || h.includes("search")) {
                        targetColIdx = i;
                        break;
                    }
                }
                
                const categories = [];
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    if (row && row[targetColIdx]) {
                        const val = String(row[targetColIdx]).trim();
                        if (val) categories.push(val);
                    }
                }
                
                if (categories.length > 0) {
                    // Unique categories filter
                    const uniqueCats = [...new Set(categories)];
                    targetCategories = uniqueCats.map(cat => ({ name: cat, checked: false }));
                    logToConsole(`Successfully loaded ${targetCategories.length} categories client-side.`, "success");
                    renderCategoryList();
                } else {
                    logToConsole("Failed to extract categories from Excel file client-side.", "alert");
                }
            } catch (err) {
                logToConsole(`Error parsing Excel client-side: ${err.message}`, "alert");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // --- Standalone Mode Helper: Mock Crawler Stream Simulation ---
    let isMockCrawlActive = false;

    function triggerMockCrawl(categoriesToCrawl) {
        isMockCrawlActive = true;
        
        // Lock UI controls
        startCrawlBtn.disabled = true;
        startCrawlBtn.classList.add("hide");
        stopCrawlBtn.classList.remove("hide");
        addCategoryBtn.disabled = true;
        manualCategoryInput.disabled = true;
        removeFileBtn.disabled = true;
        headedToggle.disabled = true;
        selectAllCats.disabled = true;
        deselectAllCats.disabled = true;
        categorySearchInput.disabled = true;
        
        tableSearch.disabled = true;
        filterBtns.forEach(btn => btn.disabled = true);
        exportExcelBtn.disabled = true;
        exportHtmlBtn.disabled = true;
        
        crawledBids = [];
        renderResultsTable();
        
        globalStatusDot.className = "status-indicator running";
        globalStatusText.textContent = "Simulating Crawl...";
        
        logToConsole("Establishing connection in standalone View-Only Mode...", "info");
        logToConsole(`> Starting mock crawl process for ${categoriesToCrawl.length} categories...`, "info");
        
        let catIndex = 0;
        
        function processNextCategory() {
            if (!isMockCrawlActive) return;
            
            if (catIndex >= categoriesToCrawl.length) {
                logToConsole("FINISHED: Mock crawl completed successfully!", "success");
                isMockCrawlActive = false;
                closeStream();
                return;
            }
            
            const cat = categoriesToCrawl[catIndex];
            logToConsole(`> Starting crawl for: '${cat}'`, "info");
            
            setTimeout(() => {
                if (!isMockCrawlActive) return;
                logToConsole("Navigating to GeM advance-search page...", "info");
                
                setTimeout(() => {
                    if (!isMockCrawlActive) return;
                    logToConsole(`Typing category: '${cat}'`, "info");
                    
                    setTimeout(() => {
                        if (!isMockCrawlActive) return;
                        logToConsole("Found matching category option. Clicking...", "success");
                        
                        setTimeout(() => {
                            if (!isMockCrawlActive) return;
                            const bidCount = Math.floor(Math.random() * 2) + 1; // 1 to 2 bids
                            logToConsole(`Found ${bidCount} matching bid document link(s) in total.`, "success");
                            
                            let bidIndex = 0;
                            function processNextBid() {
                                if (!isMockCrawlActive) return;
                                if (bidIndex >= bidCount) {
                                    catIndex++;
                                    setTimeout(processNextCategory, 1000);
                                    return;
                                }
                                
                                const bidNum = "GEM/2026/B/" + Math.floor(1000000 + Math.random() * 9000000);
                                logToConsole(`Downloading PDF ${bidIndex+1}/${bidCount}: http://bidplus.gem.gov.in/showbidDocument/${bidNum}`, "download");
                                
                                setTimeout(() => {
                                    if (!isMockCrawlActive) return;
                                    logToConsole("PDF saved and parsed successfully.", "download");
                                    
                                    const locations = ["New Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru", "Hyderabad", "Pune", "Ahmedabad"];
                                    const ministries = ["Ministry of Petroleum & Natural Gas", "Ministry of Defence", "Ministry of Health & Family Welfare", "Ministry of Railways", "Ministry of Education"];
                                    
                                    const mockBid = {
                                        bid_number: bidNum,
                                        search_category: cat,
                                        item_category: cat,
                                        location: locations[Math.floor(Math.random() * locations.length)],
                                        quantity: (Math.floor(Math.random() * 150) + 5) * 100,
                                        startup_relaxation: Math.random() > 0.4 ? "Yes" : "No",
                                        mse_relaxation: Math.random() > 0.4 ? "Yes" : "No",
                                        end_date: new Date(Date.now() + (Math.floor(Math.random() * 10) + 3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                        ministry: ministries[Math.floor(Math.random() * ministries.length)],
                                        url: `https://bidplus.gem.gov.in/showbidDocument/${bidNum}`
                                    };
                                    
                                    crawledBids.push(mockBid);
                                    logToConsole(`SUCCESS: Extracted Bid ${mockBid.bid_number} for '${mockBid.search_category}' (Startup: ${mockBid.startup_relaxation})`, "success");
                                    appendBidToTable(mockBid);
                                    updateResultsSummary();
                                    
                                    bidIndex++;
                                    setTimeout(processNextBid, 600);
                                    
                                }, 600);
                            }
                            
                            processNextBid();
                            
                        }, 800);
                    }, 800);
                }, 800);
            }, 600);
        }
        
        processNextCategory();
    }

    // --- Stop Extraction Handler ---
    stopCrawlBtn.addEventListener("click", () => {
        stopCrawl();
    });

    async function stopCrawl() {
        logToConsole("Stopping extraction process...", "alert");
        
        const isOffline = globalStatusText.textContent.includes("Standalone") || 
                          globalStatusText.textContent.includes("Simulating");
        
        if (isOffline) {
            isMockCrawlActive = false;
            logToConsole("Mock crawl simulation stopped by user.", "alert");
            closeStream();
            return;
        }
        
        try {
            await fetch(getApiUrl("/api/stop-crawl"), { method: "POST" });
        } catch (err) {
            console.error("Error sending stop crawl signal:", err);
        }
        
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        
        logToConsole("Crawl execution stopped by user.", "alert");
        closeStream();
    }
});
