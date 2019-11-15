FROM node:10-alpine

# Create app directory
ARG CWD="/opt/vid2mp3"
WORKDIR $CWD

# === Installing Wget and FFmpeg ===
RUN apk add --no-cache wget ffmpeg

# === Preparing node environment ===

COPY package*.json ./

RUN npm install
RUN chmod +x vid2mp3.sh

# Bundle app source
COPY . .

EXPOSE 8000

ENTRYPOINT ["/opt/vid2mp3/vid2mp3.sh"]
