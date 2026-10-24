return {
  "nvim-treesitter/nvim-treesitter",
  branch = "main",
  -- the main branch does not support lazy-loading
  lazy = false,
  build = ":TSUpdate",
  config = function()
    -- the main branch ignores ensure_installed; install() is a no-op for parsers already installed
    require("nvim-treesitter").install({
      "typescript",
      "tsx",
      "javascript",
      "json",
      "lua",
      "markdown",
      "markdown_inline",
      "bash",
    })

    -- highlighting is not enabled automatically; start it wherever a parser exists
    vim.api.nvim_create_autocmd("FileType", {
      callback = function(args)
        pcall(vim.treesitter.start, args.buf)
      end,
    })
  end,
}
