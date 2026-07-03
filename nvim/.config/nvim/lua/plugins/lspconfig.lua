return {
  "neovim/nvim-lspconfig",
  config = function()
    vim.lsp.enable({
      "ts_ls",
      "jsonls",
      "lua_ls",
    })
  end,
}
