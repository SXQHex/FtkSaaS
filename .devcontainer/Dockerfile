FROM node:26.13.1-bookworm@sha256:893ea48106e988a5f91e69629d6472600daa9d0494adf7db87eb0b886ce82255
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates git curl xz-utils && rm -rf /var/lib/apt/lists/*
RUN npm install --global corepack@0.36.0 && corepack enable
WORKDIR /workspaces/FtkSaaS
