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
      -- goimports also runs gofmt; use the Go toolchain's gofmt as a fallback.
      go = { "goimports", "gofmt", stop_after_first = true },
    },
    format_on_save = function(bufnr)
      if vim.bo[bufnr].filetype == "go" then
        return {
          timeout_ms = 1000,
          lsp_format = "fallback",
        }
      end
    end,
  },
  config = function(_, opts)
    require("conform").setup(opts)

    vim.keymap.set("n", "<leader>cf", function()
      require("conform").format({
        async = true,
        lsp_format = "fallback",
      })
    end, { desc = "Format file" })
  end,
}
