#!/bin/bash
# EASM Scanner Installation Script
# This script clones the repository and deploys the scanner to Azure

set -e

# Display banner
echo "=============================================="
echo "  EASM Scanner - One-Click Azure Deployment   "
echo "=============================================="
echo ""

# Check if Git is installed
if ! [ -x "$(command -v git)" ]; then
  echo 'Error: Git is not installed. Installing Git...'
  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
fi

# Check if Azure CLI is installed
if ! [ -x "$(command -v az)" ]; then
  echo 'Error: Azure CLI is not installed. Installing Azure CLI...'
  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
fi

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
echo "Working in temporary directory: $TEMP_DIR"
cd $TEMP_DIR

# Clone the repository
echo "Cloning EASM Scanner repository..."
git clone https://github.com/yourusername/easm-solution.git
cd easm-solution

# Make deployment script executable
chmod +x ./infra/azure/scripts/deploy.sh

# Execute the deployment script
echo "Starting deployment to Azure..."
./infra/azure/scripts/deploy.sh

echo ""
echo "Installation completed!"
echo "You can now use the EASM Scanner to identify vulnerabilities in your external attack surface."