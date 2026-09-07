from PIL import Image
import sys

def process_image(input_path, output_path):
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size
    
    # Process pixel by pixel
    for y in range(height):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            
            # The icon strokes are dark, so lower luminance means higher opacity.
            # Multiply by 2.5 to increase contrast and reduce edge artifacts.
            alpha = max(0, min(255, int((255 - lum) * 2.5)))
            
            # Set pixel to WHITE with calculated alpha
            img.putpixel((x, y), (255, 255, 255, alpha))
            
    img.save(output_path)
    print(f"Saved processed image to {output_path}")

if __name__ == "__main__":
    process_image(sys.argv[1], sys.argv[2])
