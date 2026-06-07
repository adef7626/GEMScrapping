import os
import re
import asyncio
from playwright.async_api import async_playwright
from pypdf import PdfReader

class GeMTenderCrawler:
    def __init__(self, downloads_dir="downloads", headless=True):
        self.downloads_dir = downloads_dir
        self.headless = headless
        os.makedirs(self.downloads_dir, exist_ok=True)

    def parse_gem_pdf(self, pdf_path):
        """Extracts key metadata from a downloaded GeM bid PDF document."""
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                    
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            normalized_text = "\n".join(lines)
            
            # Find Bid Number
            bid_num = "Unknown"
            bid_match = re.search(r'GEM/\d{4}/[BR]/\d+', normalized_text)
            if bid_match:
                bid_num = bid_match.group(0)
                
            # Item Category
            item_category = "Unknown"
            for i, line in enumerate(lines):
                # Match "Item Category" or "ItemCategory", optionally prefixed by slash or whitespace, and capture same-line value
                match = re.search(r'(?:/)?\s*(?:item\s*category|itemcategory)\s*(.*)', line, re.IGNORECASE)
                if match:
                    val = match.group(1).strip()
                    # Remove leading/trailing colons, slashes, hyphens, spaces
                    val = re.sub(r'^[:\-\s/]+', '', val).strip()
                    if val:
                        # Same-line extraction (RA format)
                        item_category = val
                        # Check if next line is a continuation (doesn't start with standard sections)
                        if i + 1 < len(lines):
                            next_line = lines[i+1].strip()
                            if not re.search(r'^(?:auto\s*extension|gemarpts|office\s*name|total\s*quantity|bid\s*details|spl\s*exemption|pre\s*bid|t&c|average|annual|oem|document|compliance)', next_line, re.IGNORECASE):
                                item_category += " " + next_line
                    else:
                        # Next-line extraction (Standard Bid format)
                        if i + 1 < len(lines):
                            item_category = lines[i+1].strip()
                            # If standard bid has multi-line category, check if next line after that should be appended
                            if i + 2 < len(lines):
                                next_line = lines[i+2].strip()
                                if not re.search(r'^(?:gemarpts|office\s*name|total\s*quantity|bid\s*details|startup|mse|evaluation|document|spl\s*exemption|pre\s*bid|t&c|average|annual|oem|compliance|dated|bid\s*number|organisation|buyer|ministry|department|division)', next_line, re.IGNORECASE):
                                    if not re.search(r'^(?:GeMARPTS|मूल|एमएसएमई|ेणी|म\)|के)', next_line, re.IGNORECASE):
                                        item_category += " " + next_line
                    break
                    
            # Startup Relaxation
            startup_relaxation = "No"
            for i, line in enumerate(lines):
                if "startup" in line.lower() and "relaxation" in line.lower():
                    for offset in range(1, 10):
                        if i + offset < len(lines):
                            val = lines[i+offset].strip().lower()
                            if re.search(r'\b(yes)\b', val):
                                startup_relaxation = "Yes"
                                break
                            elif re.search(r'\b(no)\b', val):
                                startup_relaxation = "No"
                                break
                    break
                    
            # MSE Relaxation
            mse_relaxation = "No"
            for i, line in enumerate(lines):
                if "mse" in line.lower() and "relaxation" in line.lower():
                    for offset in range(1, 10):
                        if i + offset < len(lines):
                            val = lines[i+offset].strip().lower()
                            if re.search(r'\b(yes)\b', val):
                                mse_relaxation = "Yes"
                                break
                            elif re.search(r'\b(no)\b', val):
                                mse_relaxation = "No"
                                break
                    break
                    
            # Bid End Date
            end_date = "Unknown"
            for i, line in enumerate(lines):
                if "bid end date/time" in line.lower():
                    if i + 1 < len(lines):
                        end_date = lines[i+1]
                    break
                    
            # Department / Ministry
            ministry = "Unknown"
            for i, line in enumerate(lines):
                if "ministry/state name" in line.lower():
                    if i + 1 < len(lines):
                        ministry = lines[i+1]
                    break
                    
            return {
                "success": True,
                "bid_number": bid_num,
                "item_category": item_category,
                "startup_relaxation": startup_relaxation,
                "mse_relaxation": mse_relaxation,
                "end_date": end_date,
                "ministry": ministry
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def crawl_category(self, category_name):
        """Searches GeM and crawls all tenders matching the category_name."""
        yield {"type": "log", "message": f"Starting crawl for: '{category_name}'"}
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            bid_urls = []
            use_fallback = False
            
            try:
                yield {"type": "log", "message": "Navigating to GeM advance-search page..."}
                await page.goto("https://bidplus.gem.gov.in/advance-search", wait_until="networkidle")
                
                yield {"type": "log", "message": "Interacting with Select2 category dropdown..."}
                await page.click("span.select2-selection")
                await page.wait_for_selector("input.select2-search__field")
                
                yield {"type": "log", "message": f"Typing category: '{category_name}'"}
                await page.fill("input.select2-search__field", category_name)
                
                # Wait for options to load
                await page.wait_for_selector("li.select2-results__option")
                options = await page.query_selector_all("li.select2-results__option")
                
                selected = False
                for opt in options:
                    text = await opt.inner_text()
                    if category_name.lower() in text.lower() or text.lower() in category_name.lower():
                        yield {"type": "log", "message": f"Found matching category option: '{text}'. Clicking..."}
                        await opt.click()
                        selected = True
                        break
                
                if not selected:
                    raise Exception(f"Category '{category_name}' not found in Select2 dropdown list")
                
                await page.wait_for_timeout(2000)
                
                yield {"type": "log", "message": "Submitting search..."}
                search_btn = await page.query_selector("button:has-text('Search')")
                if not search_btn:
                    search_btn = await page.query_selector(".btn-primary")
                
                if search_btn:
                    await search_btn.click()
                else:
                    await page.press("#categorybid", "Enter")
                
                await page.wait_for_timeout(5000)
                
                links = await page.query_selector_all("a")
                for a in links:
                    href = await a.get_attribute("href")
                    if href and ("showbidDocument" in href or "showradocumentPdf" in href):
                        if not href.startswith("http"):
                            if not href.startswith("/"):
                                href = "/" + href
                            href = "https://bidplus.gem.gov.in" + href
                        bid_urls.append(href)
                bid_urls = list(set(bid_urls))
                
                if not bid_urls:
                    yield {"type": "log", "message": "No bids found via advance-search. Falling back to all-bids text search..."}
                    use_fallback = True
            except Exception as e:
                yield {"type": "log", "message": f"Advanced search failed or timed out: {str(e)}. Falling back to all-bids text search..."}
                use_fallback = True
                
            if use_fallback:
                try:
                    yield {"type": "log", "message": "Navigating to GeM all-bids page..."}
                    await page.goto("https://bidplus.gem.gov.in/all-bids", wait_until="networkidle")
                    
                    yield {"type": "log", "message": f"Entering search term in fallback: '{category_name}'"}
                    await page.fill("#searchBid", category_name)
                    await page.press("#searchBid", "Enter")
                    await page.wait_for_timeout(5000)
                    
                    links = await page.query_selector_all("a")
                    for a in links:
                        href = await a.get_attribute("href")
                        if href and ("showbidDocument" in href or "showradocumentPdf" in href):
                            if not href.startswith("http"):
                                if not href.startswith("/"):
                                    href = "/" + href
                                href = "https://bidplus.gem.gov.in" + href
                            bid_urls.append(href)
                    bid_urls = list(set(bid_urls))
                except Exception as ex:
                    yield {"type": "log", "message": f"Fallback search failed: {str(ex)}"}
            
            try:
                yield {"type": "log", "message": f"Found {len(bid_urls)} matching bid document link(s) in total."}
                
                for idx, url in enumerate(bid_urls):
                    doc_id = url.split("/")[-1]
                    pdf_path = os.path.join(self.downloads_dir, f"{doc_id}.pdf")
                    
                    yield {"type": "log", "message": f"Downloading PDF {idx+1}/{len(bid_urls)}: {url}"}
                    
                    try:
                        download_promise = page.wait_for_event("download", timeout=15000)
                        try:
                            await page.goto(url)
                        except Exception as e:
                            if "Download is starting" not in str(e):
                                raise e
                        
                        download = await download_promise
                        await download.save_as(pdf_path)
                        yield {"type": "log", "message": f"PDF saved successfully: {pdf_path}"}
                        
                        # Parse PDF
                        data = self.parse_gem_pdf(pdf_path)
                        if data["success"]:
                            data["url"] = url
                            data["search_category"] = category_name
                            
                            # Delete PDF if it is NOT startup relaxed
                            if data.get("startup_relaxation", "No").lower() != "yes":
                                try:
                                    os.remove(pdf_path)
                                    yield {"type": "log", "message": f"Deleted PDF (not startup relaxed): {doc_id}.pdf"}
                                except Exception as ex:
                                    yield {"type": "log", "message": f"Warning: Failed to delete PDF: {str(ex)}"}
                            
                            yield {
                                "type": "bid_result",
                                "data": data
                            }
                        else:
                            try:
                                os.remove(pdf_path)
                            except:
                                pass
                            yield {"type": "log", "message": f"Warning: Failed to parse PDF: {data['error']}"}
                            
                    except Exception as e:
                        yield {"type": "log", "message": f"Error downloading/parsing {url}: {str(e)}"}
                        
            except Exception as e:
                yield {"type": "log", "message": f"Error during browser operations: {str(e)}"}
            finally:
                await browser.close()
                yield {"type": "log", "message": f"Finished crawling category: '{category_name}'"}
