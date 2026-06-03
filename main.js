document.addEventListener("DOMContentLoaded", () => {
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

    // Internal State: targetCategories stores objects: { name: string, checked: boolean }
    let targetCategories = [];
    let crawledBids = [];
    let activeFilter = "all";
    let eventSource = null;

    // Helper: Determine API URL (Absolute localhost if page is opened as static file, otherwise relative)
    function getApiUrl(path) {
        if (window.location.protocol === "file:") {
            return `http://127.0.0.1:8000${path}`;
        }
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
                // Initialize all as checked: true
                targetCategories = data.categories.map(cat => ({ name: cat, checked: true }));
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
        // UI lockups
        startCrawlBtn.disabled = true;
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
        addCategoryBtn.disabled = false;
        manualCategoryInput.disabled = false;
        removeFileBtn.disabled = false;
        headedToggle.disabled = false;
        selectAllCats.disabled = false;
        deselectAllCats.disabled = false;
        categorySearchInput.disabled = false;
        
        globalStatusDot.className = "status-indicator idle";
        globalStatusText.textContent = "System Ready";
        
        if (crawledBids.length > 0) {
            tableSearch.disabled = false;
            filterBtns.forEach(btn => btn.disabled = false);
            exportExcelBtn.disabled = false;
            exportHtmlBtn.disabled = false;
        }
        
        updateResultsSummary();
    }

    // --- table rendering and search filters ---
    
    function renderResultsTable() {
        tableBody.innerHTML = "";
        
        const filtered = applyFilters(crawledBids);
        
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="no-data-cell">
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
            
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--accent);">${bid.bid_number}</td>
                <td style="color: var(--text-muted); font-size: 11px;" title="${bid.search_category}">${bid.search_category}</td>
                <td>${bid.item_category}</td>
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
        
        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--accent);">${bid.bid_number}</td>
            <td style="color: var(--text-muted); font-size: 11px;" title="${bid.search_category}">${bid.search_category}</td>
            <td>${bid.item_category}</td>
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
        window.location.href = getApiUrl("/api/export");
    });

    exportHtmlBtn.addEventListener("click", () => {
        if (crawledBids.length === 0) return;
        logToConsole("Exporting beautiful interactive HTML report...", "system");
        window.location.href = getApiUrl("/api/export-html");
    });

    // --- helper loggers ---
    
    function logToConsole(text, type = "log") {
        const line = document.createElement("div");
        line.className = `console-line ${type}-msg`;
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
});
