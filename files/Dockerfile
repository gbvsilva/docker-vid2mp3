FROM node:10-alpine

# Create app directory
WORKDIR /opt/vid2mp3

COPY package*.json ./

RUN npm install
RUN npm install --save puppeteer

RUN apk add --no-cache ffmpeg \
      chromium \
      nss

# Bundle app source
COPY . .

EXPOSE 80 443 7831

CMD [ "node", "server.js" ]
