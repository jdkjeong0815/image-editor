import os
from PIL import Image

def convert_to_webp(directory):
    files = [f for f in os.listdir(directory) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    if not files:
        print("No suitable images found for conversion.")
        return

    for filename in files:
        file_path = os.path.join(directory, filename)
        name, _ = os.path.splitext(filename)
        output_path = os.path.join(directory, f"{name}.webp")
        
        try:
            with Image.open(file_path) as img:
                # Get dimensions for information
                width, height = img.size
                print(f"Checking {filename} ({width}x{height})...")
                
                # Minimum recommended 4K width for smooth 2x/2.5x zoom is ~4000px
                is_high_res = width >= 3840 or height >= 2160 # 4K standard
                
                # Convert anyway to webp for performance and quality maintenance
                img.save(output_path, "webp", quality=95, lossless=False)
                
                status = "High-Res" if is_high_res else "Standard-Res"
                print(f"Successfully converted {filename} to WebP ({status}) -> {output_path}")
                
        except Exception as e:
            print(f"Failed to convert {filename}: {e}")

if __name__ == "__main__":
    current_dir = os.getcwd()
    print(f"Scanning directory: {current_dir}")
    convert_to_webp(current_dir)
