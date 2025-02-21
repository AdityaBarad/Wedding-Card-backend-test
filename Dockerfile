FROM ghcr.io/puppeteer/puppeteer:19.7.2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    VITE_SUPABASE_URL=https://qtztpecapbvfzwwfjdik.supabase.co \
    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0enRwZWNhcGJ2Znp3d2ZqZGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyMTg4NDAsImV4cCI6MjA1Mzc5NDg0MH0.m0IhYauDw6dcwF_R4VieEqipFaP5ZFS-zjkJQsc2GdQ


WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
CMD [ "node", "index.js" ]