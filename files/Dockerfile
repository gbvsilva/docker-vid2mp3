FROM node:10-alpine

# Create app directory
ARG CWD="/opt/vid2mp3"
WORKDIR $CWD

# === Installing dependencies ===
RUN apk add --no-cache coreutils cmake cmake-doc chromium nasm perl python git g++ make automake autoconf lame-dev x264-dev gnutls-dev opus-dev libass-dev freetype-dev sdl2-dev libtool libva-dev libvpx-dev libvdpau-dev libvorbis-dev libxcb-dev pkgconfig doxygen musl-dev texinfo zlib-dev

# === Installing FFmpeg and aom manually ===

# FFmpeg
RUN wget https://ffmpeg.org/releases/ffmpeg-4.1.4.tar.bz2 && tar -xf ffmpeg-4.1.4.tar.bz2
RUN git clone https://aomedia.googlesource.com/aom
RUN mkdir -p aom_build
RUN cd aom_build && cmake -G "Unix Makefiles" -DMAKE_INSTALL_PREFIX="$CWD/ffmpeg-4.1.4" -DENABLE_SHARED=off -DENABLE_NASM=on ../aom
RUN cd aom_build && make && make install

RUN cp -r /usr/local/lib64/* /usr/local/lib/
RUN cd ffmpeg-4.1.4 && ./configure --enable-gnutls --enable-gpl --enable-libmp3lame --enable-libaom --enable-libass --enable-libopus --enable-libvorbis --enable-libx264 --enable-libvpx --enable-libfreetype --disable-stripping --disable-librtmp --disable-debug
RUN cd ffmpeg-4.1.4 && make && make install
RUN rm -rf aom* ffmpeg-4.1.4*

# === Preparing node environment ===

COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 80 443

CMD [ "node", "server.js" ]
