import sys
import subprocess

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def process_splash():
    img_path = 'assets/images/zopra-splash.png'
    try:
        img = Image.open(img_path).convert("RGBA")
    except Exception as e:
        print("Error opening image:", e)
        return

    width, height = img.size
    
    # Get the background color from the top-left pixel
    bg_color = img.getpixel((0, 0))
    
    # Create a new image data with transparent background
    new_data = []
    for item in img.getdata():
        # Tolerance check for background color
        if abs(item[0] - bg_color[0]) < 10 and abs(item[1] - bg_color[1]) < 10 and abs(item[2] - bg_color[2]) < 10:
            new_data.append((0, 0, 0, 0)) # transparent
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    
    # Find bounding box of non-transparent pixels
    bbox = img.getbbox()
    if bbox:
        # Crop the image to the bounding box with some padding
        padding = 40
        left = max(0, bbox[0] - padding)
        top = max(0, bbox[1] - padding)
        right = min(width, bbox[2] + padding)
        bottom = min(height, bbox[3] + padding)
        
        # Make it a square icon for best results with Expo
        crop_width = right - left
        crop_height = bottom - top
        max_dim = max(crop_width, crop_height)
        
        center_x = left + crop_width // 2
        center_y = top + crop_height // 2
        
        new_left = center_x - max_dim // 2
        new_top = center_y - max_dim // 2
        new_right = center_x + max_dim // 2
        new_bottom = center_y + max_dim // 2
        
        cropped_img = img.crop((new_left, new_top, new_right, new_bottom))
        
        # Save it, replacing the old one
        cropped_img.save('assets/images/zopra-splash.png')
        print(f"Success! Background removed and image cropped. BG color was: {bg_color}")
        
        # Print the background color hex so we can set it in app.json
        hex_color = "#{:02x}{:02x}{:02x}".format(bg_color[0], bg_color[1], bg_color[2])
        print(f"Recommended app.json backgroundColor: {hex_color}")
    else:
        print("Failed to find logo bounds.")

if __name__ == "__main__":
    process_splash()
