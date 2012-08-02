((exports) ->

  RDF_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  RDF_XML_LITERAL = RDF_IRI + 'XMLLiteral'
  RDFA_USES_VOCAB = "http://www.w3.org/ns/rdfa#usesVocabulary"


  extract = (doc, base, profile='html') ->
    state = builder.init(doc, base, profile)
    walk(doc.documentElement, state)
    return builder.complete(state)

  walk = (el, state) ->
    if el.attributes.length
      subState = builder.visit(el, state)
    for child in el.childNodes
      if child.nodeType is 1
        walk(child, subState or state)


  nextBNode = null

  builder =

    init: (doc, base, profile) ->
      nextBNode = bnodeCounter()
      resolver = doc.createElement('a')
      resolveURI = (ref) ->
        resolver.href = ref
        return resolver.href
      if doc.getElementsByTagName('base').length
        base = resolveURI('')
      state = new State(base, profile, resolveURI)
      docObj = {"@id": base}
      all = {}
      all[base] = docObj
      #context = {}
      state.current = docObj
      state.result = {all: all}
      return state

    visit: (el, state) ->
      desc = new Description(el, state)
      res = state.result
      current = state.current
      nextObj = null

      if desc.usesVocab
        baseObj = getOrCreate(res, state.base)
        addPropToObj(baseObj, RDFA_USES_VOCAB, desc.usesVocab)

      types = desc.types

      s = desc.getSubject()
      if s
        current = getOrCreate(res, s)

      o = desc.getReference()
      if o
        unless desc.propertiesAsLinks and not types
          nextObj = getOrCreate(res, o)

      if types
        typed = if desc.about then current else nextObj
        for type in types
          addPropToObj(typed, "@type", type)

      if o
        for link in desc.getLinks()
          addPropToObj(current, link, {"@id": o})
        revs = desc.getRevLinks()
        if revs.length
          subjRef = {"@id": s or current["@id"]}
          for rev in revs
            addPropToObj(nextObj or getOrCreate(res, o), rev, subjRef)

      value = desc.getLiteral()
      if value
        for prop in desc.getValueProperties()
          addPropToObj(current, prop, value)

      subState = desc.state
      #nextListMap
      #nextHangSubject, nextHangRel, nextHangRev
      subState.current = nextObj or current
      return subState

    complete: (state) ->
      items = []
      for s, obj of state.result.all
        add = true
        if obj["@id"]
          add = false
          for key of obj
            if key != "@id"
              add = true
              break
        if add
          items.push(obj)
      items
      #{'@context': state.result.context, '@graph': items}


  getOrCreate = (res, id) ->
      obj = res.all[id]
      unless obj
        obj = res.all[id] = {"@id": id}
      obj

  addPropToObj = (obj, prop, value) ->
    values = obj[prop]
    unless values
      values = obj[prop] = []
    values.push(value)


  class State
    constructor: (@base, @profile, resolveURI) ->
      @mapper = new Mapper(null, contexts[@profile])
      @lang = null
      @lists = {}
      @hanging = {rels: [], revs: [], lists: []}
      @result = null
      @current = null
      @resolveURI = resolveURI

    createInherited: (base, lang, vocab, prefixes) ->
      subState = inherit(this)
      subState.lang = if lang? then lang else @lang
      subState.mapper = @mapper.createInherited(vocab, prefixes)
      return subState

    expandTermOrCurieOrIRI: (expr) ->
      @mapper.expandTermOrCurieOrIRI(expr)

    expandCurieOrIRI: (expr) ->
      @mapper.expandCurieOrIRI(expr)

    expandAndResolve: (curieOrIri) ->
      @resolveURI(@expandCurieOrIRI(curieOrIri))


  class Mapper
    constructor: (@vocab=null, @map={}) ->

    createInherited: (vocab, prefixes) ->
      vocab ?= @vocab
      subMap = inherit(@map)
      for pfx, iri of prefixes
        subMap[pfx] = iri
      return new Mapper(vocab, subMap)

    expandTermOrCurieOrIRI: (expr) ->
      iri = @map[expr]
      if iri
        return iri
      else if expr.indexOf(":") is -1
        if @vocab
          return @vocab + expr
        else
          return null
      else
        return @expandCurieOrIRI(expr)

    expandCurieOrIRI: (expr) ->
      i = expr.indexOf(':')
      if i is -1
        return expr
      pfx = expr.substring(0, i)
      term = expr.substring(i + 1)
      if pfx is '_'
        return expr
      if term.slice(0, 2) is "//"
        return expr
      ns = @map[pfx]
      if ns
        return ns + term
      return expr


  ##
  # A representation of the interpreted description formed by the logical
  # attributes of an element. Use this to produce triples.
  class Description
    constructor: (el, parentState) ->
      #@data =
      data = new ElementData(el, parentState)
      @usesVocab = data.getVocab()
      @state = data.state
      @tagName = data.tagName
      #@mapper = data.mapper
      @about = data.getAbout()
      @resource = data.getResource()
      @types = data.getTypes()
      @properties = data.getProperties()
      @rels = data.getRels()
      @revs = data.getRevs()
      @propertiesAsLinks = !!(@properties and (not (@rels or @revs)) and (@resource or @types))
        # TODO: .. and not content attr and getReference()
      if @properties and not @propertiesAsLinks
        @literal = data.getLiteral()
      if data.isInlist()
        @inlist = true

    getErrors: ->
      @data.errors

    getSubject: ->
      if @about
        return @about
      else if @resource and not ((@rels or @revs) or @propertiesAsLinks)
        return @resource
      else if @types and not (@properties or @rels or @revs)
        return @newBNode()

    getReference: ->
      if @resource
        return @resource
      else if @types and (@rels or @properties) # and not content attr
        return @newBNode()

    getLiteral: ->
      lit = @literal
      return null unless lit
      unless lit.lang or lit.datatype
        lit.value
      else
        {"@value": lit.value, "@language": lit.lang, "@datatype": lit.datatype}

    getLinks: ->
      if @rels
        return @rels
      else if @propertiesAsLinks
        return @properties
      else
        return []

    getValueProperties: ->
      if @properties and not @propertiesAsLinks
        return @properties
      else
        return []

    getListLinks: ->

    getListValueProperties: ->

    getRevLinks: ->
      if @revs then @revs else []

    newBNode: ->
      nextBNode() # TODO: marker for proper blank?


  ##
  # A representation of the logical data expressed by an element. This takes
  # context mappings into account, but does not interpret the attribute
  # interplay and generation of triples.
  class ElementData
    constructor: (@el, parentState) ->
      @attrs = @el.attributes
      @tagName = @el.nodeName.toLowerCase()
      @errors = []
      @state = parentState.createInherited(
        @getBase(), @getLang(), @getVocab(), @getPrefixes())

    getBase: ->
      null # xml:base if XML-based profile

    getLang: ->
      @attrs.lang?.value

    getVocab: ->
      @attrs.vocab?.value

    getPrefixes: ->
      val = @attrs.prefix?.value
      return null unless val
      pfxs = val.replace(/^\s+|\s+$/g, "").split(/:?\s+/)
      prefixes = {}
      for i in [0...pfxs.length] by 2
        pfx = pfxs[i]
        ns = pfxs[i+1]
        prefixes[pfx] = ns
      prefixes

    getAbout: ->
      if @attrs.about? #and not parent
        next = @state.expandAndResolve(@attrs.about.value)

    getResource: ->
      if @attrs.resource?
        return @state.expandAndResolve(@attrs.resource.value)
      else if @attrs.href?
        return @state.resolveURI(@attrs.href.value)
      else if @attrs.src?
        return @state.resolveURI(@attrs.src.value)

    getTypes: ->
      # TODO: in jsdom, typeof is expanded to typeof="typeof"
      values = @attrs.typeof?.value.split(/\s+/)
      if values
        values = (v for v in values when v isnt 'typeof')
      @expandAll values

    getProperties: ->
      @expandAll @attrs.property?.value.split(/\s+/)

    getRels: ->
      @expandAll @attrs.rel?.value.split(/\s+/)

    getRevs: ->
      @expandAll @attrs.rev?.value.split(/\s+/)

    expandAll: (expressions) ->
      return null unless expressions
      result = []
      for expr in expressions
        iri = @state.expandTermOrCurieOrIRI(expr)
        if iri
          result.push(iri)
      result

    getLiteral: ->
      datatype = @getDatatype()
      lang = @state.lang
      if datatype is RDF_XML_LITERAL
        xml = @getXML()
      else
        content = @getContent()
      if content
        if datatype
          return {value: content, datatype: datatype}
        else if lang
          # TODO: inherited (in compact: if diff. from top-level lang)
          return {value: content, lang: lang}
        else
          return {value: content}
      else# if xml
        return {value: xml, datatype: datatype}

    getContent: ->
      if @attrs.content?
        return @attrs.content.value
      else if @state.profile is 'html' and @tagName is 'time'
        if @attrs.datetime?
          return @attrs.datetime.value
      return @el.textContent

    getXML: ->
      @el.innerHTML

    getDatatype: ->
      if @attrs.datatype?
        return @attrs.datatype.value
      else if @state.profile is 'html' and @tagName is 'time'
        value = @getContent()
        if value.indexOf('T') > -1
          return 'xsd:dateTime'
        else
          return 'xsd:date'
      return null

    isInlist: ->
      @attrs.inlist isnt undefined


  contexts =
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


  bnodeCounter = ->
    prefix = "_:gen-#{(new Date().getTime()).toString(16)}-"
    count = 0
    return -> prefix + count++


  inherit = (obj) ->
    ctor = () ->
    ctor.prototype = obj
    return new ctor


  exports.extract = extract
  exports.Description = Description
  exports.State = State
  exports.contexts = contexts

)(exports ? RDFaParser = {})
