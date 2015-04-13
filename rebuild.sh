#! /bin/bash

set -e

if [ -d twisted ]; then
    (cd twisted && git pull)
else
    git clone https://github.com/twisted/twisted twisted
fi

[ -d sandbox ] || virtualenv --python=python2 sandbox
sandbox/bin/pip install -e twisted

sandbox/bin/python twisted-depgraph.py twisted
