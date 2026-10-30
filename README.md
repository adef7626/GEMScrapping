# GeM Bid & Tender Analyzer

An automated, intelligent platform to parse Government e-Marketplace (GeM) bids from an input Excel file, download tender document PDFs, read their contents, and categorize information using AI.

## Project Structure
- `/src` (Source code for parser, downloader, and classifier)
- `/dashboard` (Web dashboard frontend)
- `/storage` (Local storage for downloaded PDFs and extracted JSONs)

## Technical Architecture
1. **Excel Parser**: Read bid details (Bid IDs or URLs) from `.xlsx` files.
2. **Dynamic Downloader (Playwright)**: Navigate the dynamic GeM search, click the target download links, and retrieve the tender PDFs.
3. **Information Extractor**: Use PDF parsing library to read texts and structure them.
4. **Classifier (Gemini API / Rule-based)**: Automatically identify critical bid clauses including:
   - **Startup Relaxation Status** (Yes/No with matching criteria)
   - MSE Exemption
   - Earnest Money Deposit (EMD) values
   - Technical Qualifications & Standards (e.g., IS 15583 for Helium)
   - Prior Turnover / Experience requirements
