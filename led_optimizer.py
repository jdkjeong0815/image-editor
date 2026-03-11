from PIL import Image, ImageEnhance
import os

def optimize_for_led(input_path, output_path):
    try:
        # 이미지 열기
        with Image.open(input_path) as img:
            # 1. 채도 높이기 (LED 전광판에서 색감이 더 풍부하게 보이도록)
            converter = ImageEnhance.Color(img)
            img = converter.enhance(1.4)
            
            # 2. 대비 높이기 (명확한 구분감 생성)
            converter = ImageEnhance.Contrast(img)
            img = converter.enhance(1.3)
            
            # 3. 선명도 높이기 (유화적인 질감을 살리기 위해)
            converter = ImageEnhance.Sharpness(img)
            img = converter.enhance(2.0)
            
            # 4. 밝기 약간 높이기 (전광판의 백라이트를 고려)
            converter = ImageEnhance.Brightness(img)
            img = converter.enhance(1.1)
            
            # 결과 저장
            img.save(output_path, quality=95, subsampling=0)
            print(f"Succeesfully saved optimized image to {output_path}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    input_file = "van_gogh_s_bedroom_in_arles.jpg"
    output_file = "van_gogh_s_bedroom_in_arles_led_optimized.jpg"
    
    if os.path.exists(input_file):
        optimize_for_led(input_file, output_file)
    else:
        print(f"Input file {input_file} not found.")
