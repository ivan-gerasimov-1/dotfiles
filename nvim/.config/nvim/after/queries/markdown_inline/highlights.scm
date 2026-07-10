;; extends

; Inline HTML comments: text <!-- ... --> text
((html_tag) @comment
  (#lua-match? @comment "^<!%-%-"))
