return {
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
}
