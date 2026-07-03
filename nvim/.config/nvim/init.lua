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

-- Save / close
vim.keymap.set("n", "<leader>s", "<cmd>w<CR>", { desc = "Save file" })
vim.keymap.set("n", "<leader>S", "<cmd>wa<CR>", { desc = "Save all files" })
vim.keymap.set("n", "<leader>q", "<cmd>q<CR>", { desc = "Close window" })

-- Buffers
vim.keymap.set("n", "<S-l>", "<cmd>bnext<CR>", { desc = "Next buffer" })
vim.keymap.set("n", "<S-h>", "<cmd>bprevious<CR>", { desc = "Previous buffer" })
vim.keymap.set("n", "<leader>]", "<cmd>bnext<CR>", { desc = "Next buffer" })
vim.keymap.set("n", "<leader>[", "<cmd>bprevious<CR>", { desc = "Previous buffer" })
vim.keymap.set("n", "<leader>w", "<cmd>bdelete<CR>", { desc = "Close buffer" })

-- Windows
vim.keymap.set("n", "<C-h>", "<C-w>h", { desc = "Focus left window" })
vim.keymap.set("n", "<C-j>", "<C-w>j", { desc = "Focus lower window" })
vim.keymap.set("n", "<C-k>", "<C-w>k", { desc = "Focus upper window" })
vim.keymap.set("n", "<C-l>", "<C-w>l", { desc = "Focus right window" })
vim.keymap.set("n", "<leader>d", "<cmd>vsplit<CR>", { desc = "Split vertical" })
vim.keymap.set("n", "<leader>D", "<cmd>split<CR>", { desc = "Split horizontal" })

-- Diagnostics
vim.keymap.set("n", "[d", vim.diagnostic.goto_prev, { desc = "Previous diagnostic" })
vim.keymap.set("n", "]d", vim.diagnostic.goto_next, { desc = "Next diagnostic" })

-- LSP
vim.keymap.set("n", "gd", vim.lsp.buf.definition, { desc = "Go to definition" })
vim.keymap.set("n", "gr", vim.lsp.buf.references, { desc = "Find references" })
vim.keymap.set("n", "gi", vim.lsp.buf.implementation, { desc = "Go to implementation" })
vim.keymap.set("n", "K", vim.lsp.buf.hover, { desc = "Hover documentation" })

vim.keymap.set("n", "<F2>", vim.lsp.buf.rename, { desc = "Rename symbol" })
vim.keymap.set("n", "<leader>.", vim.lsp.buf.code_action, { desc = "Code action" })

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
    "neovim/nvim-lspconfig",
    config = function()
      vim.lsp.enable({
        "ts_ls",
        "jsonls",
        "lua_ls",
      })
    end,
  },

  {
    "nvim-treesitter/nvim-treesitter",
    branch = "main",
    build = ":TSUpdate",
    opts = {
      ensure_installed = {
        "typescript",
        "tsx",
        "javascript",
        "json",
        "lua",
        "markdown",
        "bash",
      },
    },
  },

  {
    "nvim-lua/plenary.nvim",
    lazy = true,
  },

  {
    "MeanderingProgrammer/render-markdown.nvim",
    ft = { "markdown" },
    opts = {},
  },

  {
    "nvim-telescope/telescope.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    config = function()
      require("telescope").setup({
        defaults = {
          disable_devicons = true,
        },
      })

      local telescope = require("telescope.builtin")

      vim.keymap.set("n", "<leader>ff", telescope.find_files, { desc = "Find files" })
      vim.keymap.set("n", "<leader>fg", telescope.live_grep, { desc = "Search text" })
      vim.keymap.set("n", "<leader>fb", telescope.buffers, { desc = "Find buffer" })
      vim.keymap.set("n", "<leader>fh", telescope.help_tags, { desc = "Search help" })
    end,
  },

  {
    "saghen/blink.cmp",
    version = "1.*",
    opts = {
      keymap = {
        preset = "default",
      },
      completion = {
        documentation = {
          auto_show = true,
        },
      },
    },
  },

  {
    "nvim-tree/nvim-web-devicons",
    lazy = true,
  },

  {
    "nvim-tree/nvim-tree.lua",
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    config = function()
      require("nvim-tree").setup({
        view = {
          side = "right",
        },
        filters = {
          dotfiles = false,
        },
        renderer = {
          icons = {
            show = {
              file = false,
              folder = false,
              folder_arrow = true,
              git = true,
              modified = true,
              hidden = true,
              diagnostics = true,
              bookmarks = true,
            },
          },
        },
      })

      vim.keymap.set("n", "<leader>e", "<cmd>NvimTreeToggle<CR>", { desc = "Toggle explorer" })
      vim.keymap.set("n", "<leader>b", "<cmd>NvimTreeToggle<CR>", { desc = "Toggle explorer" })
      vim.keymap.set("n", "<leader>E", "<cmd>NvimTreeFocus<CR>", { desc = "Focus explorer" })
    end,
  },

  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {},
  },

  {
    "neanias/everforest-nvim",
    version = false,
    priority = 1000,
    config = function()
      require("everforest").setup({
        background = "hard",
        transparent_background_level = 2,
      })

      vim.cmd.colorscheme("everforest")
    end,
  },

  {
    "nvim-lualine/lualine.nvim",
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    opts = {},
  },

  {
    "lewis6991/gitsigns.nvim",
    opts = {},
  },

  {
    "windwp/nvim-autopairs",
    event = "InsertEnter",
    opts = {},
  },

  {
    "numToStr/Comment.nvim",
    opts = {},
  },

  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        javascript = { "prettier" },
        javascriptreact = { "prettier" },
        typescript = { "prettier" },
        typescriptreact = { "prettier" },
        json = { "prettier" },
        jsonc = { "prettier" },
        markdown = { "prettier" },
        css = { "prettier" },
        scss = { "prettier" },
        html = { "prettier" },
        yaml = { "prettier" },
      },
    },
    config = function(_, opts)
      require("conform").setup(opts)

      vim.keymap.set("n", "<leader>cf", function()
        require("conform").format({
          async = true,
          lsp_fallback = true,
        })
      end, { desc = "Format file" })
    end,
  },
}, {
  rocks = {
    enabled = false,
  },
})
