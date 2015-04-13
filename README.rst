================
twisted-depgraph
================

-----
Usage
-----

Run ``./rebuild.sh`` to rebuild the data.
Once that has run successfully, simply view index.html in your browser.

----------
The Script
----------

A little thing based on `Toby Dickenson's py2depgraph
<http://www.tarind.com/py2depgraph.py>`_ for determining the dependency tree of
twisted.

It's generalizable, but I haven't. The purpose of this is for assisting in
python 3 porting: module dependencies as determined from imports are useful in
determining which things have their dependencies ported or not.

The trivial invocation is::

  $ python twisted-depgraph.py /path/to/a/twisted/checkout > depgraph.json

The path passed will not be added to ``sys.path``; if it's not already, you
must add it to ``PYTHONPATH`` yourself. All modules in twisted will be
imported, so this requires the optional dependencies to be installed too.
