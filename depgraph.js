function buildDepGraph(depData) {
  var pkgs = {};

  function aPkg(name) {
    var pkg = pkgs[name];
    if (pkg === undefined) {
      pkg = {
        name: name,
        deps: [],
        status: 'unported',
        show: true,
      };
      pkgs[name] = pkg;
    }
    return pkg;
  }

  var pkgName, pkg, dep;
  for (pkgName in depData.depgraph) {
    pkg = aPkg(pkgName);
    for (dep in depData.depgraph[pkgName]) {
      pkg.deps.push(dep);
      aPkg(dep);
    }
    pkgs[pkgName] = pkg;
  }

  var nodes = [];
  for (pkgName in pkgs) {
    nodes.push(pkgs[pkgName]);
  }

  var links = [];
  nodes.forEach(function(node) {
    node.deps.forEach(function(depName) {
      if (depName !== node.name) {
        links.push({
          source: node,
          target: pkgs[depName],
        });
      }
    });
    node.weight = node.deps.length;
  });

  return {
    nodes: nodes,
    links: links,
    pkgs: pkgs,
  };
}


d3.json('twisted-deps.json', function(error, depData) {
  var graph = buildDepGraph(depData);

  var width;
  var height;

  var resizeTimeout = null;
  function onResize() {
    width = window.innerWidth - 250;
    height = window.innerHeight;

    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    if (force) {
      resizeTimeout = setTimeout(function() {
        force.size([width, height]);
        d3.select('body > svg')
          .attr('width', width)
          .attr('height', height);
        force.start();
      }, 100);
    }
  }

  window.addEventListener('resize', onResize);
  onResize();

  var svg = d3.select('body').append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g');

  svg.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 0)
    .attr('refY', 5)
    .attr('markerWidth', 10)
    .attr('markerHeight', 10)
    .attr('orient', 'auto')
    .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z');

  var force = d3.layout.force()
    .nodes(graph.nodes)
    .links(graph.links)
    .size([width, height])
    .distance(75)
    .linkStrength(0.3)
    .charge(-75)
    .gravity(0.05)
    .start();

  var showStatuses = {
    'ported': false,
    'unported': true,
    'almost-ported': true,
    'ready': true,
  };

  for (var i = 0; i < 200; i++) {
    force.tick();
  }

  var links = svg.append('g').selectAll('.link');
  var nodes = svg.append('g').selectAll('.node');

  var hover = d3.select('body').append('div').classed('hover', true);
  var hoverTranslate = f.format('translate({0}px,{1}px)',
                                f.compose(f.get('px'), Math.round, f.plus(8)),
                                f.compose(f.get('py'), Math.round, f.plus(-24)));

  var sidebar = d3.select('body').append('div').classed('sidebar', true);
  var searchBox = sidebar.append('input').attr('type', 'text');
  var listBrowser = sidebar.append('ul').classed('list-browser', true).selectAll('li');


  var statusFilter = d3.select('body').append('ul').classed('status-filter', true)
    .selectAll('.statusButton')
    .data(['ported', 'unported', 'almost-ported', 'ready'])
    .enter()
      .append('li')
      .attr('class', f.ident)
      .classed('status', true)
      .classed('selected', function(status) {
        return showStatuses[status];
      })
      .text(f.ident)
      .on('click', function(status) {
        showStatuses[status] ^= 1;
        statusFilter.classed('selected', function(status) {
          return showStatuses[status];
        });
        enterUpdateExit();
      });


  var searchBarInputTimeout = null;
  searchBox.on('keyup', function() {
    if (searchBarInputTimeout !== null) {
      clearTimeout(searchBarInputTimeout);
    }
    searchBarInputTimeout = setTimeout(enterUpdateExit, 100);
  });

  var nodeSizeScale = d3.scale.linear()
    .domain(d3.extent(graph.nodes, f.get('deps.length')))
    .range([4, 20]);


  function getSubgraphFrom(node) {
    var subgraph = [];
    var seen = {};
    var queue = [node];

    while (queue.length > 0) {
      node = queue.pop();
      if (node === undefined || node.name in seen) {
        continue;
      }
      seen[node.name] = true;
      subgraph.push(node);
      queue = queue.concat(node.deps.map(function(pkgName) { return graph.pkgs[pkgName]; }));
    }
    return subgraph;
  }

  function highlightAllConnected(node) {
    resetHighlight();
    getSubgraphFrom(node).forEach(function(node) {
      node.highlight = true;
    });
  }

  function resetHighlight() {
    graph.nodes.forEach(function(node) {
      node.highlight = false;
    });
  }

  function hoverNode(node) {
    hover
      .datum(node)
      .text(f.get('name'))
      .style('-webkit-transform', hoverTranslate)
      .style('transform', hoverTranslate)
      .classed('show', true);

    svg.classed('highlight', true);
    sidebar.classed('highlight', true);

    highlightAllConnected(node);
    nodes.classed('highlight', f.get('highlight'));
    links.classed('highlight', function(d) {
      return d.source.highlight && d.target.highlight;
    });
    listBrowser.classed('highlight', f.get('highlight'));
  }

  function unhoverNode(node) {
    hover.classed('show', false);
    resetHighlight();
    svg.classed('highlight', false);
    sidebar.classed('highlight', false);
  }

  function clickNode(node) {
    if (d3.event.defaultPrevented) return; // ignore drag
    graph.nodes.forEach(function(n) {
      n.show = false;
    });
    getSubgraphFrom(node).forEach(function(n) {
      n.show = true;
    });
    pushBreadcrumb(node.name);
    enterUpdateExit();
  }

  function enterUpdateExit() {
    var search = searchBox.node().value;
    var filteredNodes = graph.nodes.filter(function(d) {
      return d.show && (d.name.indexOf(search) > -1);
    });
    var filteredLinks = graph.links.filter(function(d) {
      return d.source.show && d.target.show &&
             (d.source.name.indexOf(search) > -1) &&
             (d.target.name.indexOf(search) > -1);
    });

    force
      .nodes(filteredNodes)
      .links(filteredLinks);

    nodeSizeScale = d3.scale.linear()
      .domain(d3.extent(filteredNodes, f.get('deps.length')))
      .range([4, 20]);

    links = links.data(filteredLinks, function(d) {
        return d.source.name + '|' + d.target.name;
      });
    links.enter()
      .append('path')
      .classed('link', true);
    links
      .style('stroke-width', function(d) {
        if (showStatuses[d.source.status] && showStatuses[d.target.status]) {
          return 0.5;
        } else {
          return 0;
        }
      })
      .style('stroke', '#000');
    links.exit()
      .remove();

    nodes = nodes.data(filteredNodes, f.get('name'));
    nodes.enter()
      .append('circle')
      .classed('node', true)
      .call(force.drag);
    nodes
      .attr('r', function(d) {
        if (showStatuses[d.status]) {
          return nodeSizeScale(d.deps.length);
        } else {
          return 0;
        }
      })
      .attr('cx', f.compose(f.get('x'), Math.round))
      .attr('cy', f.compose(f.get('y'), Math.round))
      .attr('status', f.get('status'));
    nodes.exit()
      .remove();

    nodes.on('mouseover', hoverNode);
    nodes.on('mouseout', unhoverNode);
    nodes.on('click', clickNode);

    listBrowser = listBrowser.data(filteredNodes);
    listBrowser.enter()
      .append('li');
    listBrowser
      .text(f.get('name'))
      .attr('status', f.get('status'))
      .style('display', function(d) {
        if (showStatuses[d.status]) {
          return 'block';
        } else {
          return 'none';
        }
      });
    listBrowser.exit()
      .remove();

    listBrowser.on('mouseover', hoverNode);
    listBrowser.on('mouseout', unhoverNode);
    listBrowser.on('click', clickNode);

    force.start();
  }

  var breadcrumbs = [];
  var breadcrumbsSelection = d3.select('body')
    .append('ul').classed('breadcrumbs', true)
      .selectAll('li');

  function updateBreadcrumbs() {
    var crumbs = ['root'].concat(breadcrumbs);
    breadcrumbsSelection = breadcrumbsSelection.data(crumbs);
    breadcrumbsSelection.enter()
      .append('li')
        .classed('crumb', true)
    breadcrumbsSelection
      .text(f.ident);
    breadcrumbsSelection.exit()
      .remove();

    breadcrumbsSelection.on('click', function(name) {
      popBreadcrumbsTo(name);
      if (name === 'root') {
        graph.nodes.forEach(function(node) {
          node.show = true;
        });
      } else {
        graph.nodes.forEach(function(node) {
          node.show = false;
        });
        getSubgraphFrom(graph.pkgs[name]).forEach(function(node) {
          node.show = true;
        });
      }
      enterUpdateExit();
    });
  }

  function pushBreadcrumb(name) {
    breadcrumbs.push(name);
    updateBreadcrumbs();
  }
  window.pushBreadcrumb = pushBreadcrumb;

  function popBreadcrumbsTo(name) {
    if (name === 'root') {
      breadcrumbs = [];
      updateBreadcrumbs();
    }
    if (breadcrumbs.indexOf(name) === -1) {
      return;
    }
    while (breadcrumbs[breadcrumbs.length - 1] !== name) {
      breadcrumbs.pop();
    }
    updateBreadcrumbs();
  }
  window.popBreadcrumbsTo = popBreadcrumbsTo;

  updateBreadcrumbs();

  force.on('tick', function() {
    force.nodes().forEach(function(node) {
      if (node.x < 30) node.x += 2;
      if (node.x > width - 30) node.x -= 2;
      if (node.y < 30) node.y += 2;
      if (node.y > height - 30) node.y -= 2;
    });

    nodes
      .attr('cx', f.get('x'))
      .attr('cy', f.get('y'));

    links.each(function(d) {
      var link = d3.select(this);

      var x1 = Math.round(d.source.x);
      var y1 = Math.round(d.source.y);
      var x2 = Math.round(d.target.x);
      var y2 = Math.round(d.target.y);

      var length = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
      var radius = nodeSizeScale(d.target.deps.length);
      radius += 5; // the size of the marker;
      var fraction = radius / length;
      var dx = Math.round((x1 - x2) * fraction);
      var dy = Math.round((y1 - y2) * fraction);

      var fmtString = 'M ' + x1 + ',' + y1 + ' L ' + (x2 + dx) + ',' + (y2 + dy);
      link.attr('d', fmtString);
    });
  });

  d3.json('twisted-ported.json', function(error, portedData) {
    for (var key in  portedData) {
      var status = portedData[key];
      var pkg = graph.pkgs[key];
      if (pkg) {
        pkg.status = status;
      }
    }

    function getReady(node) {
      if (node.status !== 'unported') {
        return;
      }
      var ready = true;
      node.deps.forEach(function(subNode) {
        ready = ready && graph.pkgs[subNode].status === 'ported';
      });
      if (ready) {
        node.status = 'ready';
      }
    }

    graph.nodes.forEach(getReady);
    nodes
      .attr('status', f.get('status'))
      .attr('ready', f.get('ready'));

    enterUpdateExit();
  });
});


