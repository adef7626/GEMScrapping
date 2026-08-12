import os
import re
import asyncio
from playwright.async_api import async_playwright
from pypdf import PdfReader

class GeMTenderCrawler:
    def __init__(self, downloads_dir="downloads", headless=True):
        self.downloads_dir = downloads_dir
        self.headless = headless
        self.should_stop = False
        os.makedirs(self.downloads_dir, exist_ok=True)

    def is_category_matching(self, target, extracted):
        if not target or not extracted:
            return False
            
        # Strip parentheses contents first for flat comparison
        t_clean = re.sub(r'\([^)]*\)', '', target.lower())
        e_clean = re.sub(r'\([^)]*\)', '', extracted.lower())
        
        # Flat alphanumeric matching (e.g. "methyl di ethanol amine" vs "methyldiethanolamine")
        t_flat = re.sub(r'[^a-z0-9]+', '', t_clean)
        e_flat = re.sub(r'[^a-z0-9]+', '', e_clean)
        
        if t_flat == e_flat:
            return True
            
        # Only allow substring match if they are very close in length (prevent matching "ethanol" in "monoethanolamine")
        if len(t_flat) > 0 and len(e_flat) > 0:
            shorter, longer = sorted([t_flat, e_flat], key=len)
            if shorter in longer and (len(shorter) / len(longer)) >= 0.75:
                return True
                
        # Tokenized matching as a fallback
        t_words = set(re.findall(r'[a-z0-9]+', target.lower()))
        e_words = set(re.findall(r'[a-z0-9]+', extracted.lower()))
        stop_words = {'to', 'is', 'in', 'and', 'for', 'of', 'conforming', 'v1', 'v2', 'v3', 'v4', 'q1', 'q2', 'q3', 'q4'}
        t_words = t_words - stop_words
        e_words = e_words - stop_words
        if not t_words or not e_words:
            return False
            
        intersection = t_words.intersection(e_words)
        overlap = len(intersection) / len(t_words)
        return overlap >= 0.6

    def clean_category_name(self, category):
        # Remove anything in parentheses (e.g., "(MDEA)", "(In Kg)", "(V2)")
        cleaned = re.sub(r'\([^)]*\)', ' ', category)
        # Remove common unit/quantity/version labels (case-insensitive)
        cleaned = re.sub(r'(?i)\b(in\s+(kg|kilograms?|nos|numbers?|ltrs?|litres?|packs?|pcs|pieces?|sets?|bags?|pairs?|box|meters?|mtrs?|pack))\b', ' ', cleaned)
        cleaned = re.sub(r'(?i)\b(v\d+|q\d+)\b', ' ', cleaned)
        # Replace multiple spaces and trim
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def check_text_relevance(self, target_name, text):
        if not target_name or not text:
            return False
        cleaned_target = self.clean_category_name(target_name)
        stop_words = {'to', 'is', 'in', 'and', 'for', 'of', 'conforming', 'v1', 'v2', 'v3', 'v4', 'q1', 'q2', 'q3', 'q4'}
        t_words = set(re.findall(r'[a-z0-9]+', cleaned_target.lower())) - stop_words
        # Filter out short words (< 3 chars) to avoid false matches on "di", "in", etc.
        t_words = {w for w in t_words if len(w) >= 3}
        if not t_words:
            t_words = set(re.findall(r'[a-z0-9]+', cleaned_target.lower())) - stop_words
        
        text_words = set(re.findall(r'[a-z0-9]+', text.lower()))
        return len(t_words.intersection(text_words)) > 0

    def parse_gem_pdf(self, pdf_path):
        """Extracts key metadata from a downloaded GeM bid PDF document."""
        try:
            text = ""
            with open(pdf_path, "rb") as f:
                reader = PdfReader(f)
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
                    
            # Location (Office Name)
            location = "Unknown"
            for i, line in enumerate(lines):
                match = re.search(r'(?:/)?\s*(?:office\s*name)\s*(.*)', line, re.IGNORECASE)
                if match:
                    val = match.group(1).strip()
                    val = re.sub(r'^[:\-\s/]+', '', val).strip()
                    if val:
                        location = val
                    else:
                        if i + 1 < len(lines):
                            location = lines[i+1].strip()
                    break
                    
            # Quantity (Total Quantity)
            quantity = "Unknown"
            for i, line in enumerate(lines):
                match = re.search(r'(?:/)?\s*(?:total\s*quantity)\s*(.*)', line, re.IGNORECASE)
                if match:
                    val = match.group(1).strip()
                    val = re.sub(r'^[:\-\s/]+', '', val).strip()
                    if val:
                        quantity = val
                    else:
                        if i + 1 < len(lines):
                            quantity = lines[i+1].strip()
                    break
                    
            return {
                "success": True,
                "bid_number": bid_num,
                "item_category": item_category,
                "location": location,
                "quantity": quantity,
                "startup_relaxation": startup_relaxation,
                "mse_relaxation": mse_relaxation,
                "end_date": end_date,
                "ministry": ministry,
                "pdf_text": text,
                "pdf_lines": lines
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
                
                cleaned_search_name = self.clean_category_name(category_name)
                
                # Multi-stage dropdown search variations to maximize match chances in Select2
                search_queries = [cleaned_search_name]
                words = cleaned_search_name.split()
                if len(words) > 2:
                    search_queries.append(" ".join(words[:2]))
                longest_word = max(words, key=len) if words else ""
                if longest_word and len(longest_word) >= 4 and longest_word not in search_queries:
                    search_queries.append(longest_word)
                    
                selected = False
                for q_idx, query in enumerate(search_queries):
                    yield {"type": "log", "message": f"Searching category in dropdown (Attempt {q_idx+1}/{len(search_queries)}): '{query}'"}
                    # Clear and fill
                    await page.fill("input.select2-search__field", "")
                    await page.fill("input.select2-search__field", query)
                    
                    try:
                        # Wait for options
                        await page.wait_for_selector("li.select2-results__option", timeout=4000)
                        options = await page.query_selector_all("li.select2-results__option")
                        
                        for opt in options:
                            text = await opt.inner_text()
                            if "searching" in text.lower() or "no results" in text.lower():
                                continue
                            if self.is_category_matching(category_name, text):
                                yield {"type": "log", "message": f"Found matching category option: '{text}'. Clicking..."}
                                await opt.click()
                                selected = True
                                break
                    except Exception:
                        continue
                        
                    if selected:
                        break
                
                if not selected:
                    raise Exception(f"Category '{cleaned_search_name}' and search variants not found in Select2 list")
                
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
                        
                        # Pre-verify text relevance
                        parent_text = await page.evaluate("""el => {
                            let p = el;
                            for (let i = 0; i < 5; i++) {
                                if (p.parentElement) p = p.parentElement;
                                else break;
                            }
                            return p.innerText || "";
                        }""", a)
                        
                        if self.check_text_relevance(category_name, parent_text):
                            bid_urls.append(href)
                        else:
                            doc_id = href.split("/")[-1]
                            yield {"type": "log", "message": f"Pre-filter: skipped unrelated bid {doc_id} (text mismatch on search page)"}
                bid_urls = list(set(bid_urls))
                
                if not bid_urls:
                    yield {"type": "log", "message": f"No active bids found on GeM for category '{category_name}'."}
                    use_fallback = False
            except Exception as e:
                yield {"type": "log", "message": f"Advanced search failed or timed out: Category '{category_name}' not found or matched in dropdown. Skipping..."}
            
            try:
                yield {"type": "log", "message": f"Found {len(bid_urls)} matching bid document link(s) in total."}
                
                for idx, url in enumerate(bid_urls):
                    if getattr(self, "should_stop", False):
                        yield {"type": "log", "message": "Crawl process cancelled by user request."}
                        break
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
                            extracted_cat = data.get("item_category", "Unknown")
                            matched = self.is_category_matching(category_name, extracted_cat)
                            
                            if not matched:
                                # Fallback check for bunched bids: check if target is in full PDF text
                                cleaned_target = re.sub(r'\s*\([vqVQ]\d+\)\s*', ' ', category_name)
                                cleaned_target = re.sub(r'\s+', ' ', cleaned_target).strip().lower()
                                pdf_text = data.get("pdf_text", "").lower()
                                if cleaned_target in pdf_text:
                                    matched = True
                                    # Find matching line in PDF to show as extracted category
                                    for line in data.get("pdf_lines", []):
                                        if cleaned_target in line.lower():
                                            # Clean and use the matching line
                                            extracted_cat = re.sub(r'^[:\-\s/]+', '', line).strip()
                                            data["item_category"] = extracted_cat
                                            break
                            
                            if not matched:
                                yield {"type": "log", "message": f"Discarded mismatched bid {doc_id} (Extracted: '{extracted_cat}' for search target: '{category_name}')"}
                                try:
                                    os.remove(pdf_path)
                                except:
                                    pass
                                continue

                            # Remove text fields from results to save memory/data size
                            if "pdf_text" in data:
                                del data["pdf_text"]
                            if "pdf_lines" in data:
                                del data["pdf_lines"]

                            data["url"] = url
                            data["search_category"] = category_name
                            
                            # Delete PDF after parsing to keep disk space clean
                            try:
                                os.remove(pdf_path)
                                yield {"type": "log", "message": f"Deleted PDF: {doc_id}.pdf"}
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
