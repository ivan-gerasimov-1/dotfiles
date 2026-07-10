;; extends

; HTML comments as block-level nodes: <!-- ... -->
((html_block) @comment
  (#lua-match? @comment "^%s*<!%-%-"))
