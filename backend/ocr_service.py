import re
import pytesseract
from PIL import Image, ImageOps, ImageEnhance
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def preprocess_image(image_path: str) -> Image:
    img = Image.open(image_path).convert('RGB')
    img = ImageEnhance.Contrast(img).enhance(2.0)
    img = ImageEnhance.Sharpness(img).enhance(2.0)
    img = ImageOps.grayscale(img)
    return img


def extract_payment_details(image_path: str) -> dict:
    try:
        original_img = Image.open(image_path)
        raw_text = pytesseract.image_to_string(original_img)
        
        # Fallback to preprocessed if raw text is sparse
        if len(raw_text.strip()) < 80:
            prepped = preprocess_image(image_path)
            raw_text += "\n" + pytesseract.image_to_string(prepped)
             
    except Exception as e:
        logger.error(f"OCR Exception: {e}")
        return {"raw_text": "", "extracted": {}, "error": str(e)}

    extracted = {}
    # Remove junk characters but preserve structure
    clean_raw = re.sub(r'[^\x00-\x7F\u20B9]+', ' ', raw_text) 
    lines = [line.strip() for line in clean_raw.split('\n') if line.strip()]
    full_clean = " ".join(lines)
    
    logger.info(f"Cleaned Lines for OCR: {lines}")
    
    def clean_name(name_str):
        if not name_str: return None
        # Remove common OCR artifacts like leading single letters 'e', 'z', 'f', 'q'
        name_str = re.sub(r'^[a-z0-9][\s\.]+', '', name_str, flags=re.I)
        # Remove trailing segments that look like amounts, IDs, or junk
        for _ in range(5):
            name_str = re.sub(r'[\s\.\-\(\),]+([a-z0-9]*[0-9]+[a-z0-9\(\)]*|[a-z0-9]|@[a-z0-9.]+|SUCCESS\w*|FAILED\w*)$', '', name_str, flags=re.I)
        
        # Remove words that are likely status indicators
        words = name_str.split()
        filtered_words = [w for w in words if w.lower() not in ["successful", "success", "completed", "details", "paid", "to", "payee", "by"]]
        name_str = " ".join(filtered_words)
        return name_str.strip()

    # ── Amount ───────────────────────────────────────────────
    amount_candidates = []
    
    # helper to clean and handle '7 artifact'
    def process_amount_str(s):
        s = s.replace("O", "0").replace("Q", "0").replace("o", "0").replace(",", "")
        try:
            val = float(s)
            # Artifact Handler: If it starts with 7 and the remaining digits form a common amount
            # PhonePe often misreads Rupee symbol as '7'
            if s.startswith('7') and len(s) > 1:
                remainder = s[1:]
                if remainder:
                    try:
                        remainder_val = float(remainder)
                        if remainder_val > 0:
                            # We prefer the remainder if it's a "cleaner" number (like 50 vs 750)
                            # or just add both and we'll heuristic them later
                            amount_candidates.append(remainder_val)
                    except: pass
            return val
        except: return None

    # Strategy 1: Symbol/Artifact + Number
    symbol_pattern = r"(?:Rs\.?|INR|[₹\!ez\(\{\[\]])"
    for line in lines:
        match = re.search(symbol_pattern + r"\s?(\d+[OQo\d]*(?:\.\d{2})?)(?!\d)", line, re.IGNORECASE)
        if match:
            v = process_amount_str(match.group(1))
            if v: amount_candidates.append(v)

    # Strategy 2: Line ending near keywords
    for i, line in enumerate(lines):
        match = re.search(r"[\sze₹7](\d+[OQo\d]*(?:\.\d{2})?)\s*[\]\)\}]?$", line, re.IGNORECASE)
        if match:
            prev_line = lines[i-1].lower() if i > 0 else ""
            if any(kw in prev_line for kw in ["paid", "payee", "to", "receiver", "amount", "total"]) or \
               any(kw in line.lower() for kw in ["paid", "xxxx", "total"]):
                v = process_amount_str(match.group(1))
                if v: amount_candidates.append(v)

    # Strategy 3: Just any number on a line
    for line in lines:
        match = re.match(r"^(\d+[OQo\d]*(?:\.\d+)?)$", line)
        if match:
            v = process_amount_str(match.group(1))
            if v: amount_candidates.append(v)

    # Pick the best amount
    if amount_candidates:
        # Heuristic: 
        # 1. Filter out dates and very large numbers
        # 2. Prefer numbers that are NOT starting with 7 if we have a choice
        valid = [a for a in amount_candidates if 0 < a < 100000 and a not in [2024, 2025, 2026, 2027, 2028]]
        if valid:
            # If we have something like [50.0, 750.0], prefer the one that doesn't start with 7
            non_seven = [a for a in valid if not str(int(a)).startswith('7')]
            if non_seven:
                extracted["amount"] = max(non_seven)
            else:
                extracted["amount"] = max(valid)
    
    # ── Transaction ID ───────────────────────────────────────
    txn_match = re.search(r"(?:txn|transaction|ref|utr|google\s+transaction)\s*(?:id|no\.?|number)?\s*[:\-]?\s*([A-Z0-9]{10,40})", full_clean, re.IGNORECASE)
    if txn_match:
        id_candidate = txn_match.group(1).strip()
        if id_candidate.lower() in ["successful", "completed", "failed", "success", "pending", "details"]:
            txn_match = None

    if not txn_match:
        txn_match = re.search(r"(?<!\d)(T[0-9]{15,40}|\d{12})(?!\d)", clean_raw)
        
    if txn_match:
        extracted["transaction_id"] = txn_match.group(1).strip()

    # ── UPI ID ───────────────────────────────────────────────
    upi_match = re.search(r"([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)", full_clean)
    if upi_match:
        extracted["upi_id"] = upi_match.group(1)

    # ── Date ─────────────────────────────────────────────────
    date_match = re.search(r"(?<!\d)(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})(?!\d)", full_clean)
    if not date_match:
        date_match = re.search(r"\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b", full_clean, re.IGNORECASE)
    
    if date_match:
        extracted["date"] = date_match.group(1)

    # ── Names ────────────────────────────────────────────────
    # Receiver
    receiver_match = re.search(r"(?:paid\s+to|to|payee|receiver)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s\.]{2,60})", full_clean, re.IGNORECASE)
    if receiver_match:
        name = clean_name(receiver_match.group(1))
        if name:
            extracted["receiver_name"] = name

    # Sender (Specific PhonePe "Debited from" logic)
    sender_match = re.search(r"(?:from|sender|debited\s+from|by)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s\.]{2,60})", full_clean, re.IGNORECASE)
    if sender_match:
        name = clean_name(sender_match.group(1))
        if name:
             extracted["sender_name"] = name

    # ── Status ───────────────────────────────────────────────
    if any(s in full_clean.lower() for s in ["success", "completed", "successful", "sent"]):
        extracted["status"] = "Success"
    elif "failed" in full_clean.lower():
        extracted["status"] = "Failed"

    return {
        "raw_text": raw_text,
        "extracted": extracted,
    }
