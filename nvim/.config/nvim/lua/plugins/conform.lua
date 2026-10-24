return {
  "stevearc/conform.nvim",
  opts = {
    formatters_by_ft = {
      javascript = { "biome" },
      javascriptreact = { "biome" },
      typescript = { "biome" },
      typescriptreact = { "biome" },
      json = { "biome" },
      jsonc = { "biome" },
    },
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
