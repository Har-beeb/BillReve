from PIL import Image
import sys

def process_image(input_path, output_path):
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size
    
    # Process pixel by pixel
    for y in range(height):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))
            # Calculate luminance
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            
            # For this specific image with black strokes and white bg:
            # Opacity will be higher for darker pixels.
            # alpha = 255 if lum is 0, 0 if lum is 255
            alpha = max(0, min(255, (255 - lum) * 2))  # Multiply by 2 to sharpen edges
            
            # Set to black with calculated alpha
            img.putpixel((x, y), (0, 0, 0, alpha))
            
    img.save(output_path)
    print(f"Saved processed image to {output_path}")

if __name__ == "__main__":
    process_image(sys.argv[1], sys.argv[2])