var f = {
  get: function(selector) {
    var selectors = selector.split('.');
    var theUndefined = {};
    return function(d) {
      var obj = d;
      for (var i = 0; i < selectors.length; i++) {
        try {
          obj = obj[selectors[i]];
        } catch(e) {
          console.error('Could not get', selector, 'from', d);
          return undefined;
        }
      }
      return obj;
    };
  },

  compose: function(/* functions... */) {
    var funcs = Array.prototype.slice.call(arguments);
    return function(d) {
      var ret = d;
      funcs.forEach(function(fn) {
        ret = fn(ret);
      });
      return ret;
    };
  },

  times: function(/* functors... */) {
    var functors;
    return function(d) {
      var product = d;
      for (var i = 0; i < functors.length; i++) {
        product *= d3.functor(functors[i])(d);
      }
      return product;
    };
  },

  plus: function(/* functors... */) {
    var functors = arguments;
    return function(d) {
      var sum = d;
      for (var i = 0; i < functors.length; i++) {
        sum += d3.functor(functors[i])(d);
      }
      return sum;
    };
  },

  /* Makes a formatting function.
   *
   * The first argument is a format string, like "hello {0}". The rest
   * of the arguments are functors to fill the slots in the format
   * string.
   *
   * Example:
   *   function ident(n) { return n; }
   *   function double(n) { return n * 2; }
   *   var formatter = module.exports.format('{0} * 2 = {1}', ident, double);
   *   formatter(5);  // returns '5 * 2 = 10'
   */
  format: function(fmt /*, args */) {
    var args = Array.prototype.slice.call(arguments, 1).map(d3.functor);

    return function(d) {
      return fmt.replace(/\{[\d\w\.]+\}/g, function(key) {
        // Strip off {}
        key = key.slice(1, -1);
        return args[key](d);
      });
    };
  },

  ident: function(d) {
    return d;
  },
};

function clamp(num, min, max) {
  return Math.max(min, Math.min(num, max));
}
