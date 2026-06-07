import os
import json
import asyncio
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Query
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from crawler import GeMTenderCrawler

app = FastAPI(title="GeM Bid Analyzer API")

# Allow CORS so that the dashboard HTML opened as a local static file (file://) can request the backend (localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store results in-memory
crawled_results = []

# Define directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
EXPORT_PATH = os.path.join(BASE_DIR, "crawled_tenders.xlsx")
REPORT_PATH = os.path.join(BASE_DIR, "crawled_tenders_report.html")

# Ensure directories exist
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>GeM Bid Analyzer Dashboard</h1><p>Dashboard HTML not created yet.</p>"

@app.get("/styles.css")
async def serve_root_css():
    css_path = os.path.join(BASE_DIR, "styles.css")
    if os.path.exists(css_path):
        return FileResponse(css_path, media_type="text/css")
    return HTMLResponse("CSS file not found", status_code=404)

@app.get("/main.js")
async def serve_root_js():
    js_path = os.path.join(BASE_DIR, "main.js")
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type="application/javascript")
    return HTMLResponse("JS file not found", status_code=404)

@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
    """Parses Excel and returns the list of categories found."""
    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())
            
        df = pd.read_excel(temp_path)
        os.remove(temp_path)  # Clean up
        
        if df.empty:
            return {"success": False, "error": "The Excel file is empty."}
            
        target_col = None
        for col in df.columns:
            if any(kw in str(col).lower() for kw in ["category", "name", "keyword", "search"]):
                target_col = col
                break
        if target_col is None:
            target_col = df.columns[0]
            
        categories = df[target_col].dropna().astype(str).tolist()
        categories = [c.strip() for c in categories if c.strip()]
        
        return {"success": True, "categories": categories}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/crawl-stream")
