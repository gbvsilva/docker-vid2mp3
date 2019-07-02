FROM node:10-alpine

# Create app directory
WORKDIR /usr/src/vid2mp3

COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 7831

CMD [ "node", "server.js" ]
