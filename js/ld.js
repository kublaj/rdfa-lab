(function (exports) {

  if (typeof jsonld === 'undefined' && typeof require === 'function') {
    var jsonld = require('jsonld');
  }

  var CONTEXT = '@context';
  var ID = '@id';
  var TYPE = '@type';
  var CONTAINER = '@container';
  var GRAPH = "@graph";
  var REV = "@rev";

  var compactSync = exports.compactSync = function (source, context) {
    // TODO: make async or promote this version
    var result, error;
    jsonld.compact(source, context, function (err, out) {
      result = out, error = err;
    });
    while (result === undefined && error === undefined) { ; }
    return {result: result, error: error};
  }

  var connect = exports.connect = function (source, context) {
    return new Connector(context).connect(source);
  }

  function Connector(context) {
    this.regularCtx = {};
    this.revs = {};
    this.idKey = ID;
    this.typeKey = TYPE;
    this.idMapKey = null;
    this.idMap = new Volatile();
    this.typeMapKey = null;
    this.typeMap = null;

    for (var key in context) {
      var value = context[key],
        isObj = typeof value === 'object';
      if (value === '@id') {
        this.idKey = key;
      } else if (value === '@type') {
        this.typeKey = key;
      }
      if (isObj && REV in value) {
        this.revs[value[REV]] = key;
      } else if (isObj && value[ID] === GRAPH) {
        if (value[CONTAINER] === ID) {
          this.idMapKey = key;
        } else if (value[CONTAINER] === TYPE) {
          this.typeMapKey = key;
        }
      } else {
        this.regularCtx[key] = value;
      }
    }
  }

  Connector.prototype = {

    connect: function (source) {
      var data = compactSync(source, this.regularCtx);
      if (data.error) { throw data.error; }
      var result = data.result;

      var resources = result[GRAPH] || [result];
      if (this.idMapKey) {
        result[this.idMapKey] = this.idMap;
      }
      if (this.typeMapKey) {
        result[this.typeMapKey] = this.typeMap = new Volatile();
      }
      // TODO: don't mutate; copy keys if hasOwnProperty (even funcs though)
      // .. loop over object or array..
      for (var i in resources) {
        if (resources.hasOwnProperty && resources.hasOwnProperty(i)) {
          this.connectNode(resources[i]);
        }
      }
      // TODO: too complex to add?
      //var self = this;
      //result.add = function (s, p, o) { self.add(s, p, o) };
      //result.remove = function (s, p, o) { self.remove(s, p, o); };
      return result;
    },

    connectNode: function (node) {
      for (var p in node) {
        var o = node[p];
        if (p === this.idKey) {
          this.idMap[o] = node;
        } else if (o instanceof Array) {
          var items = node[p] = [];
          for (var i=0, it=null; it=o[i++];) {
            var ref = this.importNode(it);
            items.push(ref);
            this.addRev(node, p, it);
            if (p === TYPE) {
              this.mapType(o, node);
            }
          }
        } else {
          var ref = node[p] = this.importNode(o);
          this.addRev(node, p, o);
          if (p === this.typeKey) {
            this.mapType(o, node);
          }
        }
      }
    },

    mapType: function (type, node) {
      var types = this.typeMap[type];
      if (types === undefined) {
        types = this.typeMap[type] = [];
      }
      types.push(node);
    },

    importNode: function (node) {
      if (node[this.idKey]) {
        return toRef(this.idMap[node[this.idKey]], this.idKey);
      } else {
        if (node instanceof Object) {
          this.connectNode(node);
        }
        return node;
      }
    },

    addRev: function (subj, p, obj) {
      var revProp = this.revs[p];
      if (revProp) {
        var realObj = this.idMap[obj[this.idKey]];
        var revSet = realObj[revProp];
        if (revSet === undefined) {
          revSet = [];
          revSet.toJSON = function () {};
          realObj[revProp] = revSet;
        }
        if (subj instanceof Object/* && revSet[subj[this.idKey]] === undefined*/) {
          revSet.push(subj);
          //revSet[subj[this.idKey]] = subj;
        }
      }
    }

    /* TODO: too complex to add?
    , add: function (s, p, o) {
      if (typeof s === 'string') {
        this.idMap[s];
      } else if (this.idMap[s[this.idKey] === undefined]) {
        s = importNode(s);
      }
      s[p] = o;
      var oId = o[this.idKey];
      if (oId) {
        if (this.idMap[oId] === undefined) {
          o = this.importNode(o);
        }
        this.addRev(s, p, o);
      }
      if (p === this.typeKey) {
        this.mapType(o, s);
      }
    },

    remove: function (s, p, o) {
      // ...
    }
    */

  };

  function Volatile() {}
  Volatile.prototype = { toJSON: function () {} };

  function toRef(obj, idKey) {
    function Ref() {}
    Ref.prototype = obj;
    var ref = new Ref();
    ref.toJSON = function () { return {"@id": this[idKey]}; };
    return ref;
  }

  //bnodeCounter
  //(new Date().getTime()).toString(16) + bnodeCount

})(typeof exports !== 'undefined'? exports : LD = {});