async def crawl_stream(categories: str = Query(...), headless: bool = True):
    """Streams live crawling updates and results to the frontend."""
    category_list = [c.strip() for c in categories.split(",") if c.strip()]
    crawler = GeMTenderCrawler(downloads_dir=DOWNLOADS_DIR, headless=headless)
    
    global crawled_results
    crawled_results = []
    
    async def event_generator():
        yield f"data: {json.dumps({'type': 'log', 'message': f'Starting crawl process for {len(category_list)} categories...'})}\n\n"
        
        for category in category_list:
            async for event in crawler.crawl_category(category):
                if event["type"] == "bid_result":
                    crawled_results.append(event["data"])
                yield f"data: {json.dumps(event)}\n\n"
                # Short pause to prevent socket backup
                await asyncio.sleep(0.1)
                
        yield f"data: {json.dumps({'type': 'complete', 'message': 'All categories crawled successfully!'})}\n\n"
        
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/export")
async def export_results():
    """Generates an Excel document from results and returns it."""
    global crawled_results
    if not crawled_results:
        return {"success": False, "error": "No results available to export."}
        
    try:
        df = pd.DataFrame(crawled_results)
        if "success" in df.columns:
            df = df.drop(columns=["success"])
            
        # Clean control characters for Excel compatibility (openpyxl raises error on control chars)
        import re
        clean_re = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F]')
        def clean_val(val):
            if isinstance(val, str):
                return clean_re.sub('', val)
            return val
        for col in df.columns:
            df[col] = df[col].apply(clean_val)
            
        cols = ["bid_number", "search_category", "item_category", "location", "quantity", "startup_relaxation", "mse_relaxation", "end_date", "ministry", "url"]
        df = df[[c for c in cols if c in df.columns]]
        
        df.to_excel(EXPORT_PATH, index=False)
        return FileResponse(EXPORT_PATH, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="crawled_tenders.xlsx")
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/export-html")
async def export_html_results():
    """Generates a self-contained, interactive HTML report of the crawled tenders."""
    global crawled_results
    if not crawled_results:
        return {"success": False, "error": "No results available to export."}
        
    try:
        # Build self-contained HTML page
        html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GeM Bid Analyzer Report</title>
    <!-- Google Fonts: Outfit -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
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
        }}
        body {{
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: 'Outfit', sans-serif;
            margin: 0;
            padding: 24px;
            min-height: 100vh;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        header {{
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
        }}
        h1 {{
            margin: 0;
            font-size: 24px;
            background: linear-gradient(135deg, var(--text-main) 30%, var(--accent) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }}
        .controls {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 16px;
            gap: 12px;
            flex-wrap: wrap;
        }}
        input {{
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            width: 250px;
        }}
        input:focus {{
            outline: none;
            border-color: var(--accent);
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        th, td {{
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            text-align: left;
        }}
        th {{
            color: var(--text-muted);
            font-weight: 600;
            background: rgba(0, 0, 0, 0.2);
        }}
        .status-pill {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }}
        .status-pill.yes {{
            background-color: var(--success-bg);
            color: var(--success);
            border: 1px solid rgba(0, 255, 135, 0.25);
        }}
        .status-pill.no {{
            background-color: rgba(255, 255, 255, 0.04);
            color: var(--text-muted);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }}
        .mismatch-badge {{
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            background-color: rgba(255, 183, 3, 0.1);
            color: var(--warning);
            border: 1px solid rgba(255, 183, 3, 0.25);
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            margin-left: 8px;
            vertical-align: middle;
        }}
        a {{
            color: var(--accent);
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>GeM Bid Intelligence - Exported Report</h1>
            <p style="color: var(--text-muted); font-size: 13px; margin: 4px 0 0 0;">Generated on {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </header>
        
        <div class="card">
            <div class="controls">
                <input type="text" id="search" placeholder="Search bids..." oninput="filterTable()">
                <div style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center;">
                    Total Tenders: <span id="count" style="color: var(--accent); font-weight: 600; margin-left: 4px;">{len(crawled_results)}</span>
                </div>
            </div>
            
            <table id="table">
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
                <tbody id="tbody">
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        const data = {json.dumps(crawled_results)};
        
        function isCategoryMatching(target, extracted) {{
            if (!target || !extracted) return false;
            const clean = (s) => s.toLowerCase()
                .replace(/\\(q\\d+\\)/g, "")
                .replace(/[^a-z0-9]/g, "")
                .trim();
            const t = clean(target);
            const e = clean(extracted);
            return t.includes(e) || e.includes(t);
        }}
        
        function renderTable(list) {{
            const tbody = document.getElementById("tbody");
            tbody.innerHTML = "";
            
            if (list.length === 0) {{
                tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 24px;">No results found</td></tr>`;
                document.getElementById("count").textContent = 0;
                return;
            }}
            
            list.forEach(b => {{
                const tr = document.createElement("tr");
                const startupClass = b.startup_relaxation.toLowerCase() === "yes" ? "yes" : "no";
                const mseClass = b.mse_relaxation.toLowerCase() === "yes" ? "yes" : "no";
                
                const isMatch = isCategoryMatching(b.search_category, b.item_category);
                const warningBadge = isMatch ? "" : `<span class="mismatch-badge" title="Extracted category does not match target category. Please verify manually.">⚠️ Mismatch</span>`;
                
                tr.innerHTML = `
                    <td style="font-weight: 600; color: var(--accent); font-family: monospace;">${{b.bid_number}}</td>
                    <td style="color: var(--text-muted); font-size: 11px;">${{b.search_category}}</td>
                    <td>${{b.item_category}}${{warningBadge}}</td>
                    <td>${{b.location || "Unknown"}}</td>
                    <td style="text-align: center; font-weight: 600;">${{b.quantity || "Unknown"}}</td>
                    <td><span class="status-pill ${{startupClass}}">${{b.startup_relaxation}}</span></td>
                    <td><span class="status-pill ${{mseClass}}">${{b.mse_relaxation}}</span></td>
                    <td style="white-space: nowrap;">${{b.end_date}}</td>
                    <td>${{b.ministry}}</td>
                    <td><a href="${{b.url}}" target="_blank">View PDF</a></td>
                `;
                tbody.appendChild(tr);
            }});
            
            document.getElementById("count").textContent = list.length;
        }}
        
        function filterTable() {{
            const q = document.getElementById("search").value.toLowerCase().trim();
            if (!q) {{
                renderTable(data);
                return;
            }}
            const filtered = data.filter(b => 
                b.bid_number.toLowerCase().includes(q) ||
                b.search_category.toLowerCase().includes(q) ||
                b.item_category.toLowerCase().includes(q) ||
                (b.location && b.location.toLowerCase().includes(q)) ||
                (b.quantity && String(b.quantity).toLowerCase().includes(q)) ||
                b.ministry.toLowerCase().includes(q)
            );
            renderTable(filtered);
        }}
        
        // Initial render
        renderTable(data);
    </script>
</body>
</html>
"""
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            f.write(html_template)
        return FileResponse(REPORT_PATH, media_type="text/html", filename="crawled_tenders_report.html")
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
