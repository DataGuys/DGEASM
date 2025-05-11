#!/bin/bash
# Azure deployment script for EASM Scanner
# This script deploys the EASM scanner to Azure Container Instances

set -e

# Parameters
RESOURCE_GROUP="easm-scanner-rg"
LOCATION="eastus"
CONTAINER_NAME="easm-scanner"
IMAGE_NAME="easm-scanner:latest"
REGISTRY_NAME="easm$(date +%s)"
ACR_SKU="Basic"

# Check if Azure CLI is installed
if ! [ -x "$(command -v az)" ]; then
  echo 'Error: Azure CLI is not installed.' >&2
  exit 1
fi

# Login to Azure if not already logged in
az account show > /dev/null || az login

# Create resource group if it doesn't exist
echo "Creating resource group if it doesn't exist..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
echo "Creating Azure Container Registry..."
az acr create --resource-group $RESOURCE_GROUP --name $REGISTRY_NAME --sku $ACR_SKU --admin-enabled true

# Build and push container image
echo "Building and pushing container image..."
az acr build --registry $REGISTRY_NAME --image $IMAGE_NAME .

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $REGISTRY_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $REGISTRY_NAME --query "passwords[0].value" -o tsv)
ACR_LOGIN_SERVER=$(az acr show --name $REGISTRY_NAME --query "loginServer" -o tsv)

# Deploy to Azure Container Instances
echo "Deploying to Azure Container Instances..."
az container create \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_NAME \
  --image ${ACR_LOGIN_SERVER}/${IMAGE_NAME} \
  --cpu 1 \
  --memory 1.5 \
  --registry-login-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --dns-name-label easm-scanner-$(date +%s) \
  --ports 3000 \
  --environment-variables PORT=3000 NODE_ENV=production LOG_LEVEL=info MAX_CONCURRENCY=10

# Get the FQDN
FQDN=$(az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query ipAddress.fqdn -o tsv)

echo "Deployment completed successfully!"
echo "EASM Scanner is accessible at: http://$FQDN:3000"
echo ""
echo "Try it out with the following curl command:"
echo "curl -X POST http://$FQDN:3000/api/scan -H \"Content-Type: application/json\" -d '{\"url\": \"https://example.com\"}'"