# docker-vid2mp3
Vid2MP3 web server image

Install Docker from https://docs.docker.com/install.

E.g. execute:

- `docker pull gbvsilva/vid2mp3`
- `docker run -dit -p 7831:7831 --name vid2mp3 --restart always gbvsilva/vid2mp3`

The files already contained in the image:

- index.html

To manipulate files locally it is needed to mount a volume on the host with same files on the container path.
