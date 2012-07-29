// Generated by CoffeeScript 1.3.1
var RDFaJSON;

(function(exports) {
  var Context, RDFA_IRI, RDF_IRI, RDF_XMLLiteral, XSD_IRI, splitCurie;
  exports.extract = function(doc, base) {
    var extract;
    doc || (doc = window.document);
    extract = new exports.Extract(doc, base);
    extract.run();
    return extract;
  };
  exports.Extract = (function() {

    Extract.name = 'Extract';

    function Extract(doc, base) {
      var baseEl;
      this.doc = doc;
      this.base = base != null ? base : this.doc.documentURI;
      this.profile = 'html';
      this.defaultCtxt = exports.contexts[this.profile];
      if (this.profile === 'html') {
        baseEl = this.doc.getElementsByTagName('base')[0];
        if (baseEl) {
          this.base = baseEl.href;
        }
      }
      this.top = {};
      if (this.base) {
        this.top["@id"] = this.base;
      }
      this.graph = [this.top];
      this.data = {
        '@context': {},
        '@graph': this.graph
      };
      this.resolver = this.doc.createElement('a');
      this.bnodeCounter = 0;
    }

    Extract.prototype.toJSON = function() {
      return this.data;
    };

    Extract.prototype.run = function() {
      this.parseElement(this.doc.documentElement, this.top, null, {});
    };

    Extract.prototype.parseElement = function(el, current, vocab, hanging) {
      var child, next, _i, _len, _ref, _ref1;
      if (el.attributes != null) {
        _ref = this.nextState(el, current, vocab, hanging), next = _ref[0], vocab = _ref[1], hanging = _ref[2];
      }
      _ref1 = el.childNodes;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        child = _ref1[_i];
        if (child.nodeType === 1) {
          this.parseElement(child, next, vocab, hanging);
        }
      }
    };

    Extract.prototype.nextState = function(el, current, vocab, hanging) {
      var attrs, ctxt, datatype, i, inlist, item, items, key, l, next, ns, pfx, pfxs, predicate, rev, sub, tagName, type, types, value, _i, _j, _k, _l, _len, _len1, _len2, _ref, _ref1, _ref10, _ref11, _ref12, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
      attrs = el.attributes;
      ctxt = new Context(this.defaultCtxt, this.data['@context'], current);
      tagName = el.nodeName.toLowerCase();
      if ((_ref = attrs.vocab) != null ? _ref.value : void 0) {
        vocab = attrs.vocab.value;
        ctxt.update('rdfa', RDFA_IRI);
        this.top['rdfa:usesVocabulary'] = {
          '@id': vocab
        };
      }
      if ((_ref1 = attrs.prefix) != null ? _ref1.value : void 0) {
        pfxs = attrs.prefix.value.replace(/^\s+|\s+$/g, "").split(/:?\s+/);
        for (i = _i = 0, _ref2 = pfxs.length; _i < _ref2; i = _i += 2) {
          pfx = pfxs[i];
          ns = pfxs[i + 1];
          ctxt.update(pfx, ns);
        }
        if ((_ref3 = attrs.lang) != null ? _ref3.value : void 0) {
          ctxt.update('@language', attrs.lang.value);
        }
      }
      if (attrs.resource != null) {
        next = {
          '@id': this.resolve(attrs.resource.value)
        };
      } else if (attrs.href != null) {
        next = {
          '@id': el.href
        };
      } else if (attrs.src != null) {
        next = {
          '@id': this.resolve(attrs.src.value)
        };
      } else if (attrs.about != null) {
        next = {
          '@id': this.resolve(attrs.about.value)
        };
      }
      if (!next && attrs["typeof"]) {
        if (this.profile === 'html' && tagName === 'head' || tagName === 'body') {
          next = {
            '@id': this.top['@id']
          };
        } else {
          next = {};
        }
      }
      predicate = ((_ref4 = attrs.property) != null ? _ref4.value : void 0) || ((_ref5 = attrs.rel) != null ? _ref5.value : void 0) || hanging.rel;
      if (predicate) {
        datatype = (_ref6 = attrs.datatype) != null ? _ref6.value : void 0;
        if (next) {
          value = next;
        } else if (attrs.property) {
          if (attrs.content != null) {
            value = attrs.content.value;
          } else if (this.profile === 'html' && tagName === 'time') {
            if (attrs.datetime != null) {
              value = attrs.datetime.value;
            } else {
              value = el.textContent;
            }
            ctxt.update('xsd', XSD_IRI);
            datatype = value.indexOf('T') > -1 ? 'xsd:dateTime' : 'xsd:date';
          }
        }
        if (!value && !(attrs.rel || attrs.rev || hanging.rel || hanging.rev)) {
          if (ctxt.expand((_ref7 = attrs.datatype) != null ? _ref7.value : void 0) === RDF_XMLLiteral) {
            value = el.innerHTML;
          } else {
            value = el.textContent;
          }
        }
        if (datatype != null) {
          value = {
            '@value': value
          };
          if (datatype) {
            value['@type'] = datatype;
          }
        }
      }
      if (attrs["typeof"]) {
        types = attrs["typeof"].value.split(/\s+/);
        for (_j = 0, _len = types.length; _j < _len; _j++) {
          type = types[_j];
          if (vocab && type.indexOf(':') === -1) {
            ctxt.update(type, vocab + type);
          }
        }
        (next || current)['@type'] = types;
      }
      inlist = (attrs.inlist !== void 0) || (hanging.rel && hanging.inlist);
      if (value) {
        if (predicate) {
          _ref8 = predicate.split(/\s+/);
          for (i = _k = 0, _len1 = _ref8.length; _k < _len1; i = ++_k) {
            key = _ref8[i];
            key = ctxt.storedKey(key, vocab);
            if (key) {
              if (current[key]) {
                items = current[key];
                if (inlist) {
                  if (items instanceof Array) {
                    if (items[0]['@list']) {
                      items = items[0]['@list'];
                    } else {
                      l = [];
                      items.unshift({
                        '@list': l
                      });
                      items = l;
                    }
                  } else {
                    items = items['@list'];
                  }
                }
              } else {
                items = [];
                current[key] = inlist ? {
                  '@list': items
                } : items;
              }
              item = this.itemOrRef(value, i);
              items.push(item);
            }
          }
        }
        rev = ((_ref9 = attrs.rev) != null ? _ref9.value : void 0) || hanging.rev;
        if (rev) {
          _ref10 = rev.split(/\s+/);
          for (i = _l = 0, _len2 = _ref10.length; _l < _len2; i = ++_l) {
            key = _ref10[i];
            key = ctxt.storedKey(key, vocab);
            item = this.itemOrRef(current, true);
            items = value[key] || (value[key] = []);
            items.push(item);
            if (!predicate) {
              this.graph.push(value);
            }
          }
        }
        hanging = {};
      } else if (attrs.rel || attrs.rev) {
        hanging = {
          rel: (_ref11 = attrs.rel) != null ? _ref11.value : void 0,
          rev: (_ref12 = attrs.rev) != null ? _ref12.value : void 0,
          inlist: attrs.inlist !== void 0
        };
      } else if (next) {
        if (((function() {
          var _len3, _m, _ref13, _results;
          _ref13 = el.childNodes;
          _results = [];
          for (_m = 0, _len3 = _ref13.length; _m < _len3; _m++) {
            sub = _ref13[_m];
            if (sub.nodeType === 1) {
              _results.push(sub);
            }
          }
          return _results;
        })()).length) {
          this.graph.push(next);
        }
      }
      if (!next) {
        next = current;
      }
      return [next, vocab, hanging];
    };

    Extract.prototype.resolve = function(ref) {
      this.resolver.href = ref;
      return this.resolver.href;
    };

    Extract.prototype.itemOrRef = function(value, asRef) {
      var id;
      if (asRef && typeof value === 'object' && !value['@value']) {
        id = value['@id'] || (value['@id'] = this.nextBNode());
        return {
          '@id': id
        };
      } else {
        return value;
      }
    };

    Extract.prototype.nextBNode = function() {
      return '_:GEN' + this.bnodeCounter++;
    };

    return Extract;

  })();
  Context = (function() {

    Context.name = 'Context';

    function Context(defaultCtxt, rootCtxt, current) {
      this.defaultCtxt = defaultCtxt;
      this.rootCtxt = rootCtxt;
      this.current = current;
      this.localCtxt = {};
    }

    Context.prototype.update = function(key, ref) {
      var ctxt;
      ctxt = this.rootCtxt;
      if (this.rootCtxt[key] && this.rootCtxt[key] !== ref) {
        ctxt = this.current['@context'] = this.localCtxt;
      }
      return ctxt[key] = ref;
    };

    Context.prototype.storedKey = function(key, vocab) {
      var iri, splitPos;
      splitPos = key != null ? key.indexOf(':') : void 0;
      if (splitPos > -1) {

      } else {
        if (vocab) {
          iri = vocab + key;
          this.update(key, iri);
        } else {
          return null;
        }
      }
      return key;
    };

    Context.prototype.get = function(key) {
      return this.rootCtxt[key] || this.localCtxt[key];
    };

    Context.prototype.expand = function(termOrCurieOrIri) {
      if (!termOrCurieOrIri) {
        return null;
      }
      if (termOrCurieOrIri.indexOf(':') === -1) {
        return this.get(termOrCurieOrIri);
      } else {
        return this.expandCurieOrIri(termOrCurieOrIri);
      }
    };

    Context.prototype.expandCurieOrIri = function(curieOrIri) {
      var ns, pfx, term, _ref;
      _ref = splitCurie(curieOrIri), pfx = _ref[0], term = _ref[1];
      if (term.slice(0, 2) === "//") {
        return curieOrIri;
      }
      ns = get([parts[0]]);
      if (ns !== void 0) {
        return ns + parts[1];
      }
      return curieOrIri;
    };

    return Context;

  })();
  exports.contexts = {
    html: {
      "grddl": "http://www.w3.org/2003/g/data-view#",
      "ma": "http://www.w3.org/ns/ma-ont#",
      "owl": "http://www.w3.org/2002/07/owl#",
      "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      "rdfa": "http://www.w3.org/ns/rdfa#",
      "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
      "rif": "http://www.w3.org/2007/rif#",
      "skos": "http://www.w3.org/2004/02/skos/core#",
      "skosxl": "http://www.w3.org/2008/05/skos-xl#",
      "wdr": "http://www.w3.org/2007/05/powder#",
      "void": "http://rdfs.org/ns/void#",
      "wdrs": "http://www.w3.org/2007/05/powder-s#",
      "xhv": "http://www.w3.org/1999/xhtml/vocab#",
      "xml": "http://www.w3.org/XML/1998/namespace",
      "xsd": "http://www.w3.org/2001/XMLSchema#",
      "cc": "http://creativecommons.org/ns#",
      "ctag": "http://commontag.org/ns#",
      "dc": "http://purl.org/dc/terms/",
      "dcterms": "http://purl.org/dc/terms/",
      "foaf": "http://xmlns.com/foaf/0.1/",
      "gr": "http://purl.org/goodrelations/v1#",
      "ical": "http://www.w3.org/2002/12/cal/icaltzd#",
      "og": "http://ogp.me/ns#",
      "rev": "http://purl.org/stuff/rev#",
      "sioc": "http://rdfs.org/sioc/ns#",
      "v": "http://rdf.data-vocabulary.org/#",
      "vcard": "http://www.w3.org/2006/vcard/ns#",
      "schema": "http://schema.org/",
      "describedby": "http://www.w3.org/2007/05/powder-s#describedby",
      "license": "http://www.w3.org/1999/xhtml/vocab#license",
      "role": "http://www.w3.org/1999/xhtml/vocab#role"
    }
  };
  RDF_IRI = exports.contexts.html.rdf;
  RDF_XMLLiteral = RDF_IRI + 'XMLLiteral';
  XSD_IRI = exports.contexts.html.xsd;
  RDFA_IRI = exports.contexts.html.rdfa;
  return splitCurie = function(expr) {
    var i;
    i = expr.indexOf(':');
    return [expr.substring(0, i), expr.substring(i + 1)];
  };
})(typeof exports !== "undefined" && exports !== null ? exports : RDFaJSON = {});
