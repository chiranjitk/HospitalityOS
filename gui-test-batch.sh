#!/bin/bash
# Quick page tester - takes section param and tests pages
# Usage: bash gui-test-batch.sh "Dashboard" "/" "Overview" "/?section=command-center" "Command Center"
# Each page is: name url name url ...

SECTION="$1"
shift
SCREENSHOT_DIR="/home/z/my-project/gui-test-screenshots"

while [ $# -ge 2 ]; do
  PAGE_NAME="$1"
  URL_PATH="$2"
  shift 2
  
  safe_name=$(echo "$SECTION-$PAGE_NAME" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  screenshot_path="${SCREENSHOT_DIR}/${safe_name}.png"
  
  RESULT=$(agent-browser open "http://localhost:3000${URL_PATH}" 2>&1)
  sleep 2
  
  # Get page title
  PAGE_TITLE=$(agent-browser get title 2>&1)
  
  # Count interactive elements
  INTERACTIVE=$(agent-browser snapshot -i 2>&1 | grep -c "ref=" || echo "0")
  
  # Check for errors
  PAGE_ERRORS=$(agent-browser errors 2>&1 | head -3)
  
  # Screenshot
  agent-browser screenshot "$screenshot_path" 2>/dev/null
  
  # Output result
  if [ "$INTERACTIVE" -gt 0 ]; then
    echo "✅ PASS | $SECTION | $PAGE_NAME | $URL_PATH | $INTERACTIVE interactive elements | title: $PAGE_TITLE"
  else
    echo "⚠️ WARN | $SECTION | $PAGE_NAME | $URL_PATH | 0 interactive elements | title: $PAGE_TITLE"
  fi
  
  if [ -n "$PAGE_ERRORS" ]; then
    echo "   ERRORS: $(echo $PAGE_ERRORS | head -c 200)"
  fi
done
