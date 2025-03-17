#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Setting up Last Ethics Game Server${NC}"
echo -e "${GREEN}=========================================${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Please install Node.js before continuing.${NC}"
    exit 1
fi

# Navigate to server directory
echo -e "\n${GREEN}Navigating to server directory...${NC}"
cd "$(dirname "$0")/server" || {
    echo -e "${YELLOW}Failed to navigate to server directory${NC}"
    exit 1
}

# Install dependencies
echo -e "\n${GREEN}Installing server dependencies...${NC}"
npm install

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}Server setup completed successfully!${NC}"
    echo -e "${GREEN}You can now start the server with:${NC}"
    echo -e "  cd server"
    echo -e "  npm start"
    echo -e "\n${GREEN}For development with auto-restart:${NC}"
    echo -e "  npm run dev"
else
    echo -e "\n${YELLOW}There was a problem installing dependencies.${NC}"
    exit 1
fi

exit 0 