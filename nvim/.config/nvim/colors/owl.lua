-- Ghostty owl-compatible Neovim theme.
-- Low-colour, transparent, terminal-first. Ghostty owns the room.

vim.opt.termguicolors = true

vim.cmd("highlight clear")
if vim.fn.exists("syntax_on") == 1 then
  vim.cmd("syntax reset")
end
vim.g.colors_name = "owl"

local c = {
  bg = "#2f2b2c",
  bg_alt = "#302c2c",
  bg_soft = "#3a3637",
  bg_sel = "#5d595b",
  fg = "#dedede",
  fg_soft = "#cacaca",
  muted = "#989898",
  dim = "#7f7f7f",
  dark = "#656565",
  accent = "#da5b2c",
  accent_warm = "#d7a65f",
  accent_cool = "#b99ab7",
  white = "#ffffff",
  black = "#302c2c",
}

local function hi(group, opts)
  vim.api.nvim_set_hl(0, group, opts)
end

-- Editor core ---------------------------------------------------------------
hi("Normal", { fg = c.fg, bg = "NONE" })
hi("NormalNC", { fg = c.fg_soft, bg = "NONE" })
hi("EndOfBuffer", { fg = c.bg, bg = "NONE" })
hi("SignColumn", { fg = c.muted, bg = "NONE" })
hi("LineNr", { fg = c.dim, bg = "NONE" })
hi("CursorLineNr", { fg = c.fg, bg = "NONE", bold = true })
hi("CursorLine", { bg = c.bg_alt })
hi("CursorColumn", { bg = c.bg_alt })
hi("ColorColumn", { bg = c.bg_alt })
hi("VertSplit", { fg = c.bg_sel, bg = "NONE" })
hi("WinSeparator", { fg = c.bg_sel, bg = "NONE" })
hi("Folded", { fg = c.muted, bg = c.bg_alt })
hi("FoldColumn", { fg = c.dim, bg = "NONE" })

hi("Visual", { fg = c.fg, bg = c.bg_sel })
hi("Search", { fg = c.black, bg = c.fg_soft })
hi("IncSearch", { fg = c.black, bg = c.accent })
hi("CurSearch", { fg = c.black, bg = c.accent })
hi("MatchParen", { fg = c.white, bg = c.bg_sel, bold = true })
hi("NonText", { fg = c.dark })
hi("Whitespace", { fg = c.dark })
hi("SpecialKey", { fg = c.dim })

hi("Pmenu", { fg = c.fg, bg = c.bg_alt })
hi("PmenuSel", { fg = c.black, bg = c.fg_soft })
hi("PmenuSbar", { bg = c.bg_soft })
hi("PmenuThumb", { bg = c.bg_sel })
hi("NormalFloat", { fg = c.fg, bg = c.bg_alt })
hi("FloatBorder", { fg = c.dim, bg = c.bg_alt })
hi("FloatTitle", { fg = c.fg, bg = c.bg_alt, bold = true })

hi("StatusLine", { fg = c.fg, bg = c.bg_alt })
hi("StatusLineNC", { fg = c.dim, bg = c.bg_alt })
hi("TabLine", { fg = c.muted, bg = c.bg_alt })
hi("TabLineFill", { bg = "NONE" })
hi("TabLineSel", { fg = c.fg, bg = c.bg_sel, bold = true })

-- Syntax --------------------------------------------------------------------
hi("Comment", { fg = c.dim, italic = true })
hi("Constant", { fg = c.accent_warm })
hi("String", { fg = c.fg_soft })
hi("Character", { fg = c.fg_soft })
hi("Number", { fg = c.muted })
hi("Boolean", { fg = c.accent_cool })
hi("Float", { fg = c.muted })
hi("Identifier", { fg = c.fg })
hi("Function", { fg = c.fg, bold = true })
hi("Statement", { fg = c.accent })
hi("Conditional", { fg = c.fg_soft })
hi("Repeat", { fg = c.fg_soft })
hi("Label", { fg = c.fg_soft })
hi("Operator", { fg = c.fg_soft })
hi("Keyword", { fg = c.accent })
hi("Exception", { fg = c.accent })
hi("PreProc", { fg = c.accent_cool })
hi("Include", { fg = c.accent_cool })
hi("Define", { fg = c.accent_cool })
hi("Macro", { fg = c.accent_cool })
hi("PreCondit", { fg = c.accent_cool })
hi("Type", { fg = c.accent_cool })
hi("StorageClass", { fg = c.accent_cool })
hi("Structure", { fg = c.accent_cool })
hi("Typedef", { fg = c.accent_cool })
hi("Special", { fg = c.accent_cool })
hi("SpecialChar", { fg = c.accent_warm })
hi("Tag", { fg = c.fg_soft })
hi("Delimiter", { fg = c.dim })
hi("SpecialComment", { fg = c.muted, italic = true })
hi("Debug", { fg = c.accent })
hi("Underlined", { fg = c.fg, underline = true })
hi("Ignore", { fg = c.dark })
hi("Error", { fg = c.accent, bold = true })
hi("Todo", { fg = c.black, bg = c.accent, bold = true })

-- Diagnostics / git ---------------------------------------------------------
hi("DiagnosticError", { fg = c.accent })
hi("DiagnosticWarn", { fg = c.fg_soft })
hi("DiagnosticInfo", { fg = c.muted })
hi("DiagnosticHint", { fg = c.dim })
hi("DiagnosticOk", { fg = c.muted })
hi("DiagnosticVirtualTextError", { fg = c.accent, bg = "NONE" })
hi("DiagnosticVirtualTextWarn", { fg = c.muted, bg = "NONE" })
hi("DiagnosticVirtualTextInfo", { fg = c.dim, bg = "NONE" })
hi("DiagnosticVirtualTextHint", { fg = c.dim, bg = "NONE" })
hi("DiagnosticUnderlineError", { sp = c.accent, undercurl = true })
hi("DiagnosticUnderlineWarn", { sp = c.muted, undercurl = true })
hi("DiagnosticUnderlineInfo", { sp = c.dim, undercurl = true })
hi("DiagnosticUnderlineHint", { sp = c.dim, undercurl = true })

