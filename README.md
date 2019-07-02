# docker-vid2mp3
Vid2MP3 web server image

Install Docker from https://docs.docker.com/install

E.g. execute:

- `docker pull gbvsilva/vid2mp3`
- `docker run -dit -p 7831:7831 --name vid2mp3 --restart always -v [path_to_host_folder]:/usr/src/vid2mp3 gbvsilva/vid2mp3`

The files already contained in the image:

- index.html
