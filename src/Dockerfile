FROM alpine:edge

# Create app directory
ARG CWD="/opt/vid2mp3"
RUN chmod +x vid2mp3.sh

WORKDIR $CWD

# === Installing Wget and FFmpeg ===
RUN apk add --no-cache nodejs npm chromium

# === Preparing node environment ===

COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 8000

ENTRYPOINT ["/opt/vid2mp3/vid2mp3.sh"]
