<h1 align="center">LittleTravis</h1>
Run travis-ci locally using Docker.

# Install
```
npm i -g littletravis
```

# Usage
Run `littletravis` command in a folder with `.travis.yml` file.
```
$ littletravis
```

# Limitation
For now, it just works with `language: node_js` and no support for matrices.

Other language could possibly be added with [these docker images](https://docs.travis-ci.com/user/common-build-problems/#running-a-container-based-docker-image-locally).