import re

def clean_name(name_str):
    if not name_str: return None
    name_str = re.sub(r'^[a-z0-9][\s\.]+', '', name_str, flags=re.I)
    for _ in range(5):
        name_str = re.sub(r'[\s\.\-\(\),]+([a-z0-9]*[0-9]+[a-z0-9\(\)]*|[a-z0-9]|@[a-z0-9.]+|SUCCESS\w*|FAILED\w*)$', '', name_str, flags=re.I)
    words = name_str.split()
    filtered_words = [w for w in words if w.lower() not in ["successful", "success", "completed", "details", "paid", "to", "payee", "by"]]
    return " ".join(filtered_words).strip()

def test_extraction(lines):
    full_clean = " ".join(lines)
    amount_candidates = []
    
    def process_amount_str(s):
        s = s.replace("O", "0").replace("Q", "0").replace("o", "0").replace(",", "")
        try:
            val = float(s)
            if s.startswith('7') and len(s) > 1:
                remainder = s[1:]
                try:
                    amount_candidates.append(float(remainder))
                except: pass
            return val
        except: return None

    symbol_pattern = r"(?:Rs\.?|INR|[₹\!ez\(\{\[\]])"
    for line in lines:
        match = re.search(symbol_pattern + r"\s?(\d+[OQo\d]*(?:\.\d{2})?)(?!\d)", line, re.IGNORECASE)
        if match:
            v = process_amount_str(match.group(1))
            if v: amount_candidates.append(v)

    for i, line in enumerate(lines):
        match = re.search(r"[\sze₹7](\d+[OQo\d]*(?:\.\d{2})?)\s*[\]\)\}]?$", line, re.IGNORECASE)
        if match:
            prev_line = lines[i-1].lower() if i > 0 else ""
            if any(kw in prev_line for kw in ["paid", "payee", "to", "receiver", "amount", "total"]) or \
               any(kw in line.lower() for kw in ["paid", "xxxx", "total"]):
                v = process_amount_str(match.group(1))
                if v: amount_candidates.append(v)

    extracted = {}
    if amount_candidates:
        valid = [a for a in amount_candidates if 0 < a < 100000 and a not in [2024, 2025, 2026, 2027, 2028]]
        if valid:
            non_seven = [a for a in valid if not str(int(a)).startswith('7')]
            if non_seven:
                extracted["amount"] = max(non_seven)
            else:
                extracted["amount"] = max(valid)

    receiver_match = re.search(r"(?:paid\s+to|to|payee|receiver)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s\.]{2,60})", full_clean, re.IGNORECASE)
    if receiver_match:
        extracted["receiver_name"] = clean_name(receiver_match.group(1))

    return extracted

# Ganga Case: 50 read as 750
lines2 = ['Transaction Successful', '04:42 pm on 21 Feb 2026', 'Paid to', 'e Ganga pan shop 750', 'Q122785393@ybl']

print(f"Case 2 (Ganga): {test_extraction(lines2)}")
