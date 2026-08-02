return {
  "neovim/nvim-lspconfig",
  config = function()
    vim.lsp.config("*", {
      capabilities = require("blink.cmp").get_lsp_capabilities(),
    })

    vim.lsp.config("gopls", {
      settings = {
        gopls = {
          gofumpt = true,
          staticcheck = true,
        },
      },
    })

    vim.lsp.enable({
      "ts_ls",
      "jsonls",
      "lua_ls",
      "gopls",
    })
  end,
}
