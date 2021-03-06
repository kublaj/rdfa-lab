(function (exports) {

  var RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  var RDF_TYPE = RDF_NS + "type";
  var RDF_FIRST = RDF_NS + "first";
  var RDF_REST = RDF_NS + "rest";
  var RDF_NIL = RDF_NS + "nil";


  function Graph(mappings) {
    this.nodes = {};
    this.resolve = resolver(mappings);
    this.nextBNodeID = bnodeCounter();
  }
  Graph.prototype = {

    get: function (termOrCURIEorIRI) {
      return this.nodes[this.resolve(termOrCURIEorIRI)];
    },

    getAll: function () {
      var result = [], map = this.nodes;
      for (var id in map) {
        result.push(map[id]);
      }
      return result;
    },

    getByType: function (/*types...*/) {
      var result = [];
      for (var cls=null, i=0; cls=arguments[i++];) {
        result = result.concat(this.get(cls).incoming[RDF_TYPE])
      }
      return result;
    },

    toNode: function (id) {
      if (!id) {
        id = this.nextBNodeID();
      }
      var node = this.nodes[id];
      if (node === undefined) {
        node = this.nodes[id] = new Node(id, this);
      }
      return node;
    },

    importJSON: function (data) {
      ld.importData(this, data);
    },

    toJSON: function () {
      var l = [];
      for (var p in this.nodes) {
        l.push(this.nodes[p]);
      }
      return l;
    }

  };

  function resolver(map) {
    var vocab = null;
    if (typeof map === 'string') {
      vocab = map;
      map = {};
    } else {
      vocab = map["@vocab"];
    }
    return function (termOrCURIEorIRI) {
      var dfn = map[termOrCURIEorIRI];
      if (vocab && termOrCURIEorIRI.indexOf(':') === -1) {
        return vocab + termOrCURIEorIRI;
      } else if (dfn == undefined) {
        var parts = termOrCURIEorIRI.split(':');
        var ns = map[parts[0]];
        if (ns !== undefined) {
          return ns + parts[1];
        }
        return termOrCURIEorIRI;
      }
      return dfn;
    };
  }

  function bnodeCounter() {
    var prefix = "_:gen-" + (new Date().getTime()).toString(16) + "-",
      count = 0;
    return function () {
      return prefix + count++;
    };
  }


  function Node(id, graph) {
    this.id = id;
    this.graph = graph;
    this.properties = {};
    this.incoming = {};
  }
  Node.prototype = {

    objectType: 'Node',

    toString: function () { return this.id; },

    toJSON: function () {
      var o = {}, props = this.properties;
      o[ld.ID] = this.id;
      for (var p in props) {
        o[p] = props[p];
      }
      return o;
    },

    get: function (path) {
      return this.getAll(path)[0];
    },

    getAll: function (path) {
      var params = (typeof path === 'string')? parsePropertyPath(path) : path;
      return this.find(params);
    },

    getType: function () {
      return this.find({term: RDF_TYPE})[0];
    },

    getTypes: function () {
      return this.find({term: RDF_TYPE});
    },

    getInverseOf: function (term) {
      return this.find({inverse: term})[0];
    },

    getAllInverseOf: function (term) {
      return this.find({inverse: term});
    },

    //getList: function (path) {
    //  var l = this.get(path)
    //  return l? l.list : [];
    //},

    find: function (params) {
      if (params.sequence) {
        var found = [this];
        for (var l=params.sequence, it=null, i=0; it=l[i++];) {
          var newfound = [];
          found.forEach(function (node) { newfound = newfound.concat(node.findNodes(it)) })
          found = newfound;
          if (!found) return found;
        }
        return found;
      } else {
        return this.findNodes(params);
      }
    },

    findNodes: function (params) {
      var result;
      if (params.inverse) {
        var iri = this.graph.resolve(params.inverse);
        result = this.incoming[iri];
      } else {
        var iri = this.graph.resolve(params.term);
        result = this.properties[iri];
      }
      if (result === undefined)
        return [];
      else
        return result;
    },

    addLink: function (rel, id) {
      var object = this.graph.toNode(id);
      var rel = this.graph.resolve(rel);
      this.add(rel, toRef(object));
      var rev = object.incoming[rel];
      if (rev === undefined) {
        rev = [];
        object.incoming[rel] = rev;
      }
      if (rev[this.id] === undefined) {
        var ref = toRef(this);
        rev.push(ref);
        rev[this.id] = ref;
      }
    },

    addValue: function (rel, value, lang, datatype) {
      // TODO: check if really literal or coerced...
      var literal = new Literal(value, lang, datatype);
      this.add(rel, literal);
    },

    addList: function (p, list) {
      this.add(p, new List(list, graph));
    },

    /*
    TODO: ...
    setLink: function (rel, id) { },
    setValue: function (rel, value, lang, datatype) { },
    remove...
    */

    add: function (rel, obj) {
      var all = this.properties[rel];
      if (all === undefined) {
        all = this.properties[rel] = [];
      }
      all.push(obj);
    }

  };

  function parsePropertyPath(path) {
    if (path.indexOf('/') > -1) {
      return {sequence: path.split(/\//).map(function (s) {
        return parsePropertyPath(s.trim());
      })};
    } else if (path[0] === '^') {
      return {inverse: path.substring(1)};
    } else {
      return {term: path};
    }
  }

  function toRef(obj) {
    function Ref() {}
    Ref.prototype = obj;
    var ref = new Ref();
    ref.toJSON = function () {
      var o = {}; o[ld.ID] = obj.id; return o;
    };
    return ref;
  }


  function Literal(value, language, datatype, graph) {
    this.value = value;
    this.datatype = datatype;
    this.language = language;
    this.graph = graph;
  }
  Literal.prototype = {

    objectType: 'Literal',

    toString: function () { return this.value; },

    toJSON: function () {
      var o = {};
      o[ld.VALUE] = this.value;
      if (this.type) o[ld.TYPE] = this.datatype;
      if (this.language) o[ld.LANG] = this.language;
      return o;
    },

    asNumber: function () {}, // TODO

    asBoolean: function () {}, // TODO

    asDate: function () {}, // TODO

    asXML: function () {}, // TODO

    asNative: function () {
      return this.asDate() ||
        this.asBoolean() ||
          this.asNumber() ||
            this.toString();
    }

  };


  function List(array, graph) {
    this.list = array;
    this.graph = graph;
  }
  List.prototype = {

    objectType: 'List',

    toJSON: function () {
      var o = {}; o[ld.LIST] = this.list;
      return o;
    },

    get: function (expr) {
      var iri = this.graph.resolve(expr);
      if (iri === RDF_FIRST) {
        return this.list[0];
      } else if (iri === RDF_REST) {
        var rest = this.list.slice(1);
        if (rest.length === 0) {
          new Node(RDF_NIL, this.graph);
        } else {
          return new List(rest, this.graph);
        }
      } else {
        return null;
      }
    }

  };


  var ld = {

    CONTEXT: '@context',
    ID: '@id',
    TYPE: '@type',
    VALUE: '@value',
    LANG: '@language',
    LIST: "@list",
    GRAPH: "@graph",

    importData: function (graph, data) {
      for (var it=null, i=0; it=data[i++];) {
        this.importItem(graph, it);
      }
    },

    importItem: function (graph, item) {
      var node = graph.toNode(item[this.ID]);
      for (var p in item) {
        if (p === this.ID) {
          continue;
        }
        var o = item[p];
        if (o instanceof Array) {
          for (var i=0, it=null; it=o[i++];) {
            this.addItem(graph, node, p, it);
          }
        } else {
          this.addItem(graph, node, p, o);
        }
      }
      return node;
    },

    addItem: function (graph, node, p, item) {
      if (p === this.TYPE) {
        p = RDF_TYPE;
        if (typeof item === 'string') {
          item = {"@id": item};
        }
      }
      if (typeof item === 'string') {
        node.addValue(p, item);
      } else if (item[this.VALUE]) {
        node.addValue(p, item[this.VALUE], item[this.LANG], item[this.TYPE]);
      } else if (item[this.LIST]) {
        var items = item[this.LIST],
          list = [];
        for (var it=null, i=0; it=items[i++];) {
          // FIXME: toRef? Or just add id:s?
          list.push(this.importItem(graph, it));
        }
        node.addList(p, list);
      } else {
        var target = this.importItem(graph, item);
        node.addLink(p, target.id);
      }
    }

  };


  function toGraph(data, mappings) {
    var graph = new Graph(mappings);
    graph.importJSON(data);
    return graph;
  }


  function ns(iri) {
    var combine = function (term) {
      return iri + term;
    }
    for (var l=arguments, it=null, i=1; it=l[i++];) {
      // some function properties, like 'name' are read-only!
      var key = (combine[it] !== undefined)? it + '_' : it;
      combine[key] = iri + it;
    }
    return combine;
  }


  exports.toGraph = toGraph;
  exports.Graph = Graph;
  exports.Node = Node;
  exports.Literal = Literal;
  exports.List = List;
  exports.ns = ns;

})(typeof exports !== 'undefined'? exports : RDF = {});
