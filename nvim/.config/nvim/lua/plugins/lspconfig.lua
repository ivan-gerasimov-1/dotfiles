return {
  "neovim/nvim-lspconfig",
  config = function()
    vim.lsp.config("*", {
      capabilities = require("blink.cmp").get_lsp_capabilities(),
    })

    vim.lsp.enable({
      -- native TypeScript 7 server (tsc --lsp); ts_ls needs tsserver.js, which TS 7 no longer ships
      "tsc",
      "jsonls",
      "lua_ls",
    })
  end,
}
