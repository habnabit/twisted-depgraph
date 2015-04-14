#!/bin/sh
set -e
# fix this if you need it to be more flexible (I don't care right now)
git clone -b gh-pages "https://${GH_TOKEN}@github.com/habnabit/twisted-depgraph"
set -x
python -mpip install virtualenv
python -mvirtualenv ve
ve/bin/python -mpip install -U pip setuptools wheel
git clone https://github.com/twisted/twisted
ve/bin/python -mpip wheel -e 'twisted[all_non_platform]'
ve/bin/python -mpip install -e 'twisted[all_non_platform]'
depgraph_rev=$(git rev-parse HEAD)
twisted_rev=$(git -C twisted rev-parse HEAD)
ve/bin/python twisted-depgraph.py twisted
mv *.json twisted-depgraph
cd twisted-depgraph
git config user.name "Aaron Gallagher via travis-ci"
git config user.email "_@habnab.it"
git add *.json
if git diff-index --quiet --cached HEAD; then
    echo 'nothing to commit'
    exit 0
fi
git commit -m "[travis-ci] Built from twisted ${twisted_rev}.

twisted-depgraph was ${depgraph_rev}."
git push -q origin gh-pages
