fs = require 'fs'
jsdom = require 'jsdom'
RDFaJSON = require "../js/rdfa/json"

run = (window, base) ->
  data = RDFaJSON.extract(window.document, base)
  s = JSON.stringify(data, null, 2).replace(
      /{\s+(\S+: "[^"]+")\s+}/gm, '{$1}').replace(
      /\[\s+(.+)\s+\]/gm, '[$1]')
  console.log(s)

path = process.argv[2] ? '-'

if path.match(/^https?:/)
  jsdom.env path, [], (errors, window) -> run(window, path)
else
  extract = (content) ->
    window = jsdom.jsdom(null, null).createWindow()
    window.document.innerHTML = content
    run(window, path)
  if path is '-'
    content = ""
    process.stdin.resume()
    process.stdin.on 'data', (buf) -> content += buf.toString()
    process.stdin.on 'end', -> extract content
  else
    fs.readFile path, "utf-8", (err, content) -> extract content

