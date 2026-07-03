vim.g.mapleader = " "

-- ============================================================================
-- Options
-- ============================================================================

vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.termguicolors = true
vim.opt.fillchars = { eob = " " }
vim.opt.shortmess:append("I")

vim.opt.expandtab = true
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2

vim.opt.ignorecase = false
vim.opt.smartcase = true

vim.opt.clipboard = "unnamedplus"

vim.opt.undofile = true
vim.opt.undodir = vim.fn.stdpath("state") .. "/undo"

-- ============================================================================
-- Keymaps
-- ============================================================================

require("config.keymaps")

-- ============================================================================
-- lazy.nvim bootstrap
-- ============================================================================

local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

if not vim.uv.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "--branch=stable",
    "https://github.com/folke/lazy.nvim.git",
    lazypath,
  })
end

vim.opt.rtp:prepend(lazypath)

-- ============================================================================
-- Plugins
-- ============================================================================

require("lazy").setup({
  {
    import = "plugins"
  },
}, {
  rocks = {
    enabled = false,
  },
})
