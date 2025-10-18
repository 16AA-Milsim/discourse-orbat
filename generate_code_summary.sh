#!/bin/bash

output_file="project_code_summary.txt"

# Clear the output file if it exists
> "$output_file"

# Add date and time stamp at the top of the file
echo "Generated on: $(date)" >> "$output_file"
echo -e "\n" >> "$output_file"

# Add directory tree overview at the beginning (no depth limit)
echo "Directory Tree Overview:" >> "$output_file"
tree >> "$output_file"  # No -L option to remove depth limit
echo -e "\n\n" >> "$output_file"

# Loop through all files with specified extensions
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.html" -o -name "*.es6" -o -name "*.hbs" -o -name "*.scss" -o -name "*.yml" -o -name "*.rb" \) | while read -r file; do
    echo "==== FILE: $file ====" >> "$output_file"
    cat "$file" >> "$output_file"
    echo -e "\n\n" >> "$output_file"
done

echo "Code summary written to $output_file"
