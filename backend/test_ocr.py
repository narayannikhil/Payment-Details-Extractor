from PIL import Image, ImageDraw, ImageFont
import pytesseract
from ocr_service import extract_payment_details

# Create an image with text
img = Image.new('RGB', (400, 300), color = (255, 255, 255))
d = ImageDraw.Draw(img)
text = """
Payment Successful
Paid to John Doe
upi id: johndoe@upi
Amount: Rs 500.00
Transaction ID: T123456789012
Date: 23/02/2026
"""
d.text((10,10), text, fill=(0,0,0))
img.save('dummy_screenshot.png')

# Run OCR on it directly
print("RAW TEXT FROM PIL IMAGE:")
print(pytesseract.image_to_string(img))
print("EXTRACTED DETAILS:")
print(extract_payment_details('dummy_screenshot.png'))
