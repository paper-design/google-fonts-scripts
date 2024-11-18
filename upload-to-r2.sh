





#!/bin/bash

# Load .env file if it exists
if [ -f .env ]; then
    source .env
fi

BUCKET="${R2_BUCKET}"
# You'll need to move the PNG or SVG files you want into this folder
# (R2 will match the folder name so use what you want the path to be in R2)
SOURCE_DIR="./output/google-font-preview/avif"
# Change to either image/svg+xml or image/png or image/avif or the images won't serve correctly from R2
CONTENT_TYPE="image/avif"

# Loop through all files in the directory and subdirectories
find "$SOURCE_DIR" -type f -print0 | while IFS= read -r -d '' file; do
    # Get the relative path from SOURCE_DIR
    relative_path=${file#"$SOURCE_DIR/"}

    # Upload the file
    echo "Uploading: $relative_path"
    bunx wrangler r2 object put "$BUCKET/google-font-preview/avif/$relative_path" --file="$file" --ct="$CONTENT_TYPE"
done

















