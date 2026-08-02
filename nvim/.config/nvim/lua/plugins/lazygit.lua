return {
  "kdheepak/lazygit.nvim",
  cmd = {
    "LazyGit",
    "LazyGitConfig",
    "LazyGitCurrentFile",
    "LazyGitFilter",
    "LazyGitFilterCurrentFile",
  },
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  keys = {
    { "<leader>gg", "<cmd>LazyGit<CR>", desc = "Open LazyGit" },
    {
      "<leader>gf",
      "<cmd>LazyGitFilterCurrentFile<CR>",
      desc = "LazyGit current file",
    },
  },
}