hi("DiffAdd", { fg = c.fg_soft, bg = c.bg_alt })
hi("DiffChange", { fg = c.muted, bg = c.bg_alt })
hi("DiffDelete", { fg = c.accent, bg = c.bg_alt })
hi("DiffText", { fg = c.fg, bg = c.bg_sel, bold = true })
hi("Added", { fg = c.fg_soft })
hi("Changed", { fg = c.muted })
hi("Removed", { fg = c.accent })

-- Treesitter ----------------------------------------------------------------
hi("@comment", { link = "Comment" })
hi("@string", { link = "String" })
hi("@number", { link = "Number" })
hi("@boolean", { link = "Boolean" })
hi("@constant", { link = "Constant" })
hi("@constant.builtin", { fg = c.accent_cool })
hi("@function", { link = "Function" })
hi("@function.call", { fg = c.fg_soft, bold = true })
hi("@method", { link = "Function" })
hi("@constructor", { fg = c.accent_cool })
hi("@keyword", { link = "Keyword" })
hi("@keyword.function", { fg = c.fg_soft })
hi("@keyword.return", { fg = c.accent })
hi("@operator", { link = "Operator" })
hi("@type", { link = "Type" })
hi("@variable", { fg = c.fg })
hi("@variable.builtin", { fg = c.accent_cool, italic = true })
hi("@variable.parameter", { fg = c.fg_soft })
hi("@property", { fg = c.fg_soft })
hi("@attribute", { fg = c.accent_cool })
hi("@punctuation", { fg = c.dim })
hi("@punctuation.bracket", { fg = c.dim })
hi("@punctuation.delimiter", { fg = c.dim })
hi("@tag", { fg = c.fg_soft })
hi("@tag.attribute", { fg = c.muted })
hi("@tag.delimiter", { fg = c.dim })

-- Plugin groups -------------------------------------------------------------
hi("TelescopeNormal", { fg = c.fg, bg = c.bg_alt })
hi("TelescopeBorder", { fg = c.dim, bg = c.bg_alt })
hi("TelescopePromptNormal", { fg = c.fg, bg = c.bg_alt })
hi("TelescopePromptBorder", { fg = c.accent, bg = c.bg_alt })
hi("TelescopePromptTitle", { fg = c.black, bg = c.accent })
hi("TelescopeMatching", { fg = c.accent, bold = true })
hi("TelescopeSelection", { fg = c.fg, bg = c.bg_sel })

hi("NvimTreeNormal", { fg = c.fg, bg = "NONE" })
hi("NvimTreeNormalNC", { fg = c.fg_soft, bg = "NONE" })
hi("NvimTreeFolderName", { fg = c.fg_soft })
hi("NvimTreeOpenedFolderName", { fg = c.fg, bold = true })
hi("NvimTreeRootFolder", { fg = c.muted, bold = true })
hi("NvimTreeGitDirty", { fg = c.accent })
hi("NvimTreeGitNew", { fg = c.fg_soft })
hi("NvimTreeGitDeleted", { fg = c.accent })

hi("WhichKey", { fg = c.fg })
hi("WhichKeyDesc", { fg = c.fg_soft })
hi("WhichKeyGroup", { fg = c.muted })
hi("WhichKeyBorder", { fg = c.dim })

hi("BlinkCmpMenu", { fg = c.fg, bg = c.bg_alt })
hi("BlinkCmpMenuBorder", { fg = c.dim, bg = c.bg_alt })
hi("BlinkCmpMenuSelection", { fg = c.black, bg = c.fg_soft })
hi("BlinkCmpLabelMatch", { fg = c.accent, bold = true })
hi("BlinkCmpDoc", { fg = c.fg, bg = c.bg_alt })
hi("BlinkCmpDocBorder", { fg = c.dim, bg = c.bg_alt })

-- Markdown comments: dimmer than body text, but lighter than code comments
hi("@comment.markdown", { fg = c.muted, italic = true })
hi("@comment.markdown_inline", { fg = c.muted, italic = true })

hi("RenderMarkdownH1", { fg = c.fg, bold = true })
hi("RenderMarkdownH2", { fg = c.fg_soft, bold = true })
hi("RenderMarkdownCode", { bg = c.bg_alt })

-- Terminal ANSI colours, same as Ghostty owl --------------------------------
vim.g.terminal_color_0 = "#302c2c"
vim.g.terminal_color_1 = "#5a5a5a"
vim.g.terminal_color_2 = "#989898"
vim.g.terminal_color_3 = "#cacaca"
vim.g.terminal_color_4 = "#656565"
vim.g.terminal_color_5 = "#b1b1b1"
vim.g.terminal_color_6 = "#7f7f7f"
vim.g.terminal_color_7 = "#dedede"
vim.g.terminal_color_8 = "#5d595b"
vim.g.terminal_color_9 = "#da5b2c"
vim.g.terminal_color_10 = "#989898"
vim.g.terminal_color_11 = "#cacaca"
vim.g.terminal_color_12 = "#656565"
vim.g.terminal_color_13 = "#b1b1b1"
vim.g.terminal_color_14 = "#7f7f7f"
vim.g.terminal_color_15 = "#ffffff"
