#!/bin/bash
set -e

echo "🔧 Denizen Installer"
echo ""

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting."; exit 1; }

# Get the script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "📝 Creating .env from example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set your AUTH_PASSWORD!"
    echo "   nano .env"
    echo ""
  else
    echo "❌ .env.example not found. Cannot create .env"
    exit 1
  fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Get port from .env for display
PORT=$(grep -E "^PORT=" .env 2>/dev/null | cut -d'=' -f2 || echo "3456")
SERVICE_NAME="denizen"

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Edit .env and set your AUTH_PASSWORD:"
echo "   nano $SCRIPT_DIR/.env"
echo ""
echo "2. (Optional) Install as a systemd service:"
echo "   sudo cp $SCRIPT_DIR/denizen.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable $SERVICE_NAME"
echo "   sudo systemctl start $SERVICE_NAME"
echo ""
echo "3. Or run directly:"
echo "   npm start"
echo ""
echo "   Then open: http://localhost:$PORT"
echo ""
