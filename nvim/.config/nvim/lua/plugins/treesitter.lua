return {
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
}
