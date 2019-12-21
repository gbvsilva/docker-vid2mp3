FROM alpine:edge

# Create app directory
ARG CWD="/opt/vid2mp3"
WORKDIR $CWD

# === Installing node, npm and chromium ===
RUN apk add --no-cache nodejs npm chromium

# === Preparing node environment ===

COPY package*.json ./

# Bundle app source
COPY . .

RUN npm install
RUN chmod +x vid2mp3.sh
RUN mv vid2mp3.sh /

EXPOSE 8000

ENTRYPOINT ["/vid2mp3.sh"]
